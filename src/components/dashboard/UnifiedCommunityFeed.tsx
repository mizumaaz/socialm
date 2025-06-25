import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageCircle, Send, ChevronDown, ChevronUp, X, Image as ImageIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ImageViewer } from '@/components/ui/image-viewer';
import { UserProfileDialog } from '@/components/user/UserProfileDialog';
import { useUnifiedPosts } from '@/hooks/use-unified-posts';
import { UnifiedPost, FirebasePost, SupabasePost } from '@/services/firebaseService';

export function UnifiedCommunityFeed() {
  const { posts, loading, currentUser, createPost, toggleLike, addComment } = useUnifiedPosts();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});
  const [submittingComments, setSubmittingComments] = useState<{ [key: string]: boolean }>({});
  const [expandedComments, setExpandedComments] = useState<{ [key: string]: boolean }>({});
  const [showCommentBox, setShowCommentBox] = useState<{ [key: string]: boolean }>({});
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  
  // Post creation state
  const [postContent, setPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    setSelectedImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePost = async () => {
    if ((!postContent.trim() && !selectedImageFile) || isPosting) return;

    try {
      setIsPosting(true);
      await createPost(postContent, selectedImageFile);
      
      setPostContent('');
      removeImage();
    } catch (error) {
      console.error('Error creating post:', error);
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

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const toggleCommentBox = (postId: string) => {
    setShowCommentBox(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
    
    if (!showCommentBox[postId]) {
      setExpandedComments(prev => ({
        ...prev,
        [postId]: true
      }));
    }
  };

  const handleComment = async (postId: string, isFirebasePost: boolean) => {
    const content = commentInputs[postId]?.trim();
    if (!content || submittingComments[postId]) return;

    try {
      setSubmittingComments(prev => ({ ...prev, [postId]: true }));
      await addComment(postId, content, isFirebasePost);
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setExpandedComments(prev => ({ ...prev, [postId]: true }));
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleLike = async (postId: string, isFirebasePost: boolean) => {
    if (!currentUser) return;
    await toggleLike(postId, isFirebasePost);
  };

  const formatPostTime = (post: UnifiedPost) => {
    if (post.source === 'firebase') {
      const firebasePost = post as FirebasePost;
      return formatDistanceToNow(firebasePost.created_at.toDate(), { addSuffix: true });
    } else {
      const supabasePost = post as SupabasePost;
      return formatDistanceToNow(new Date(supabasePost.created_at), { addSuffix: true });
    }
  };

  const getPostUser = (post: UnifiedPost) => {
    if (post.source === 'firebase') {
      const firebasePost = post as FirebasePost;
      return {
        name: firebasePost.user_name,
        username: firebasePost.user_username,
        avatar: firebasePost.user_avatar
      };
    } else {
      const supabasePost = post as SupabasePost;
      return {
        name: supabasePost.profiles.name,
        username: supabasePost.profiles.username,
        avatar: supabasePost.profiles.avatar
      };
    }
  };

  const getPostLikes = (post: UnifiedPost) => {
    if (post.source === 'firebase') {
      const firebasePost = post as FirebasePost;
      return {
        count: firebasePost.likes?.length || 0,
        isLiked: firebasePost.likes?.includes(currentUser?.id) || false
      };
    } else {
      const supabasePost = post as SupabasePost;
      return {
        count: supabasePost._count?.likes || 0,
        isLiked: supabasePost.likes?.some(like => like.user_id === currentUser?.id) || false
      };
    }
  };

  const getPostComments = (post: UnifiedPost) => {
    if (post.source === 'firebase') {
      const firebasePost = post as FirebasePost;
      return {
        count: firebasePost.comments?.length || 0,
        comments: firebasePost.comments || []
      };
    } else {
      const supabasePost = post as SupabasePost;
      return {
        count: supabasePost._count?.comments || 0,
        comments: supabasePost.comments || []
      };
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-muted rounded mb-2" />
                  <div className="h-3 w-16 bg-muted rounded" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-4 w-full bg-muted rounded mb-2" />
              <div className="h-4 w-3/4 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Post Creation Box */}
      <Card className="card-gradient animate-fade-in shadow-lg border-2 border-social-green/10 card-hover">
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
                disabled={(!postContent.trim() && !selectedImageFile) || isPosting}
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

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-pixelated text-sm font-medium mb-2">No posts yet</h3>
            <p className="font-pixelated text-xs text-muted-foreground max-w-sm leading-relaxed mx-auto">
              Be the first to share something with the community!
            </p>
          </CardContent>
        </Card>
      ) : (
        posts.map((post) => {
          const user = getPostUser(post);
          const likes = getPostLikes(post);
          const comments = getPostComments(post);
          const hasComments = comments.comments.length > 0;
          const commentsExpanded = expandedComments[post.id!];
          const commentBoxVisible = showCommentBox[post.id!];
          const isFirebasePost = post.source === 'firebase';

          return (
            <Card key={post.id} className="card-gradient animate-fade-in shadow-lg hover:shadow-xl transition-all duration-200 card-hover">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-social-green/20 cursor-pointer hover:scale-105 transition-transform">
                      {user.avatar ? (
                        <AvatarImage src={user.avatar} alt={user.name} />
                      ) : (
                        <AvatarFallback className="bg-social-dark-green text-white font-pixelated text-xs">
                          {user.name?.substring(0, 2).toUpperCase() || 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <p className="font-pixelated text-xs font-medium">
                        {user.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="font-pixelated text-xs text-muted-foreground">
                          @{user.username} • {formatPostTime(post)}
                        </p>
                        {isFirebasePost && (
                          <span className="bg-blue-100 text-blue-800 text-xs font-pixelated px-1 py-0.5 rounded">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <p className="font-pixelated text-xs mb-4 leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>
                
                {post.image_url && (
                  <div className="mb-4">
                    <img
                      src={post.image_url}
                      alt="Post image"
                      className="w-full max-h-96 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setSelectedImage(post.image_url!)}
                    />
                  </div>
                )}
                
                <div className="flex items-center gap-4 pt-3 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLike(post.id!, isFirebasePost)}
                    className={`font-pixelated text-xs hover:bg-social-magenta/10 transition-all duration-200 btn-hover-lift ${
                      likes.isLiked ? 'text-social-magenta' : 'text-muted-foreground'
                    }`}
                  >
                    <Heart className={`h-4 w-4 mr-1 ${likes.isLiked ? 'fill-current' : ''}`} />
                    {likes.count}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCommentBox(post.id!)}
                    className="font-pixelated text-xs text-muted-foreground hover:bg-social-blue/10 transition-all duration-200 btn-hover-lift"
                  >
                    <MessageCircle className="h-4 w-4 mr-1" />
                    {comments.count}
                  </Button>

                  {hasComments && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComments(post.id!)}
                      className="font-pixelated text-xs text-muted-foreground hover:bg-social-purple/10 transition-all duration-200 btn-hover-lift"
                    >
                      {commentsExpanded ? 
                        <ChevronUp className="h-4 w-4 mr-1" /> : 
                        <ChevronDown className="h-4 w-4 mr-1" />
                      }
                      {commentsExpanded ? 'Hide' : 'Show'} Comments
                    </Button>
                  )}
                </div>
                
                {/* Comments Section */}
                {hasComments && commentsExpanded && (
                  <div className="mt-4 space-y-3 border-t border-border/50 pt-4 animate-fade-in">
                    {comments.comments.map((comment: any) => (
                      <div key={comment.id} className="flex gap-2">
                        <Avatar className="h-6 w-6">
                          {(comment.user_avatar || comment.profiles?.avatar) ? (
                            <AvatarImage src={comment.user_avatar || comment.profiles?.avatar} />
                          ) : (
                            <AvatarFallback className="bg-social-dark-green text-white font-pixelated text-xs">
                              {(comment.user_name || comment.profiles?.name)?.substring(0, 2).toUpperCase() || 'U'}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1 bg-muted/50 rounded-lg p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-pixelated text-xs font-medium">
                              {comment.user_name || comment.profiles?.name}
                            </span>
                            <span className="font-pixelated text-xs text-muted-foreground">
                              {formatDistanceToNow(
                                comment.created_at?.toDate ? comment.created_at.toDate() : new Date(comment.created_at), 
                                { addSuffix: true }
                              )}
                            </span>
                          </div>
                          <p className="font-pixelated text-xs leading-relaxed">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add Comment */}
                {commentBoxVisible && (
                  <div className="mt-4 flex gap-2 animate-fade-in">
                    <Textarea
                      placeholder="Write a comment..."
                      value={commentInputs[post.id!] || ''}
                      onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id!]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleComment(post.id!, isFirebasePost);
                        }
                      }}
                      className="flex-1 min-h-[60px] max-h-[120px] font-pixelated text-xs resize-none"
                      disabled={submittingComments[post.id!]}
                    />
                    <Button
                      onClick={() => handleComment(post.id!, isFirebasePost)}
                      disabled={!commentInputs[post.id!]?.trim() || submittingComments[post.id!]}
                      size="sm"
                      className="bg-social-green hover:bg-social-light-green text-white font-pixelated text-xs self-end btn-hover-lift transition-transform"
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Image Viewer */}
      {selectedImage && (
        <ImageViewer
          src={selectedImage}
          alt="Post image"
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {/* User Profile Dialog */}
      <UserProfileDialog
        open={showUserDialog}
        onOpenChange={setShowUserDialog}
        user={selectedUser}
      />
    </div>
  );
}