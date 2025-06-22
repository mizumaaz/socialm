/*
  # Add comments_enabled column to posts table

  1. Changes
    - Add `comments_enabled` column to posts table (boolean, default true)
    - Add index for better performance
    - Update existing posts to have comments enabled by default

  2. Performance
    - Add index for comments_enabled column
    - Ensure backward compatibility
*/

-- Add comments_enabled column to posts table
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
  END IF;
END $$;

-- Add index for comments_enabled column for better performance
CREATE INDEX IF NOT EXISTS idx_posts_comments_enabled ON public.posts(comments_enabled);
CREATE INDEX IF NOT EXISTS idx_posts_user_comments_enabled ON public.posts(user_id, comments_enabled);

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