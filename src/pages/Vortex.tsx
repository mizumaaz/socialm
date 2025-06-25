import React, { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGroups } from '@/hooks/use-groups';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { 
  Layers, 
  Plus, 
  Send, 
  Users, 
  UserPlus, 
  Settings, 
  Bell, 
  MessageSquare,
  Check,
  X,
  Info,
  Search,
  ArrowLeft
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function Vortex() {
  const [newMessage, setNewMessage] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [showRequestsDialog, setShowRequestsDialog] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const {
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
    rejectJoinRequest
  } = useGroups();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [groupMessages]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a group name'
      });
      return;
    }

    try {
      setCreatingGroup(true);
      const groupId = await createGroup(
        newGroupName.trim(),
        newGroupDescription.trim()
      );
      
      if (groupId) {
        setShowCreateDialog(false);
        setNewGroupName('');
        setNewGroupDescription('');
        
        // Find the newly created group and set it as current
        const newGroup = myGroups.find(g => g.id === groupId);
        if (newGroup) {
          setCurrentGroup(newGroup);
        }
      }
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create group'
      });
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentGroup || sendingMessage) return;
    
    try {
      setSendingMessage(true);
      await sendGroupMessage(currentGroup.id, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send message'
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleJoinRequest = async (groupId: string) => {
    await sendJoinRequest(groupId);
  };

  const handleApproveRequest = async (requestId: string) => {
    await approveJoinRequest(requestId);
  };

  const handleRejectRequest = async (requestId: string) => {
    await rejectJoinRequest(requestId);
  };

  const filterGroups = (groups) => {
    if (!searchQuery.trim()) return groups;
    
    const query = searchQuery.toLowerCase();
    return groups.filter(group => 
      group.name.toLowerCase().includes(query) || 
      (group.description && group.description.toLowerCase().includes(query))
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold font-pixelated">Vortex</h1>
            <div className="animate-pulse h-10 w-32 bg-muted rounded"></div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <Card className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-6 w-24 bg-muted rounded mb-2"></div>
                  <div className="h-4 w-32 bg-muted rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted"></div>
                        <div className="flex-1">
                          <div className="h-4 w-24 bg-muted rounded mb-1"></div>
                          <div className="h-3 w-16 bg-muted rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="md:col-span-2">
              <Card className="animate-pulse h-[70vh]">
                <CardHeader className="pb-2">
                  <div className="h-6 w-32 bg-muted rounded mb-2"></div>
                  <div className="h-4 w-48 bg-muted rounded"></div>
                </CardHeader>
                <CardContent className="h-[calc(70vh-130px)]">
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted"></div>
                        <div className="flex-1">
                          <div className="h-4 w-24 bg-muted rounded mb-1"></div>
                          <div className="h-16 w-full bg-muted rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter>
                  <div className="w-full h-10 bg-muted rounded"></div>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold font-pixelated">Vortex</h1>
          </div>
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="bg-social-green hover:bg-social-light-green text-white font-pixelated"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Groups List */}
          <div className="md:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-pixelated">My Groups</CardTitle>
                  <Badge variant="outline" className="font-pixelated">
                    {myGroups.length}
                  </Badge>
                </div>
                <CardDescription className="font-pixelated text-xs">
                  Select a group to start chatting
                </CardDescription>
                <div className="mt-2">
                  <Input
                    placeholder="Search groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="font-pixelated text-xs h-8"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="myGroups" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="myGroups" className="font-pixelated text-xs">My Groups</TabsTrigger>
                    <TabsTrigger value="suggested" className="font-pixelated text-xs">Suggested</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="myGroups" className="mt-2">
                    <ScrollArea className="h-[50vh]">
                      {filterGroups(myGroups).length > 0 ? (
                        <div className="space-y-3">
                          {filterGroups(myGroups).map((group) => (
                            <div
                              key={group.id}
                              onClick={() => setCurrentGroup(group)}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-muted ${
                                currentGroup?.id === group.id ? 'bg-muted shadow-sm' : ''
                              }`}
                            >
                              <Avatar className="h-10 w-10 border-2 border-social-green/20">
                                {group.avatar ? (
                                  <AvatarImage src={group.avatar} alt={group.name} />
                                ) : (
                                  <AvatarFallback className="bg-social-dark-green text-white font-pixelated text-xs">
                                    {group.name.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-pixelated text-sm font-medium truncate">{group.name}</p>
                                <p className="font-pixelated text-xs text-muted-foreground truncate">
                                  {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                          <p className="font-pixelated text-sm font-medium mb-2">
                            {searchQuery ? 'No groups found' : 'No groups yet'}
                          </p>
                          <p className="font-pixelated text-xs text-muted-foreground mb-4">
                            {searchQuery 
                              ? 'Try a different search term' 
                              : 'Create a new group to get started'}
                          </p>
                          <Button 
                            onClick={() => setShowCreateDialog(true)}
                            variant="outline" 
                            className="font-pixelated text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Create Group
                          </Button>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="suggested" className="mt-2">
                    <ScrollArea className="h-[50vh]">
                      {groupSuggestions.length > 0 ? (
                        <div className="space-y-3">
                          {groupSuggestions.map((group) => (
                            <div
                              key={group.id}
                              className="flex items-center gap-3 p-3 rounded-lg border border-muted hover:bg-muted/50 transition-all duration-200"
                            >
                              <Avatar className="h-10 w-10 border-2 border-social-blue/20">
                                {group.avatar ? (
                                  <AvatarImage src={group.avatar} alt={group.name} />
                                ) : (
                                  <AvatarFallback className="bg-social-blue text-white font-pixelated text-xs">
                                    {group.name.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-pixelated text-sm font-medium truncate">{group.name}</p>
                                <div className="flex items-center gap-1">
                                  <p className="font-pixelated text-xs text-muted-foreground truncate">
                                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                                  </p>
                                  {group.mutual_members > 0 && (
                                    <Badge variant="outline" className="font-pixelated text-[8px] h-4">
                                      {group.mutual_members} mutual
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-pixelated text-xs text-muted-foreground truncate">
                                  {group.description?.substring(0, 30) || 'No description'}
                                  {group.description?.length > 30 ? '...' : ''}
                                </p>
                              </div>
                              <Button
                                onClick={() => handleJoinRequest(group.id)}
                                size="sm"
                                className="bg-social-blue hover:bg-social-blue/90 text-white font-pixelated text-xs h-8"
                              >
                                <UserPlus className="h-3 w-3 mr-1" />
                                Join
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                          <p className="font-pixelated text-sm font-medium mb-2">
                            No suggested groups
                          </p>
                          <p className="font-pixelated text-xs text-muted-foreground mb-4">
                            We'll suggest groups based on your friends' memberships
                          </p>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="md:col-span-2">
            {currentGroup ? (
              <Card className="h-[70vh] flex flex-col">
                <CardHeader className="pb-2 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden h-8 w-8"
                        onClick={() => setCurrentGroup(null)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <Avatar className="h-10 w-10 border-2 border-social-green/20">
                        {currentGroup.avatar ? (
                          <AvatarImage src={currentGroup.avatar} alt={currentGroup.name} />
                        ) : (
                          <AvatarFallback className="bg-social-dark-green text-white font-pixelated text-xs">
                            {currentGroup.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg font-pixelated">{currentGroup.name}</CardTitle>
                        <CardDescription className="font-pixelated text-xs">
                          {currentGroup.member_count} {currentGroup.member_count === 1 ? 'member' : 'members'}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowMembersDialog(true)}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 relative"
                            onClick={() => setShowRequestsDialog(true)}
                          >
                            <UserPlus className="h-4 w-4" />
                            {joinRequests.length > 0 && (
                              <Badge 
                                variant="destructive" 
                                className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center"
                              >
                                {joinRequests.length}
                              </Badge>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full p-4">
                    {groupMessages.length > 0 ? (
                      <div className="space-y-4">
                        {groupMessages.map((message) => (
                          <div key={message.id} className="flex items-start gap-2">
                            <Avatar className="h-8 w-8 mt-1">
                              {message.sender_avatar ? (
                                <AvatarImage src={message.sender_avatar} alt={message.sender_name} />
                              ) : (
                                <AvatarFallback className="bg-social-dark-green text-white font-pixelated text-xs">
                                  {message.sender_name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-pixelated text-xs font-medium">
                                  {message.sender_name}
                                </p>
                                <span className="font-pixelated text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <div className="bg-muted p-3 rounded-lg mt-1">
                                <p className="font-pixelated text-xs whitespace-pre-wrap break-words">
                                  {message.content}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="font-pixelated text-sm font-medium mb-2">No messages yet</p>
                        <p className="font-pixelated text-xs text-muted-foreground max-w-md">
                          Be the first to send a message in this group!
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
                
                <CardFooter className="p-4 border-t">
                  <div className="flex w-full gap-2">
                    <Textarea
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1 min-h-[60px] max-h-[120px] font-pixelated text-xs resize-none"
                      disabled={sendingMessage}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendingMessage}
                      className="bg-social-green hover:bg-social-light-green text-white font-pixelated self-end"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ) : (
              <Card className="h-[70vh] flex items-center justify-center">
                <CardContent className="text-center max-w-md">
                  <Layers className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <CardTitle className="text-xl font-pixelated mb-2">Welcome to Vortex</CardTitle>
                  <CardDescription className="font-pixelated text-sm mb-6">
                    Create or join private groups to chat with friends and communities
                  </CardDescription>
                  <div className="space-y-4">
                    <Button 
                      onClick={() => setShowCreateDialog(true)}
                      className="w-full bg-social-green hover:bg-social-light-green text-white font-pixelated"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create a New Group
                    </Button>
                    {groupSuggestions.length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="font-pixelated text-sm font-medium mb-3">Suggested Groups</p>
                        <div className="space-y-2">
                          {groupSuggestions.slice(0, 3).map((group) => (
                            <div
                              key={group.id}
                              className="flex items-center gap-3 p-2 rounded-lg border border-muted hover:bg-muted/50 transition-all duration-200"
                            >
                              <Avatar className="h-8 w-8">
                                {group.avatar ? (
                                  <AvatarImage src={group.avatar} alt={group.name} />
                                ) : (
                                  <AvatarFallback className="bg-social-blue text-white font-pixelated text-xs">
                                    {group.name.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-pixelated text-xs font-medium truncate">{group.name}</p>
                                <p className="font-pixelated text-xs text-muted-foreground truncate">
                                  {group.member_count} members
                                </p>
                              </div>
                              <Button
                                onClick={() => handleJoinRequest(group.id)}
                                size="sm"
                                className="bg-social-blue hover:bg-social-blue/90 text-white font-pixelated text-xs h-7"
                              >
                                <UserPlus className="h-3 w-3 mr-1" />
                                Join
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-pixelated">Create New Group</DialogTitle>
            <DialogDescription className="font-pixelated text-xs">
              Create a private group to chat with friends and communities
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="font-pixelated text-xs">Group Name</label>
              <Input
                id="name"
                placeholder="Enter group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="font-pixelated text-xs"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="font-pixelated text-xs">Description (optional)</label>
              <Textarea
                id="description"
                placeholder="Describe your group"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                className="font-pixelated text-xs min-h-[80px]"
              />
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="font-pixelated text-xs text-muted-foreground">
                  All groups are private by default. Only approved members can see and join the conversation.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="font-pixelated text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim() || creatingGroup}
              className="bg-social-green hover:bg-social-light-green text-white font-pixelated text-xs"
            >
              {creatingGroup ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-pixelated flex items-center gap-2">
              <Users className="h-4 w-4" />
              Group Members
            </DialogTitle>
            <DialogDescription className="font-pixelated text-xs">
              {currentGroup?.name} • {groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {groupMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {member.avatar ? (
                          <AvatarImage src={member.avatar} alt={member.name} />
                        ) : (
                          <AvatarFallback className="bg-social-dark-green text-white font-pixelated text-xs">
                            {member.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="font-pixelated text-xs font-medium">{member.name}</p>
                        <p className="font-pixelated text-xs text-muted-foreground">@{member.username}</p>
                      </div>
                    </div>
                    {member.role === 'admin' && (
                      <Badge variant="outline" className="font-pixelated text-xs">
                        Admin
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowMembersDialog(false)}
              className="font-pixelated text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Requests Dialog */}
      <Dialog open={showRequestsDialog} onOpenChange={setShowRequestsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-pixelated flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Join Requests
            </DialogTitle>
            <DialogDescription className="font-pixelated text-xs">
              {joinRequests.length} pending {joinRequests.length === 1 ? 'request' : 'requests'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {joinRequests.length > 0 ? (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  {joinRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar className="h-8 w-8">
                          {request.avatar ? (
                            <AvatarImage src={request.avatar} alt={request.name} />
                          ) : (
                            <AvatarFallback className="bg-social-dark-green text-white font-pixelated text-xs">
                              {request.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <p className="font-pixelated text-xs font-medium">{request.name}</p>
                          <p className="font-pixelated text-xs text-muted-foreground">
                            Requested {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      {request.message && (
                        <p className="font-pixelated text-xs text-muted-foreground mb-3 bg-muted p-2 rounded">
                          "{request.message}"
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleApproveRequest(request.id)}
                          size="sm"
                          className="bg-social-green hover:bg-social-light-green text-white font-pixelated text-xs flex-1"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleRejectRequest(request.id)}
                          size="sm"
                          variant="outline"
                          className="font-pixelated text-xs flex-1"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="font-pixelated text-sm font-medium mb-2">No pending requests</p>
                <p className="font-pixelated text-xs text-muted-foreground">
                  When users request to join your group, they'll appear here
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowRequestsDialog(false)}
              className="font-pixelated text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

export default Vortex;