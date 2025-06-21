/*
  # Fix Database Schema Issues

  1. Profile Updates
    - Add missing `theme_preference` column (text, default 'light')
    - Add missing `color_theme` column (text, default 'green')

  2. Notifications Table
    - Create `notifications` table with proper structure
    - Add RLS policies for security
    - Add indexes for performance

  3. Story Functions
    - Create `cleanup_expired_story_photos` function
    - Create `increment_story_views` function

  4. Security & Performance
    - Enable RLS on all tables
    - Add proper indexes
    - Set up realtime subscriptions
*/

-- First, let's add missing columns to profiles table
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

-- Drop and recreate notifications table to ensure clean state
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Create notifications table with proper structure
CREATE TABLE public.notifications (
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

-- Set replica identity for realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Create or replace the cleanup_expired_story_photos function
CREATE OR REPLACE FUNCTION public.cleanup_expired_story_photos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired story photos (older than 24 hours)
  DELETE FROM public.stories 
  WHERE expires_at < now();
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
  SET views_count = views_count + 1
  WHERE id = story_uuid
  RETURNING views_count INTO new_view_count;
  
  -- Return the new view count
  RETURN COALESCE(new_view_count, 0);
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.cleanup_expired_story_photos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_story_views(uuid, uuid) TO authenticated;

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

-- Insert some sample notifications for testing (optional)
DO $$
DECLARE
  sample_user_id uuid;
BEGIN
  -- Get a sample user ID (first user in profiles table)
  SELECT id INTO sample_user_id FROM public.profiles LIMIT 1;
  
  -- Only insert if we have a user
  IF sample_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, content, read) VALUES
    (sample_user_id, 'like', 'Someone liked your post', false),
    (sample_user_id, 'comment', 'Someone commented on your post', false),
    (sample_user_id, 'friend_request', 'You have a new friend request', false)
    ON CONFLICT DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if no users exist yet
    NULL;
END $$;