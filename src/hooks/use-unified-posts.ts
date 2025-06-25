import { useState, useEffect, useCallback } from 'react';
import { firebasePostService, UnifiedPost, FirebasePost, SupabasePost } from '@/services/firebaseService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useUnifiedPosts() {
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  // Get current user
  const getCurrentUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setCurrentUser(profile);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  }, []);

  // Fetch Supabase posts (existing posts)
  const fetchSupabasePosts = useCallback(async (): Promise<SupabasePost[]> => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          image_url,
          created_at,
          updated_at,
          user_id,
          profiles:user_id (
            name,
            username,
            avatar
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Fetch likes and comments for each post
      const postsWithInteractions = await Promise.all(
        (data || []).map(async (post) => {
          const [likesData, commentsData] = await Promise.all([
            supabase
              .from('likes')
              .select('id, user_id')
              .eq('post_id', post.id),
            supabase
              .from('comments')
              .select(`
                id,
                content,
                created_at,
                user_id,
                profiles:user_id (
                  name,
                  avatar
                )
              `)
              .eq('post_id', post.id)
              .order('created_at', { ascending: true })
          ]);

          return {
            ...post,
            likes: likesData.data || [],
            comments: commentsData.data || [],
            _count: {
              likes: likesData.data?.length || 0,
              comments: commentsData.data?.length || 0
            },
            source: 'supabase' as const
          };
        })
      );

      return postsWithInteractions;
    } catch (error) {
      console.error('Error fetching Supabase posts:', error);
      return [];
    }
  }, []);

  // Combine and sort posts from both sources
  const combineAndSortPosts = useCallback((firebasePosts: FirebasePost[], supabasePosts: SupabasePost[]): UnifiedPost[] => {
    const allPosts: UnifiedPost[] = [...firebasePosts, ...supabasePosts];
    
    return allPosts.sort((a, b) => {
      const timeA = a.source === 'firebase' 
        ? (a as FirebasePost).created_at.toDate().getTime()
        : new Date((a as SupabasePost).created_at).getTime();
      
      const timeB = b.source === 'firebase'
        ? (b as FirebasePost).created_at.toDate().getTime()
        : new Date((b as SupabasePost).created_at).getTime();
      
      return timeB - timeA; // Most recent first
    });
  }, []);

  // Load all posts
  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      
      const [firebasePosts, supabasePosts] = await Promise.all([
        firebasePostService.getPosts(),
        fetchSupabasePosts()
      ]);

      const combinedPosts = combineAndSortPosts(firebasePosts, supabasePosts);
      setPosts(combinedPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load posts'
      });
    } finally {
      setLoading(false);
    }
  }, [combineAndSortPosts, fetchSupabasePosts, toast]);

  // Create new post (Firebase first, Supabase fallback)
  const createPost = useCallback(async (content: string, imageFile: File | null = null) => {
    if (!currentUser) throw new Error('User not authenticated');

    try {
      await firebasePostService.createPost(content, imageFile, {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        avatar: currentUser.avatar
      });

      toast({
        title: 'Success',
        description: 'Your post has been shared!'
      });

      // Refresh posts to show the new one
      await loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create post'
      });
      throw error;
    }
  }, [currentUser, loadPosts, toast]);

  // Toggle like
  const toggleLike = useCallback(async (postId: string, isFirebasePost: boolean) => {
    if (!currentUser) return;

    try {
      if (isFirebasePost) {
        await firebasePostService.toggleLike(postId, currentUser.id);
      } else {
        // Handle Supabase likes
        const existingLike = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', currentUser.id)
          .single();

        if (existingLike.data) {
          await supabase
            .from('likes')
            .delete()
            .eq('id', existingLike.data.id);
        } else {
          await supabase
            .from('likes')
            .insert({
              post_id: postId,
              user_id: currentUser.id
            });
        }
      }

      // Refresh posts to show updated likes
      await loadPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [currentUser, loadPosts]);

  // Add comment
  const addComment = useCallback(async (postId: string, content: string, isFirebasePost: boolean) => {
    if (!currentUser) return;

    try {
      if (isFirebasePost) {
        await firebasePostService.addComment(postId, content, {
          id: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar
        });
      } else {
        // Handle Supabase comments
        await supabase
          .from('comments')
          .insert({
            post_id: postId,
            user_id: currentUser.id,
            content
          });
      }

      // Refresh posts to show new comment
      await loadPosts();
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }, [currentUser, loadPosts]);

  // Set up real-time subscriptions
  useEffect(() => {
    getCurrentUser();
  }, [getCurrentUser]);

  useEffect(() => {
    if (currentUser) {
      loadPosts();

      // Set up Firebase real-time subscription
      const unsubscribeFirebase = firebasePostService.subscribeToRealTimeUpdates((firebasePosts) => {
        // Combine with existing Supabase posts
        fetchSupabasePosts().then((supabasePosts) => {
          const combinedPosts = combineAndSortPosts(firebasePosts, supabasePosts);
          setPosts(combinedPosts);
        });
      });

      // Set up Supabase real-time subscription for existing posts
      const supabaseChannel = supabase
        .channel('posts-realtime')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'posts' }, 
          () => {
            // Refresh when Supabase posts change
            loadPosts();
          }
        )
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'likes' }, 
          () => {
            loadPosts();
          }
        )
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'comments' }, 
          () => {
            loadPosts();
          }
        )
        .subscribe();

      return () => {
        unsubscribeFirebase();
        supabase.removeChannel(supabaseChannel);
      };
    }
  }, [currentUser, loadPosts, fetchSupabasePosts, combineAndSortPosts]);

  return {
    posts,
    loading,
    currentUser,
    createPost,
    toggleLike,
    addComment,
    refreshPosts: loadPosts
  };
}