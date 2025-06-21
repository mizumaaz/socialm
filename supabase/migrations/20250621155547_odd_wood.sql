/*
  # Fix All Database Schema Issues

  1. Tables & Columns
    - Ensure posts table has comments_enabled column
    - Create notifications table if missing
    - Fix profiles table columns
    - Add missing indexes

  2. Functions
    - Fix cleanup_expired_story_photos function
    - Create missing utility functions
    - Fix data type issues

  3. Security & Performance
    - Enable RLS on all tables
    - Add proper policies
    - Create optimized indexes

  4. Data Integrity
    - Set proper defaults
    - Add constraints
    - Fix existing data
*/

-- First, let's ensure the posts table has the comments_enabled column
DO $$
BEGIN
  -- Add comments_enabled column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'comments_enabled'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN comments_enabled boolean DEFAULT true;
    
    -- Update all existing posts to have comments enabled by default
    UPDATE public.posts SET comments_enabled = true WHERE comments_enabled IS NULL;
    
    -- Make the column NOT NULL
    ALTER TABLE public.posts ALTER COLUMN comments_enabled SET NOT NULL;
    
    -- Add index for better performance
    CREATE INDEX idx_posts_comments_enabled ON public.posts(comments_enabled);
  END IF;
END $$;

-- Ensure profiles table has all required columns
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

-- Create indexes for notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON public.notifications(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications(user_id, read, created_at DESC);

-- Ensure stories table exists with proper structure
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  views_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + INTERVAL '24 hours')
);

-- Enable RLS on stories table
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Create or update the cleanup_expired_story_photos function with proper data types
CREATE OR REPLACE FUNCTION public.cleanup_expired_story_photos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired story photos (older than 24 hours)
  -- Use proper timestamp comparison
  DELETE FROM public.stories 
  WHERE expires_at < now();
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up expired stories at %', now();
END $$;

-- Create or replace the increment_story_views function
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
  -- Update the views count
  UPDATE public.stories 
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = story_uuid
  RETURNING views_count INTO new_view_count;
  
  -- Return the new view count
  RETURN COALESCE(new_view_count, 0);
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.cleanup_expired_story_photos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_story_views(uuid, uuid) TO authenticated;

-- Add additional indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON public.posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_comments_enabled ON public.posts(user_id, comments_enabled);
CREATE INDEX IF NOT EXISTS idx_likes_post_user ON public.likes(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stories_expires_user ON public.stories(expires_at, user_id);

-- Ensure all tables have proper RLS enabled
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Set replica identity for realtime subscriptions
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.likes REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;

-- Add notifications table to realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Table already in publication
  END;
END $$;

-- Add posts table to realtime publication (in case it's missing)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Table already in publication
  END;
END $$;

-- Insert some sample notifications for testing (only if no notifications exist)
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

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';