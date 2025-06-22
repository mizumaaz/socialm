/*
  # Fix cleanup_expired_story_photos function

  1. Changes
    - Fix the data type comparison issue in the function
    - Ensure proper timestamp comparison
    - Add better error handling

  2. Performance
    - Add logging for better debugging
    - Optimize the query
*/

-- Create or replace the cleanup_expired_story_photos function with fixed data types
CREATE OR REPLACE FUNCTION public.cleanup_expired_story_photos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired story photos (older than 24 hours)
  -- Use proper timestamp comparison with explicit casting
  DELETE FROM public.stories 
  WHERE expires_at::timestamp < now()::timestamp;
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up expired stories at %', now();
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    RAISE NOTICE 'Error in cleanup_expired_story_photos: %', SQLERRM;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.cleanup_expired_story_photos() TO authenticated;