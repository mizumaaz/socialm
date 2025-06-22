-- Add comments_enabled column to posts table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'comments_enabled'
  ) THEN
    -- Add comments_enabled column with default value
    ALTER TABLE public.posts ADD COLUMN comments_enabled boolean DEFAULT true;
    
    -- Update all existing posts to have comments enabled
    UPDATE public.posts SET comments_enabled = true WHERE comments_enabled IS NULL;
    
    -- Make the column NOT NULL
    ALTER TABLE public.posts ALTER COLUMN comments_enabled SET NOT NULL;
    
    -- Add index for better performance
    CREATE INDEX idx_posts_comments_enabled ON public.posts(comments_enabled);
    CREATE INDEX idx_posts_user_comments_enabled ON public.posts(user_id, comments_enabled);
  END IF;
END $$;

-- Ensure posts table has proper replica identity for realtime
ALTER TABLE public.posts REPLICA IDENTITY FULL;

-- Add posts to realtime publication if not already added
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Table already in publication
  END;
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

-- Fix cleanup_expired_story_photos function
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.cleanup_expired_story_photos() TO authenticated;