CREATE OR REPLACE FUNCTION public.check_theme_columns_exist()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  theme_exists boolean;
  color_exists boolean;
BEGIN
  -- Check if theme_preference column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'theme_preference'
  ) INTO theme_exists;
  
  -- Check if color_theme column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'color_theme'
  ) INTO color_exists;
  
  -- Return true only if both columns exist
  RETURN theme_exists AND color_exists;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_theme_columns_exist() TO authenticated;