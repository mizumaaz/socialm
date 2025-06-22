import React, { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CommunityFeed } from '@/components/dashboard/CommunityFeed';
import { StoriesContainer } from '@/components/stories/StoriesContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Send, Image as ImageIcon, X, MessageSquareOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

export function Dashboard() {
  const [postContent, setPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [feedKey, setFeedKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const postBoxRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Listen for scroll to top event with improved implementation
  useEffect(() => {
    const handleScrollToTop = () => {
      console.log('Scroll to top event received');
      if (scrollAreaRef.current) {
        // Scroll to the very top of the scroll area
        scrollAreaRef.current.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
        console.log('Scrolled to top');
      }
    };

    // Listen for both custom event and direct function call
    window.addEventListener('scrollToTop', handleScrollToTop);
    
    // Also expose function globally for direct access
    (window as any).scrollDashboardToTop = handleScrollToTop;
    
    return () => {
      window.removeEventListener('scrollToTop', handleScrollToTop);
      delete (window as any).scrollDashboardToTop;
    };
  }, []);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please select an image file'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please select an image smaller than 5MB'
      });
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePost = async () => {
    if ((!postContent.trim() && !selectedImage) || isPosting) return;

    try {
      setIsPosting(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'You must be logged in to post'
        });
        return;
      }

      let imageUrl = null;

      // Upload image if selected
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, selectedImage);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
      }

      // Create post data with backward compatibility
      const postData: any = {
        content: postContent.trim(),
        user_id: user.id,
        image_url: imageUrl
      };

      // Only add comments_enabled if the column exists
      try {
        // Try to insert with comments_enabled first
        const { error } = await supabase
          .from('posts')
          .insert({
            ...postData,
            comments_enabled: commentsEnabled
          });

        if (error) {
          // If it fails due to column not existing, try without it
          if (error.message?.includes('comments_enabled')) {
            const { error: fallbackError } = await supabase
              .from('posts')
              .insert(postData);
            
            if (fallbackError) throw fallbackError;
          } else {
            throw error;
          }
        }
      } catch (error) {
        throw error;
      }

      setPostContent('');
      setCommentsEnabled(true); // Reset to default
      removeImage();
      
      // Force feed refresh by updating key - this will trigger CommunityFeed to re-mount
      setFeedKey(prev => prev + 1);
      
      toast({
        title: 'Success',
        description: commentsEnabled 
          ? 'Your post has been shared!' 
          : 'Your post has been shared with comments disabled!'
      });
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create post'
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto relative h-[calc(100vh-60px)]">
        {/* Stories Container - Fixed at top */}
        <StoriesContainer />
        
        {/* Scrollable Content Area */}
        <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-180px)] px-2 scroll-smooth">
          {/* Post Box */}
          <Card ref={postBoxRef} className="mb-4 card-gradient animate-fade-in shadow-lg border-2 border-social-green/10 card-hover">
            <CardContent className="p-4">
              <div className="space-y-4">
                <Textarea
                  placeholder="What's on your mind? Share your thoughts..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full min-h-[80px] max-h-[160px] font-pixelated text-sm resize-none focus:ring-2 focus:ring-social-green/20 transition-all duration-200"
                  disabled={isPosting}
                />
                
                {/* Image Preview */}
                {imagePreview && (
                  <div className="relative rounded-lg overflow-hidden border border-social-green/20">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-60 w-full object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-lg hover:scale-105 transition-transform"
                      onClick={removeImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Comments Toggle */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-muted">
                  <div className="flex items-center gap-3">
                    <MessageSquareOff className={`h-4 w-4 ${commentsEnabled ? 'text-muted-foreground' : 'text-orange-500'}`} />
                    <div>
                      <Label htmlFor="comments-toggle" className="font-pixelated text-xs font-medium cursor-pointer">
                        {commentsEnabled ? 'Comments Enabled' : 'Comments Disabled'}
                      </Label>
                      <p className="font-pixelated text-xs text-muted-foreground">
                        {commentsEnabled 
                          ? 'People can comment on this post' 
                          : 'Comments are disabled for this post'
                        }
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="comments-toggle"
                    checked={commentsEnabled}
                    onCheckedChange={setCommentsEnabled}
                    disabled={isPosting}
                    className="data-[state=checked]:bg-social-green"
                  />
                </div>
                
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 font-pixelated text-xs hover:bg-social-green/5 transition-colors btn-hover-lift"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isPosting}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Add Image
                    </Button>
                    <p className="text-xs text-muted-foreground font-pixelated hidden sm:block">
                      Press Enter to post
                    </p>
                  </div>
                  <Button
                    onClick={handlePost}
                    disabled={(!postContent.trim() && !selectedImage) || isPosting}
                    size="sm"
                    className="bg-social-green hover:bg-social-light-green text-white font-pixelated h-9 px-4 btn-hover-lift transition-all duration-200"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isPosting ? 'Posting...' : 'Share Post'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Feed with key-based refresh for seamless updates */}
          <CommunityFeed key={feedKey} />
        </ScrollArea>
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;