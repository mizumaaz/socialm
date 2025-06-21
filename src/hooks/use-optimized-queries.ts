import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOptimizedQueries() {
  // Optimized feed fetching with reduced database load
  const fetchOptimizedFeed = useCallback(async (limit = 20, offset = 0) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_user_feed', {
        user_uuid: user.id,
        feed_limit: limit,
        feed_offset: offset
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching optimized feed:', error);
      return [];
    }
  }, []);

  // Optimized like toggle with batch operations
  const toggleLikeOptimized = useCallback(async (postId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase.rpc('toggle_post_like', {
        post_uuid: postId,
        user_uuid: user.id
      });

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error toggling like:', error);
      return null;
    }
  }, []);

  // Optimized friend suggestions
  const getFriendSuggestions = useCallback(async (limit = 10) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_friend_suggestions', {
        user_uuid: user.id,
        suggestion_limit: limit
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching friend suggestions:', error);
      return [];
    }
  }, []);

  // Batch notification creation
  const createNotificationsBatch = useCallback(async (notifications: any[]) => {
    try {
      const { error } = await supabase.rpc('create_notification_batch', {
        notifications_data: notifications
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error creating notifications batch:', error);
      return false;
    }
  }, []);

  // Optimized story fetching with view tracking
  const fetchStoriesOptimized = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id,
          user_id,
          image_url,
          photo_urls,
          created_at,
          expires_at,
          views_count,
          profiles:user_id (
            name,
            username,
            avatar
          )
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching optimized stories:', error);
      return [];
    }
  }, []);

  // Optimized message fetching with pagination
  const fetchMessagesOptimized = useCallback(async (friendId: string, limit = 50, offset = 0) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          created_at,
          read,
          profiles!messages_sender_id_fkey(name, avatar)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return (data || []).reverse(); // Reverse to show oldest first
    } catch (error) {
      console.error('Error fetching optimized messages:', error);
      return [];
    }
  }, []);

  return {
    fetchOptimizedFeed,
    toggleLikeOptimized,
    getFriendSuggestions,
    createNotificationsBatch,
    fetchStoriesOptimized,
    fetchMessagesOptimized
  };
}