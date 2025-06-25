import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Group {
  id: string;
  name: string;
  description: string;
  avatar: string | null;
  is_private: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  max_members: number;
}

interface GroupMember {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  name: string;
  username: string;
  avatar: string | null;
}

interface GroupJoinRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string | null;
  created_at: string;
  name: string;
  username: string;
  avatar: string | null;
}

interface GroupMessage {
  id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  created_at: string;
  sender_name: string;
  sender_username: string;
  sender_avatar: string | null;
}

interface GroupSuggestion {
  id: string;
  name: string;
  description: string;
  avatar: string | null;
  member_count: number;
  created_by: string;
  created_at: string;
  mutual_members: number;
}

export function useGroups() {
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequest[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupSuggestions, setGroupSuggestions] = useState<GroupSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Error getting current user:', error);
      }
    };

    getCurrentUser();
  }, []);

  // Fetch user's groups
  const fetchMyGroups = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups:group_id (
            id,
            name,
            description,
            avatar,
            is_private,
            created_by,
            created_at,
            updated_at,
            member_count,
            max_members
          )
        `)
        .eq('user_id', currentUser.id)
        .order('joined_at', { ascending: false });
        
      if (error) throw error;
      
      const formattedGroups = data?.map(item => item.groups) || [];
      setMyGroups(formattedGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load your groups'
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser, toast]);

  // Fetch group members
  const fetchGroupMembers = useCallback(async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_group_members_with_profiles', {
          group_uuid: groupId
        });
        
      if (error) throw error;
      
      setGroupMembers(data || []);
      
      // Check if current user is admin
      const isUserAdmin = data?.some(member => 
        member.user_id === currentUser?.id && member.role === 'admin'
      ) || false;
      
      setIsAdmin(isUserAdmin);
    } catch (error) {
      console.error('Error fetching group members:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load group members'
      });
    }
  }, [currentUser?.id, toast]);

  // Fetch join requests
  const fetchJoinRequests = useCallback(async (groupId: string) => {
    if (!isAdmin) {
      setJoinRequests([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .rpc('get_group_join_requests_with_profiles', {
          group_uuid: groupId
        });
        
      if (error) throw error;
      
      setJoinRequests(data || []);
    } catch (error) {
      console.error('Error fetching join requests:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load join requests'
      });
    }
  }, [isAdmin, toast]);

  // Fetch group messages
  const fetchGroupMessages = useCallback(async (groupId: string, limit = 50, offset = 0) => {
    try {
      const { data, error } = await supabase
        .rpc('get_group_messages_with_profiles', {
          group_uuid: groupId,
          limit_count: limit,
          offset_count: offset
        });
        
      if (error) throw error;
      
      // Reverse to show oldest first
      setGroupMessages((data || []).reverse());
    } catch (error) {
      console.error('Error fetching group messages:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load group messages'
      });
    }
  }, [toast]);

  // Fetch group suggestions
  const fetchGroupSuggestions = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_group_suggestions', {
          user_uuid: currentUser.id,
          limit_count: 10
        });
        
      if (error) throw error;
      
      setGroupSuggestions(data || []);
    } catch (error) {
      console.error('Error fetching group suggestions:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load group suggestions'
      });
    }
  }, [currentUser, toast]);

  // Create a new group
  const createGroup = useCallback(async (name: string, description: string, avatar: string | null = null) => {
    if (!currentUser) return null;
    
    try {
      const { data, error } = await supabase
        .rpc('create_group_with_admin', {
          p_name: name,
          p_description: description,
          p_avatar: avatar,
          p_is_private: true,
          p_creator_id: currentUser.id
        });
        
      if (error) throw error;
      
      // Refresh groups list
      fetchMyGroups();
      
      toast({
        title: 'Group created',
        description: `Your group "${name}" has been created successfully`
      });
      
      return data;
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create group'
      });
      return null;
    }
  }, [currentUser, fetchMyGroups, toast]);

  // Send a message to the group
  const sendGroupMessage = useCallback(async (groupId: string, content: string, messageType: 'text' | 'image' | 'file' = 'text') => {
    if (!currentUser) return null;
    
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          sender_id: currentUser.id,
          content,
          message_type: messageType
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // Optimistically update messages
      const senderProfile = await supabase
        .from('profiles')
        .select('name, username, avatar')
        .eq('id', currentUser.id)
        .single();
        
      if (senderProfile.data) {
        const newMessage: GroupMessage = {
          id: data.id,
          sender_id: currentUser.id,
          content: data.content,
          message_type: data.message_type,
          created_at: data.created_at,
          sender_name: senderProfile.data.name,
          sender_username: senderProfile.data.username,
          sender_avatar: senderProfile.data.avatar
        };
        
        setGroupMessages(prev => [...prev, newMessage]);
      }
      
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send message'
      });
      return null;
    }
  }, [currentUser, toast]);

  // Send a join request to a group
  const sendJoinRequest = useCallback(async (groupId: string, message: string = '') => {
    if (!currentUser) return false;
    
    try {
      const { error } = await supabase
        .from('group_join_requests')
        .insert({
          group_id: groupId,
          user_id: currentUser.id,
          message,
          status: 'pending'
        });
        
      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            variant: 'destructive',
            title: 'Request already sent',
            description: 'You have already sent a join request to this group'
          });
          return false;
        }
        throw error;
      }
      
      toast({
        title: 'Join request sent',
        description: 'Your request to join the group has been sent'
      });
      
      // Update suggestions list
      fetchGroupSuggestions();
      
      return true;
    } catch (error) {
      console.error('Error sending join request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send join request'
      });
      return false;
    }
  }, [currentUser, fetchGroupSuggestions, toast]);

  // Approve a join request
  const approveJoinRequest = useCallback(async (requestId: string) => {
    if (!currentUser || !isAdmin) return false;
    
    try {
      const { data, error } = await supabase
        .rpc('approve_group_join_request', {
          request_uuid: requestId,
          admin_uuid: currentUser.id
        });
        
      if (error) throw error;
      
      if (data) {
        toast({
          title: 'Request approved',
          description: 'The join request has been approved'
        });
        
        // Refresh join requests and members
        if (currentGroup) {
          fetchJoinRequests(currentGroup.id);
          fetchGroupMembers(currentGroup.id);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error approving join request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to approve join request'
      });
      return false;
    }
  }, [currentUser, isAdmin, currentGroup, fetchJoinRequests, fetchGroupMembers, toast]);

  // Reject a join request
  const rejectJoinRequest = useCallback(async (requestId: string) => {
    if (!currentUser || !isAdmin) return false;
    
    try {
      const { data, error } = await supabase
        .rpc('reject_group_join_request', {
          request_uuid: requestId,
          admin_uuid: currentUser.id
        });
        
      if (error) throw error;
      
      if (data) {
        toast({
          title: 'Request rejected',
          description: 'The join request has been rejected'
        });
        
        // Refresh join requests
        if (currentGroup) {
          fetchJoinRequests(currentGroup.id);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error rejecting join request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to reject join request'
      });
      return false;
    }
  }, [currentUser, isAdmin, currentGroup, fetchJoinRequests, toast]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!currentUser) return;
    
    // Subscribe to group messages
    const messagesChannel = supabase
      .channel('group-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: currentGroup ? `group_id=eq.${currentGroup.id}` : undefined
      }, async (payload) => {
        if (!currentGroup) return;
        
        // Only process if it's for the current group
        if (payload.new.group_id === currentGroup.id) {
          // Get sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, username, avatar')
            .eq('id', payload.new.sender_id)
            .single();
            
          if (profile) {
            const newMessage: GroupMessage = {
              id: payload.new.id,
              sender_id: payload.new.sender_id,
              content: payload.new.content,
              message_type: payload.new.message_type,
              created_at: payload.new.created_at,
              sender_name: profile.name,
              sender_username: profile.username,
              sender_avatar: profile.avatar
            };
            
            // Only add if not already in the list
            setGroupMessages(prev => {
              if (prev.some(msg => msg.id === newMessage.id)) {
                return prev;
              }
              return [...prev, newMessage];
            });
          }
        }
      })
      .subscribe();
      
    // Subscribe to group members
    const membersChannel = supabase
      .channel('group-members')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: currentGroup ? `group_id=eq.${currentGroup.id}` : undefined
      }, () => {
        if (currentGroup) {
          fetchGroupMembers(currentGroup.id);
        }
      })
      .subscribe();
      
    // Subscribe to join requests
    const requestsChannel = supabase
      .channel('group-join-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_join_requests',
        filter: currentGroup ? `group_id=eq.${currentGroup.id}` : undefined
      }, () => {
        if (currentGroup && isAdmin) {
          fetchJoinRequests(currentGroup.id);
        }
      })
      .subscribe();
      
    // Subscribe to groups
    const groupsChannel = supabase
      .channel('groups')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'groups'
      }, () => {
        fetchMyGroups();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(groupsChannel);
    };
  }, [currentUser, currentGroup, isAdmin, fetchGroupMembers, fetchJoinRequests, fetchMyGroups]);

  // Load group data when current group changes
  useEffect(() => {
    if (currentGroup) {
      fetchGroupMembers(currentGroup.id);
      fetchGroupMessages(currentGroup.id);
      fetchJoinRequests(currentGroup.id);
    }
  }, [currentGroup, fetchGroupMembers, fetchGroupMessages, fetchJoinRequests]);

  // Load initial data
  useEffect(() => {
    if (currentUser) {
      fetchMyGroups();
      fetchGroupSuggestions();
    }
  }, [currentUser, fetchMyGroups, fetchGroupSuggestions]);

  return {
    myGroups,
    currentGroup,
    setCurrentGroup,
    groupMembers,
    joinRequests,
    groupMessages,
    groupSuggestions,
    loading,
    isAdmin,
    createGroup,
    sendGroupMessage,
    sendJoinRequest,
    approveJoinRequest,
    rejectJoinRequest,
    fetchMyGroups,
    fetchGroupSuggestions,
    fetchGroupMessages
  };
}