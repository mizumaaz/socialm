import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StoryViewer } from './StoryViewer';
import { AddStoryDialog } from './AddStoryDialog';
import { ProfilePictureViewer } from './ProfilePictureViewer';

interface Story {
  id: string;
  user_id: string;
  image_url: string | null;
  photo_urls: string[] | null;
  photo_metadata: any[] | null;
  created_at: string;
  expires_at: string;
  views_count: number;
  viewed_by_current_user: boolean;
  profiles: {
    name: string;
    username: string;
    avatar: string | null;
  };
}

const StoriesContainer = React.memo(() => {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showProfilePicture, setShowProfilePicture] = useState<{
    show: boolean;
    user: any;
    showConfirm: boolean;
  }>({ show: false, user: null, showConfirm: false });
  const [loading, setLoading] = useState(true);
  const [viewedStories, setViewedStories] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchStories = useCallback(async () => {
    try {
      // First cleanup expired photos
      await supabase.rpc('cleanup_expired_story_photos');

      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          profiles:user_id (
            name,
            username,
            avatar
          )
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group stories by user and keep only the latest story per user
      const groupedStories = data?.reduce((acc: Record<string, Story>, story: any) => {
        if (!acc[story.user_id] || new Date(story.created_at) > new Date(acc[story.user_id].created_at)) {
          acc[story.user_id] = {
            ...story,
            viewed_by_current_user: viewedStories.has(story.id)
          };
        }
        return acc;
      }, {});

      const storiesArray = Object.values(groupedStories || {});
      
      // Sort stories: unseen stories first, then seen stories
      const sortedStories = storiesArray.sort((a, b) => {
        // If one is viewed and other is not, prioritize unviewed
        if (a.viewed_by_current_user !== b.viewed_by_current_user) {
          return a.viewed_by_current_user ? 1 : -1;
        }
        // If both have same view status, sort by creation time (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setStories(sortedStories);
    } catch (error) {
      console.error('Error fetching stories:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load stories',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, viewedStories]);

  const getCurrentUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setCurrentUser(profile);

      // Load viewed stories from localStorage
      const viewedStoriesKey = `viewed_stories_${user.id}`;
      const savedViewedStories = localStorage.getItem(viewedStoriesKey);
      if (savedViewedStories) {
        setViewedStories(new Set(JSON.parse(savedViewedStories)));
      }
    }
  }, []);

  useEffect(() => {
    getCurrentUser();
    fetchStories();
    
    // Set up realtime subscription for stories with more granular updates
    const channel = supabase
      .channel('stories-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stories'
        },
        (payload) => {
          console.log('Story change detected:', payload);
          // Optimistic update for better performance
          if (payload.eventType === 'INSERT') {
            fetchStories();
          } else if (payload.eventType === 'UPDATE') {
            setStories(prevStories => 
              prevStories.map(story => 
                story.id === payload.new.id 
                  ? { ...story, ...payload.new }
                  : story
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setStories(prevStories => 
              prevStories.filter(story => story.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [getCurrentUser, fetchStories]);

  const handleStoryClick = useCallback(async (story: Story) => {
    setSelectedStory(story);
    
    // Mark story as viewed
    if (story.user_id !== currentUser?.id && !viewedStories.has(story.id)) {
      try {
        const { data, error } = await supabase.rpc('increment_story_views', {
          story_uuid: story.id,
          viewer_uuid: currentUser?.id
        });
        
        if (error) {
          console.error('Error tracking story view:', error);
        } else {
          // Update local viewed stories
          const newViewedStories = new Set(viewedStories);
          newViewedStories.add(story.id);
          setViewedStories(newViewedStories);

          // Save to localStorage
          if (currentUser) {
            const viewedStoriesKey = `viewed_stories_${currentUser.id}`;
            localStorage.setItem(viewedStoriesKey, JSON.stringify(Array.from(newViewedStories)));
          }

          // Update local state with new view count and viewed status
          setStories(prevStories => 
            prevStories.map(s => 
              s.id === story.id 
                ? { 
                    ...s, 
                    views_count: data || s.views_count + 1,
                    viewed_by_current_user: true
                  }
                : s
            )
          );

          // Re-sort stories after marking as viewed
          setTimeout(() => {
            setStories(prevStories => {
              return [...prevStories].sort((a, b) => {
                // If one is viewed and other is not, prioritize unviewed
                if (a.viewed_by_current_user !== b.viewed_by_current_user) {
                  return a.viewed_by_current_user ? 1 : -1;
                }
                // If both have same view status, sort by creation time (newest first)
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });
            });
          }, 100);
        }
      } catch (error) {
        console.error('Error tracking story view:', error);
      }
    }
  }, [currentUser?.id, viewedStories, currentUser]);

  const userStory = useMemo(() => {
    return stories.find(story => story.user_id === currentUser?.id);
  }, [stories, currentUser?.id]);

  const otherStories = useMemo(() => {
    return stories.filter(story => story.user_id !== currentUser?.id);
  }, [stories, currentUser?.id]);

  const handleAddStory = useCallback(() => {
    setShowAddDialog(true);
  }, []);

  const handleStoryAdded = useCallback(() => {
    fetchStories();
  }, [fetchStories]);

  if (loading) {
    return (
      <div className="flex gap-2 p-3 overflow-x-auto">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1 min-w-[60px]">
            <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
            <div className="w-8 h-2 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2 p-3 overflow-x-auto bg-background border-b scroll-smooth">
        {/* Add Story Button */}
        <div className="flex flex-col items-center gap-1 min-w-[60px]">
          <div className="relative">
            <Avatar className={`w-12 h-12 border-2 cursor-pointer transition-all duration-200 ${
              userStory 
                ? 'border-social-green hover:border-social-light-green hover:scale-105' 
                : 'border-dashed border-social-green hover:border-social-light-green hover:scale-105'
            }`}>
              {currentUser?.avatar ? (
                <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
              ) : (
                <AvatarFallback className="bg-social-dark-green text-white font-pixelated text-xs">
                  {currentUser?.name?.substring(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              )}
            </Avatar>
            <Button
              size="icon"
              onClick={handleAddStory}
              className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-social-green hover:bg-social-light-green text-white transition-all duration-200 hover:scale-110"
            >
              <Plus className="h-2 w-2" />
            </Button>
          </div>
          <span className="text-xs font-pixelated text-center">
            {userStory ? 'Your Story' : 'Add Story'}
          </span>
        </div>

        {/* User's own story (if exists) */}
        {userStory && (
          <div
            className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer group"
            onClick={() => handleStoryClick(userStory)}
          >
            <div className="relative">
              <Avatar className="w-12 h-12 border-2 border-social-green hover:border-social-light-green transition-all duration-200 group-hover:scale-105">
                {userStory.profiles.avatar ? (
                  <AvatarImage src={userStory.profiles.avatar} alt={userStory.profiles.name} />
                ) : (
                  <AvatarFallback className="bg-social-dark-green text-white font-pixelated text-xs">
                    {userStory.profiles.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-social-green to-social-blue opacity-20" />
            </div>
            <span className="text-xs font-pixelated text-center truncate max-w-[60px]">
              You
            </span>
          </div>
        )}

        {/* Other Stories */}
        {otherStories.map((story) => {
          const isViewed = viewedStories.has(story.id);
          
          return (
            <div
              key={story.id}
              className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer group"
              onClick={() => handleStoryClick(story)}
            >
              <div className="relative">
                <Avatar className={`w-12 h-12 border-2 transition-all duration-200 group-hover:scale-105 ${
                  isViewed 
                    ? 'border-gray-300 hover:border-gray-400' 
                    : 'border-social-green hover:border-social-light-green'
                }`}>
                  {story.profiles.avatar ? (
                    <AvatarImage src={story.profiles.avatar} alt={story.profiles.name} />
                  ) : (
                    <AvatarFallback className="bg-social-dark-green text-white font-pixelated text-xs">
                      {story.profiles.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                
                {/* Green dot for unseen stories */}
                {!isViewed && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-social-green rounded-full border-2 border-white animate-pulse">
                    <div className="w-full h-full bg-social-green rounded-full animate-ping opacity-75"></div>
                  </div>
                )}
                
                {/* Gradient overlay for viewed stories */}
                {isViewed && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gray-400 to-gray-500 opacity-20" />
                )}
                
                {/* Gradient overlay for unviewed stories */}
                {!isViewed && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-social-green to-social-blue opacity-20" />
                )}
              </div>
              <span className={`text-xs font-pixelated text-center truncate max-w-[60px] ${
                isViewed ? 'text-muted-foreground' : 'text-foreground'
              }`}>
                {story.profiles.name.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Story Viewer */}
      {selectedStory && (
        <StoryViewer
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
          currentUserId={currentUser?.id}
          onStoryUpdated={handleStoryAdded}
        />
      )}

      {/* Add Story Dialog */}
      <AddStoryDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onStoryAdded={handleStoryAdded}
        currentUser={currentUser}
        existingStory={userStory}
      />

      {/* Profile Picture Viewer */}
      <ProfilePictureViewer
        show={showProfilePicture.show}
        showConfirm={showProfilePicture.showConfirm}
        user={showProfilePicture.user}
        onConfirm={() => setShowProfilePicture(prev => ({ 
          show: true, 
          user: prev.user, 
          showConfirm: false 
        }))}
        onClose={() => setShowProfilePicture({ show: false, user: null, showConfirm: false })}
      />
    </>
  );
});

StoriesContainer.displayName = 'StoriesContainer';

export { StoriesContainer };