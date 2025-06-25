/*
  # Create Group Chat System and Fix Database Issues

  1. Fix Missing Tables and Columns
    - Add missing theme_preference and color_theme columns to profiles
    - Create notifications table if missing
    - Create story_views table if missing

  2. New Tables for Group Chat
    - `groups` - Store group information
    - `group_members` - Track group membership and roles
    - `group_join_requests` - Handle join requests
    - `group_messages` - Store group chat messages

  3. Security
    - Enable RLS on all tables
    - Add proper policies for group access control
    - Ensure only admins can manage membership

  4. SEO Enhancements
    - Add SEO metadata table for dynamic content
    - Create sitemap generation function
*/

-- Fix missing columns in profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'theme_preference'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN theme_preference text DEFAULT 'light';
  END IF;

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

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications for any user" ON public.notifications;

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

-- Create story_views table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

-- Enable RLS on story_views
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar text,
  is_private boolean DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  member_count integer DEFAULT 1,
  max_members integer DEFAULT 100
);

-- Enable RLS on groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Create group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS on group_members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Create group_join_requests table
CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS on group_join_requests
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

-- Create group_messages table
CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on group_messages
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Create SEO metadata table
CREATE TABLE IF NOT EXISTS public.seo_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  keywords text[],
  og_image text,
  canonical_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on seo_metadata
ALTER TABLE public.seo_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Groups
CREATE POLICY "Users can view groups they are members of"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = groups.id AND user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create groups"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creators can update their groups"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can delete their groups"
  ON public.groups FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for Group Members
CREATE POLICY "Users can view group members of groups they belong to"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can manage members"
  ON public.group_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_members.group_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- RLS Policies for Group Join Requests
CREATE POLICY "Users can view join requests for groups they admin"
  ON public.group_join_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_join_requests.group_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can create join requests"
  ON public.group_join_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Group admins can update join requests"
  ON public.group_join_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_join_requests.group_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- RLS Policies for Group Messages
CREATE POLICY "Group members can view messages"
  ON public.group_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_messages.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can send messages"
  ON public.group_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_messages.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Message senders can update their messages"
  ON public.group_messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Message senders and group admins can delete messages"
  ON public.group_messages FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_messages.group_id 
      AND user_id =  auth.uid()
      AND role = 'admin'
    )
  );

-- RLS Policies for SEO Metadata
CREATE POLICY "Anyone can view SEO metadata"
  ON public.seo_metadata FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage SEO metadata"
  ON public.seo_metadata FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND email = 'admin@example.com'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON public.notifications(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON public.story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON public.story_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewed_at ON public.story_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_views_story_viewer ON public.story_views(story_id, viewer_id);

CREATE INDEX IF NOT EXISTS idx_groups_created_by ON public.groups(created_by);
CREATE INDEX IF NOT EXISTS idx_groups_is_private ON public.groups(is_private);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_role ON public.group_members(role);
CREATE INDEX IF NOT EXISTS idx_group_join_requests_group_id ON public.group_join_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_group_join_requests_user_id ON public.group_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_group_join_requests_status ON public.group_join_requests(status);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON public.group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id ON public.group_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON public.group_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_seo_metadata_page_path ON public.seo_metadata(page_path);

-- Set replica identity for realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.story_views REPLICA IDENTITY FULL;
ALTER TABLE public.groups REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;
ALTER TABLE public.group_join_requests REPLICA IDENTITY FULL;
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;

-- Add tables to realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_join_requests;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Create function to get group suggestions
CREATE OR REPLACE FUNCTION get_group_suggestions(
  user_uuid uuid,
  limit_count integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  avatar text,
  member_count integer,
  created_by uuid,
  created_at timestamptz,
  mutual_members integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_friends AS (
    SELECT 
      CASE 
        WHEN sender_id = user_uuid THEN receiver_id
        ELSE sender_id
      END as friend_id
    FROM friends
    WHERE (sender_id = user_uuid OR receiver_id = user_uuid)
    AND status = 'accepted'
  ),
  groups_with_friends AS (
    SELECT 
      g.id,
      g.name,
      g.description,
      g.avatar,
      g.member_count,
      g.created_by,
      g.created_at,
      COUNT(DISTINCT gm.user_id) as mutual_members
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    JOIN user_friends uf ON gm.user_id = uf.friend_id
    WHERE NOT EXISTS (
      -- Exclude groups user is already a member of
      SELECT 1 FROM group_members
      WHERE group_id = g.id AND user_id = user_uuid
    )
    AND NOT EXISTS (
      -- Exclude groups user has already requested to join
      SELECT 1 FROM group_join_requests
      WHERE group_id = g.id AND user_id = user_uuid
    )
    GROUP BY g.id, g.name, g.description, g.avatar, g.member_count, g.created_by, g.created_at
  )
  SELECT * FROM groups_with_friends
  ORDER BY mutual_members DESC, created_at DESC
  LIMIT limit_count;
END;
$$;

-- Create function to get group members with profiles
CREATE OR REPLACE FUNCTION get_group_members_with_profiles(
  group_uuid uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role text,
  joined_at timestamptz,
  name text,
  username text,
  avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gm.id,
    gm.user_id,
    gm.role,
    gm.joined_at,
    p.name,
    p.username,
    p.avatar
  FROM group_members gm
  JOIN profiles p ON gm.user_id = p.id
  WHERE gm.group_id = group_uuid
  ORDER BY 
    CASE WHEN gm.role = 'admin' THEN 0 ELSE 1 END,
    gm.joined_at;
END;
$$;

-- Create function to get group join requests with profiles
CREATE OR REPLACE FUNCTION get_group_join_requests_with_profiles(
  group_uuid uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  status text,
  message text,
  created_at timestamptz,
  name text,
  username text,
  avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gjr.id,
    gjr.user_id,
    gjr.status,
    gjr.message,
    gjr.created_at,
    p.name,
    p.username,
    p.avatar
  FROM group_join_requests gjr
  JOIN profiles p ON gjr.user_id = p.id
  WHERE gjr.group_id = group_uuid AND gjr.status = 'pending'
  ORDER BY gjr.created_at DESC;
END;
$$;

-- Create function to get group messages with sender profiles
CREATE OR REPLACE FUNCTION get_group_messages_with_profiles(
  group_uuid uuid,
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  content text,
  message_type text,
  created_at timestamptz,
  sender_name text,
  sender_username text,
  sender_avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gm.id,
    gm.sender_id,
    gm.content,
    gm.message_type,
    gm.created_at,
    p.name as sender_name,
    p.username as sender_username,
    p.avatar as sender_avatar
  FROM group_messages gm
  JOIN profiles p ON gm.sender_id = p.id
  WHERE gm.group_id = group_uuid
  ORDER BY gm.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Create function to handle group join request approval
CREATE OR REPLACE FUNCTION approve_group_join_request(
  request_uuid uuid,
  admin_uuid uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id uuid;
  v_user_id uuid;
  v_is_admin boolean;
  v_already_member boolean;
BEGIN
  -- Get request details
  SELECT group_id, user_id INTO v_group_id, v_user_id
  FROM group_join_requests
  WHERE id = request_uuid AND status = 'pending';
  
  IF v_group_id IS NULL THEN
    RETURN false; -- Request not found or not pending
  END IF;
  
  -- Check if admin has permission
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = v_group_id AND user_id = admin_uuid AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN false; -- Not an admin
  END IF;
  
  -- Check if user is already a member
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = v_group_id AND user_id = v_user_id
  ) INTO v_already_member;
  
  IF v_already_member THEN
    -- Update request status
    UPDATE group_join_requests
    SET status = 'approved', updated_at = now()
    WHERE id = request_uuid;
    
    RETURN true;
  END IF;
  
  -- Update request status
  UPDATE group_join_requests
  SET status = 'approved', updated_at = now()
  WHERE id = request_uuid;
  
  -- Add user to group
  INSERT INTO group_members (group_id, user_id, role, joined_at)
  VALUES (v_group_id, v_user_id, 'member', now());
  
  -- Update group member count
  UPDATE groups
  SET member_count = member_count + 1
  WHERE id = v_group_id;
  
  -- Create notification for the user
  INSERT INTO notifications (
    user_id,
    type,
    content,
    reference_id,
    read
  )
  VALUES (
    v_user_id,
    'group_join_approved',
    (SELECT 'Your request to join ' || name || ' has been approved' FROM groups WHERE id = v_group_id),
    v_group_id,
    false
  );
  
  RETURN true;
END;
$$;

-- Create function to handle group join request rejection
CREATE OR REPLACE FUNCTION reject_group_join_request(
  request_uuid uuid,
  admin_uuid uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id uuid;
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get request details
  SELECT group_id, user_id INTO v_group_id, v_user_id
  FROM group_join_requests
  WHERE id = request_uuid AND status = 'pending';
  
  IF v_group_id IS NULL THEN
    RETURN false; -- Request not found or not pending
  END IF;
  
  -- Check if admin has permission
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = v_group_id AND user_id = admin_uuid AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN false; -- Not an admin
  END IF;
  
  -- Update request status
  UPDATE group_join_requests
  SET status = 'rejected', updated_at = now()
  WHERE id = request_uuid;
  
  -- Create notification for the user
  INSERT INTO notifications (
    user_id,
    type,
    content,
    reference_id,
    read
  )
  VALUES (
    v_user_id,
    'group_join_rejected',
    (SELECT 'Your request to join ' || name || ' has been rejected' FROM groups WHERE id = v_group_id),
    v_group_id,
    false
  );
  
  RETURN true;
END;
$$;

-- Create function to create a group with the creator as admin
CREATE OR REPLACE FUNCTION create_group_with_admin(
  p_name text,
  p_description text,
  p_avatar text,
  p_is_private boolean,
  p_creator_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  -- Insert new group
  INSERT INTO groups (
    name,
    description,
    avatar,
    is_private,
    created_by,
    created_at,
    updated_at,
    member_count
  )
  VALUES (
    p_name,
    p_description,
    p_avatar,
    p_is_private,
    p_creator_id,
    now(),
    now(),
    1
  )
  RETURNING id INTO v_group_id;
  
  -- Add creator as admin
  INSERT INTO group_members (
    group_id,
    user_id,
    role,
    joined_at
  )
  VALUES (
    v_group_id,
    p_creator_id,
    'admin',
    now()
  );
  
  RETURN v_group_id;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_group_suggestions(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_members_with_profiles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_join_requests_with_profiles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_messages_with_profiles(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_group_join_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_group_join_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_group_with_admin(text, text, text, boolean, uuid) TO authenticated;

-- Create trigger to update groups.updated_at when a message is sent
CREATE OR REPLACE FUNCTION update_group_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE groups
  SET updated_at = now()
  WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_group_updated_at
AFTER INSERT ON group_messages
FOR EACH ROW
EXECUTE FUNCTION update_group_updated_at();

-- Create function to generate dynamic sitemap
CREATE OR REPLACE FUNCTION generate_sitemap()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sitemap text;
BEGIN
  sitemap := '<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
';

  -- Add static pages
  sitemap := sitemap || '  <url>
    <loc>https://socialchat.site/</loc>
    <lastmod>' || to_char(now(), 'YYYY-MM-DD') || '</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
';

  -- Add dynamic pages from SEO metadata
  FOR i IN (SELECT * FROM seo_metadata ORDER BY page_path) LOOP
    sitemap := sitemap || '  <url>
    <loc>https://socialchat.site' || i.page_path || '</loc>
    <lastmod>' || to_char(i.updated_at, 'YYYY-MM-DD') || '</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
';
  END LOOP;

  sitemap := sitemap || '</urlset>';
  
  RETURN sitemap;
END;
$$;

-- Insert default SEO metadata
INSERT INTO public.seo_metadata (page_path, title, description, keywords, og_image, canonical_url)
VALUES 
  ('/', 'SocialChat - Real-time Social Messaging Platform | Connect with Friends', 'Join SocialChat - the ultimate real-time social messaging platform. Connect with friends, share posts and stories, chat instantly, build your social network.', ARRAY['social media', 'chat app', 'messaging platform', 'real-time chat'], 'https://socialchat.site/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png', 'https://socialchat.site/'),
  ('/login', 'Login to SocialChat | Secure Access to Your Account', 'Sign in to your SocialChat account to connect with friends, send messages, and share updates in real-time.', ARRAY['login', 'sign in', 'account access', 'social media login'], 'https://socialchat.site/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png', 'https://socialchat.site/login'),
  ('/register', 'Create a SocialChat Account | Join Our Community', 'Sign up for SocialChat to connect with friends, share moments, and join our growing community of users.', ARRAY['register', 'sign up', 'create account', 'join social network'], 'https://socialchat.site/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png', 'https://socialchat.site/register'),
  ('/vortex', 'Vortex Group Chat | Private Group Messaging on SocialChat', 'Join private group chats with Vortex on SocialChat. Create groups, invite friends, and enjoy secure group messaging.', ARRAY['group chat', 'private groups', 'team messaging', 'chat rooms'], 'https://socialchat.site/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png', 'https://socialchat.site/vortex')
ON CONFLICT (page_path) DO UPDATE
SET 
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  keywords = EXCLUDED.keywords,
  og_image = EXCLUDED.og_image,
  canonical_url = EXCLUDED.canonical_url,
  updated_at = now();

-- Update table statistics for better query planning
ANALYZE public.notifications;
ANALYZE public.story_views;
ANALYZE public.groups;
ANALYZE public.group_members;
ANALYZE public.group_join_requests;
ANALYZE public.group_messages;
ANALYZE public.seo_metadata;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';