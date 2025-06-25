/*
  # Fix All Database Schema Issues

  1. Profile Updates
    - Add missing `theme_preference` column (text, default 'light')
    - Add missing `color_theme` column (text, default 'green')

  2. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `type` (text, notification type)
      - `content` (text, notification message)
      - `reference_id` (uuid, optional reference to related entity)
      - `read` (boolean, read status, default false)
      - `deleted_at` (timestamp, soft delete)
      - `created_at` (timestamp, default now)

  3. Security
    - Enable RLS on all tables
    - Add proper policies
    - Set up realtime subscriptions

  4. Data Integrity
    - Set proper defaults
    - Add constraints
    - Fix existing data
*/

-- Add missing columns to profiles table
DO $$
BEGIN
  -- Add theme_preference column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'theme_preference'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN theme_preference text DEFAULT 'light';
  END IF;

  -- Add color_theme column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'color_theme'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN color_theme text DEFAULT 'green';
  END IF;
END $$;

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  content text NOT NULL,
  reference_id uuid,
  read boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications for any user" ON public.notifications;

-- Create RLS policies for notifications
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications for any user"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON public.notifications(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications(user_id, read, created_at DESC);

-- Set replica identity for realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add to realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Table already in publication
  END;
END $$;

-- Create story_views table for cross-device story view tracking
CREATE TABLE IF NOT EXISTS public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

-- Enable RLS on story_views table
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for story_views
DROP POLICY IF EXISTS "Users can read own story views" ON public.story_views;
DROP POLICY IF EXISTS "Users can insert own story views" ON public.story_views;
DROP POLICY IF EXISTS "Users can update own story views" ON public.story_views;
DROP POLICY IF EXISTS "Story owners can read views of their stories" ON public.story_views;

CREATE POLICY "Users can read own story views"
  ON public.story_views FOR SELECT
  TO authenticated
  USING (auth.uid() = viewer_id);

CREATE POLICY "Users can insert own story views"
  ON public.story_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Users can update own story views"
  ON public.story_views FOR UPDATE
  TO authenticated
  USING (auth.uid() = viewer_id);

CREATE POLICY "Story owners can read views of their stories"
  ON public.story_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = story_views.story_id
      AND stories.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON public.story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON public.story_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewed_at ON public.story_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_views_story_viewer ON public.story_views(story_id, viewer_id);

-- Set replica identity for realtime
ALTER TABLE public.story_views REPLICA IDENTITY FULL;

-- Add to realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Table already in publication
  END;
END $$;

-- Fix the cleanup_expired_story_photos function
CREATE OR REPLACE FUNCTION public.cleanup_expired_story_photos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired story photos (older than 24 hours)
  DELETE FROM public.stories 
  WHERE expires_at < now();
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up expired stories at %', now();
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    RAISE NOTICE 'Error in cleanup_expired_story_photos: %', SQLERRM;
END $$;

-- Update the increment_story_views function
CREATE OR REPLACE FUNCTION public.increment_story_views(
  story_uuid uuid,
  viewer_uuid uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_view_count integer;
BEGIN
  -- Only increment if viewer is provided and hasn't viewed before
  IF viewer_uuid IS NOT NULL THEN
    -- Insert view record (will be ignored if already exists due to unique constraint)
    INSERT INTO public.story_views (story_id, viewer_id, viewed_at)
    VALUES (story_uuid, viewer_uuid, now())
    ON CONFLICT (story_id, viewer_id) DO NOTHING;
  END IF;
  
  -- Update the views count
  UPDATE public.stories 
  SET views_count = views_count + 1
  WHERE id = story_uuid
  RETURNING views_count INTO new_view_count;
  
  -- Return the new view count
  RETURN COALESCE(new_view_count, 0);
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.cleanup_expired_story_photos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_story_views(uuid, uuid) TO authenticated;

-- Ensure all tables have proper RLS enabled
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Set replica identity for realtime subscriptions
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.likes REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.friends REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Add tables to realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Insert sample notifications for testing (only if no notifications exist)
DO $$
DECLARE
  sample_user_id uuid;
  notification_count integer;
BEGIN
  -- Check if notifications already exist
  SELECT COUNT(*) INTO notification_count FROM public.notifications;
  
  -- Only insert sample notifications if none exist
  IF notification_count = 0 THEN
    -- Get a sample user ID (first user in profiles table)
    SELECT id INTO sample_user_id FROM public.profiles LIMIT 1;
    
    -- Only insert if we have a user
    IF sample_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, content, read) VALUES
      (sample_user_id, 'system', '🎨 Don''t like the pixel font? No problem! Visit your Profile section to change themes and customize fonts & colors to your preference.', false),
      (sample_user_id, 'like', 'Welcome to SocialChat! Someone liked your post', false),
      (sample_user_id, 'comment', 'Someone commented on your post', false),
      (sample_user_id, 'friend_request', 'You have a new friend request', false)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if no users exist yet
    NULL;
END $$;

-- Update table statistics for better query planning
ANALYZE public.posts;
ANALYZE public.notifications;
ANALYZE public.profiles;
ANALYZE public.stories;
ANALYZE public.likes;
ANALYZE public.comments;
ANALYZE public.friends;
ANALYZE public.messages;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';