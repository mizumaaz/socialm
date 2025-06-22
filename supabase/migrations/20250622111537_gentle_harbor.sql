-- Fix database schema issues

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

-- Create RLS policies for notifications
DO $$
BEGIN
  -- Drop existing policies if they exist
  DECLARE
    policy_record RECORD;
  BEGIN
    FOR policy_record IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE tablename = 'notifications' AND schemaname = 'public'
    LOOP
      EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.notifications';
    END LOOP;
  END;
  
  -- Create new policies
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
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON public.notifications(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

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
DO $$
BEGIN
  -- Drop existing policies if they exist
  DECLARE
    policy_record RECORD;
  BEGIN
    FOR policy_record IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE tablename = 'story_views' AND schemaname = 'public'
    LOOP
      EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.story_views';
    END LOOP;
  END;
  
  -- Create new policies
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
END $$;

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

-- Fix the cleanup_expired_story_photos function with proper data types
CREATE OR REPLACE FUNCTION public.cleanup_expired_story_photos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired story photos (older than 24 hours)
  -- Use proper timestamp comparison with explicit casting
  DELETE FROM public.stories 
  WHERE expires_at::timestamptz < now()::timestamptz;
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up expired stories at %', now();
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    RAISE NOTICE 'Error in cleanup_expired_story_photos: %', SQLERRM;
END $$;

-- Update the increment_story_views function to also track individual views
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