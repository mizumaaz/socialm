
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserProfileDialog } from '@/components/user/UserProfileDialog';

interface User {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  email?: string;
  created_at?: string;
}

export function UserSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    }
    getCurrentUser();
  }, []);

  useEffect(() => {
    async function searchUsers() {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, username, avatar')
          .or(`name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
          .neq('id', currentUserId)
          .limit(5);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (error) {
        console.error('Error searching users:', error);
        toast({
          variant: 'destructive',
          title: 'Search failed',
          description: 'Failed to search for users',
        });
      } finally {
        setIsLoading(false);
      }
    }

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, currentUserId, toast]);

  const handleSendFriendRequest = async (userId: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          requester_id: currentUserId,
          requested_id: userId,
          status: 'pending'
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            variant: 'destructive',
            title: 'Request already sent',
            description: 'You have already sent a friend request to this user',
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: 'Friend request sent!',
          description: 'Your friend request has been sent successfully',
        });
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send friend request',
      });
    }
  };

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setShowUserDialog(true);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="relative">
          <Input
            type="text"
            placeholder="Find Friends"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full font-pixelated text-xs h-8 pl-3 pr-3 transition-all duration-200 focus:ring-2 focus:ring-social-green"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto animate-fade-in">
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-md hover:bg-muted transition-colors duration-200 hover-scale"
              >
                <div 
                  className="flex items-center gap-2 flex-1 cursor-pointer"
                  onClick={() => handleUserClick(user)}
                >
                  <Avatar className="w-6 h-6">
                    {user.avatar ? (
                      <AvatarImage src={user.avatar} alt={user.name} />
                    ) : (
                      <AvatarFallback className="bg-social-dark-green text-white font-pixelated text-xs">
                        {user.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-pixelated text-xs font-medium truncate">
                      {user.name}
                    </p>
                    <p className="font-pixelated text-xs text-muted-foreground truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleSendFriendRequest(user.id)}
                  size="icon"
                  className="h-6 w-6 bg-social-green hover:bg-social-light-green text-white transition-colors hover-scale"
                >
                  <UserPlus className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="text-center py-2">
            <p className="font-pixelated text-xs text-muted-foreground animate-pulse">
              Searching...
            </p>
          </div>
        )}

        {searchTerm.length >= 2 && searchResults.length === 0 && !isLoading && (
          <div className="text-center py-2">
            <p className="font-pixelated text-xs text-muted-foreground">
              No users found
            </p>
          </div>
        )}
      </div>

      <UserProfileDialog
        open={showUserDialog}
        onOpenChange={setShowUserDialog}
        user={selectedUser}
      />
    </>
  );
}
