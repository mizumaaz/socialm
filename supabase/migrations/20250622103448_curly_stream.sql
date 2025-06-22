/*
  # Create story_views table for cross-device story view tracking

  1. New Tables
    - `story_views`
      - `id` (uuid, primary key)
      - `story_id` (uuid, foreign key to stories)
      - `viewer_id` (uuid, foreign key to profiles)
      - `viewed_at` (timestamp, when the story was viewed)

  2. Security
    - Enable RLS on `story_views` table
    - Add policies for users to manage their own views
    - Add policies for story owners to see who viewed their stories

  3. Indexes
    - Add indexes for better performance
*/

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
GRANT EXECUTE ON FUNCTION public.increment_story_views(uuid, uuid) TO authenticated;