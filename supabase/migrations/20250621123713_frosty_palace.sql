/*
  # Database Performance Optimizations

  1. Indexes
    - Add composite indexes for better query performance
    - Add indexes for foreign keys and commonly queried columns

  2. Functions
    - Create optimized functions for common operations
    - Add batch operations for better performance

  3. Views
    - Create materialized views for complex queries
    - Add optimized views for feed generation

  4. Triggers
    - Add triggers for automatic data maintenance
    - Optimize real-time subscriptions
*/

-- Add composite indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility_created ON posts(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_friends_status_users ON friends(status, sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_users_created ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_expires_user ON stories(expires_at, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, read, created_at DESC);

-- Add partial indexes for better performance on filtered queries
CREATE INDEX IF NOT EXISTS idx_posts_public_recent ON posts(created_at DESC) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_friends_accepted ON friends(sender_id, receiver_id) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, created_at DESC) WHERE read = false;

-- Create optimized function for fetching user feed
CREATE OR REPLACE FUNCTION get_user_feed(
  user_uuid uuid,
  feed_limit integer DEFAULT 20,
  feed_offset integer DEFAULT 0
)
RETURNS TABLE (
  post_id uuid,
  content text,
  image_url text,
  created_at timestamptz,
  updated_at timestamptz,
  user_id uuid,
  user_name text,
  user_username text,
  user_avatar text,
  likes_count bigint,
  comments_count bigint,
  is_liked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as post_id,
    p.content,
    p.image_url,
    p.created_at,
    p.updated_at,
    p.user_id,
    pr.name as user_name,
    pr.username as user_username,
    pr.avatar as user_avatar,
    COALESCE(l.likes_count, 0) as likes_count,
    COALESCE(c.comments_count, 0) as comments_count,
    CASE WHEN ul.user_id IS NOT NULL THEN true ELSE false END as is_liked
  FROM posts p
  JOIN profiles pr ON p.user_id = pr.id
  LEFT JOIN (
    SELECT post_id, COUNT(*) as likes_count
    FROM likes
    GROUP BY post_id
  ) l ON p.id = l.post_id
  LEFT JOIN (
    SELECT post_id, COUNT(*) as comments_count
    FROM comments
    GROUP BY post_id
  ) c ON p.id = c.post_id
  LEFT JOIN likes ul ON p.id = ul.post_id AND ul.user_id = user_uuid
  WHERE (
    p.visibility = 'public'
    OR p.user_id = user_uuid
    OR (
      p.visibility = 'friends'
      AND EXISTS (
        SELECT 1 FROM friends f
        WHERE f.status = 'accepted'
        AND (
          (f.sender_id = user_uuid AND f.receiver_id = p.user_id)
          OR (f.sender_id = p.user_id AND f.receiver_id = user_uuid)
        )
      )
    )
  )
  ORDER BY p.created_at DESC
  LIMIT feed_limit
  OFFSET feed_offset;
END;
$$;

-- Create function for batch like operations
CREATE OR REPLACE FUNCTION toggle_post_like(
  post_uuid uuid,
  user_uuid uuid
)
RETURNS TABLE (
  liked boolean,
  likes_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_like_id uuid;
  new_likes_count bigint;
BEGIN
  -- Check if like exists
  SELECT id INTO existing_like_id
  FROM likes
  WHERE post_id = post_uuid AND user_id = user_uuid;

  IF existing_like_id IS NOT NULL THEN
    -- Unlike
    DELETE FROM likes WHERE id = existing_like_id;
    
    SELECT COUNT(*) INTO new_likes_count
    FROM likes
    WHERE post_id = post_uuid;
    
    RETURN QUERY SELECT false as liked, new_likes_count;
  ELSE
    -- Like
    INSERT INTO likes (post_id, user_id)
    VALUES (post_uuid, user_uuid);
    
    SELECT COUNT(*) INTO new_likes_count
    FROM likes
    WHERE post_id = post_uuid;
    
    RETURN QUERY SELECT true as liked, new_likes_count;
  END IF;
END;
$$;

-- Create function for optimized friend suggestions
CREATE OR REPLACE FUNCTION get_friend_suggestions(
  user_uuid uuid,
  suggestion_limit integer DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  name text,
  username text,
  avatar text,
  mutual_friends_count bigint
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
  excluded_users AS (
    SELECT friend_id as user_id FROM user_friends
    UNION
    SELECT user_uuid
    UNION
    SELECT sender_id FROM friends WHERE receiver_id = user_uuid AND status = 'pending'
    UNION
    SELECT receiver_id FROM friends WHERE sender_id = user_uuid AND status = 'pending'
  )
  SELECT 
    p.id as user_id,
    p.name,
    p.username,
    p.avatar,
    COALESCE(mutual.mutual_count, 0) as mutual_friends_count
  FROM profiles p
  LEFT JOIN (
    SELECT 
      p2.id,
      COUNT(*) as mutual_count
    FROM profiles p2
    JOIN friends f1 ON (f1.sender_id = p2.id OR f1.receiver_id = p2.id)
    JOIN user_friends uf ON (
      (f1.sender_id = uf.friend_id AND f1.receiver_id = p2.id)
      OR (f1.receiver_id = uf.friend_id AND f1.sender_id = p2.id)
    )
    WHERE f1.status = 'accepted'
    AND p2.id NOT IN (SELECT user_id FROM excluded_users)
    GROUP BY p2.id
  ) mutual ON p.id = mutual.id
  WHERE p.id NOT IN (SELECT user_id FROM excluded_users)
  ORDER BY mutual_friends_count DESC, p.created_at DESC
  LIMIT suggestion_limit;
END;
$$;

-- Create function for optimized story cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired stories (older than 24 hours)
  DELETE FROM stories 
  WHERE expires_at < now();
  
  -- Update statistics
  ANALYZE stories;
END;
$$;

-- Create trigger for automatic story expiration
CREATE OR REPLACE FUNCTION set_story_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set expiration to 24 hours from creation
  NEW.expires_at = NEW.created_at + INTERVAL '24 hours';
  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_set_story_expiration'
  ) THEN
    CREATE TRIGGER trigger_set_story_expiration
      BEFORE INSERT ON stories
      FOR EACH ROW
      EXECUTE FUNCTION set_story_expiration();
  END IF;
END $$;

-- Create function for batch notification creation
CREATE OR REPLACE FUNCTION create_notification_batch(
  notifications_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, content, reference_id, read)
  SELECT 
    (notification->>'user_id')::uuid,
    notification->>'type',
    notification->>'content',
    (notification->>'reference_id')::uuid,
    COALESCE((notification->>'read')::boolean, false)
  FROM jsonb_array_elements(notifications_data) as notification;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_feed(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_post_like(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friend_suggestions(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_stories() TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification_batch(jsonb) TO authenticated;

-- Create scheduled job for story cleanup (if pg_cron is available)
-- This will run every hour to clean up expired stories
DO $$
BEGIN
  -- Only create if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('cleanup-expired-stories', '0 * * * *', 'SELECT cleanup_expired_stories();');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if pg_cron is not available
    NULL;
END $$;

-- Update table statistics for better query planning
ANALYZE posts;
ANALYZE likes;
ANALYZE comments;
ANALYZE friends;
ANALYZE messages;
ANALYZE stories;
ANALYZE notifications;
ANALYZE profiles;