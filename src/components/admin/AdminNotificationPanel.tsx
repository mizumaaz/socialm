import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Send, LogOut, Shield, Eye, EyeOff, AlertTriangle, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NotificationService } from '@/config/firebase';

interface AdminNotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminNotificationPanel({ open, onOpenChange }: AdminNotificationPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [notificationsSent, setNotificationsSent] = useState(0);
  const { toast } = useToast();

  // Default admin credentials
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'socialchat2025';

  // Auto logout after 5 minutes of inactivity
  useEffect(() => {
    let logoutTimer: NodeJS.Timeout;
    
    if (isAuthenticated) {
      logoutTimer = setTimeout(() => {
        handleLogout();
        toast({
          title: 'Session expired',
          description: 'You have been automatically logged out for security.',
          variant: 'destructive'
        });
      }, 5 * 60 * 1000); // 5 minutes
    }

    return () => {
      if (logoutTimer) {
        clearTimeout(logoutTimer);
      }
    };
  }, [isAuthenticated]);

  // Auto logout when page is loaded/refreshed
  useEffect(() => {
    const handlePageLoad = () => {
      if (isAuthenticated) {
        handleLogout();
      }
    };

    window.addEventListener('beforeunload', handlePageLoad);
    return () => window.removeEventListener('beforeunload', handlePageLoad);
  }, [isAuthenticated]);

  const handleLogin = () => {
    setLoginError('');
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setUsername('');
      setPassword('');
      toast({
        title: 'Admin access granted',
        description: 'You can now send push notifications to all users.',
      });
    } else {
      setLoginError('Invalid credentials. Please try again.');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setNotificationTitle('');
    setNotificationMessage('');
    setLoginError('');
    setNotificationsSent(0);
  };

  const handleSendNotification = async () => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in both title and message fields.'
      });
      return;
    }

    try {
      setIsSending(true);

      // Initialize Firebase notification service
      await NotificationService.initialize();

      // Send notification to all users
      const result = await NotificationService.sendNotificationToUser(
        'all-users', // Special identifier for broadcast
        notificationTitle.trim(),
        notificationMessage.trim(),
        {
          type: 'admin_broadcast',
          timestamp: new Date().toISOString(),
          priority: 'high',
          broadcast: true
        }
      );

      if (result.success) {
        setNotificationsSent(prev => prev + 1);
        
        toast({
          title: '🚀 Notification sent!',
          description: `Push notification "${notificationTitle}" has been broadcast to all users.`,
        });

        // Clear form
        setNotificationTitle('');
        setNotificationMessage('');

        // Send to service worker for background notifications
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            registration.active?.postMessage({
              type: 'ADMIN_BROADCAST',
              title: notificationTitle.trim(),
              body: notificationMessage.trim(),
              data: {
                type: 'admin_broadcast',
                timestamp: new Date().toISOString(),
                priority: 'high'
              }
            });
          });
        }

        // Dispatch custom event for in-page toast notifications (for ALL users)
        window.dispatchEvent(new CustomEvent('adminBroadcastToast', {
          detail: {
            title: notificationTitle.trim(),
            message: notificationMessage.trim(),
            timestamp: new Date().toISOString()
          }
        }));

        // Show preview notification for admin
        if ('Notification' in window && Notification.permission === 'granted') {
          setTimeout(() => {
            new Notification(`📢 ${notificationTitle}`, {
              body: notificationMessage,
              icon: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
              tag: 'admin-preview',
              requireInteraction: false
            });
          }, 1000);
        }
      } else {
        throw new Error(result.error || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to send notification',
        description: 'There was an error sending the push notification. Please try again.'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    handleLogout(); // Always logout when closing
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm mx-auto animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-pixelated text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-500" />
            Admin Push Panel
          </DialogTitle>
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="space-y-3">
            <Alert>
              <AlertTriangle className="h-3 w-3" />
              <AlertDescription className="font-pixelated text-xs">
                Restricted admin area for push notifications.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-pixelated text-xs">Admin Login</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="username" className="font-pixelated text-xs">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="font-pixelated text-xs h-8"
                    placeholder="Enter admin username"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="password" className="font-pixelated text-xs">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="font-pixelated text-xs h-8 pr-8"
                      placeholder="Enter admin password"
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-8 w-8 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Eye className="h-3 w-3 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {loginError && (
                  <Alert variant="destructive">
                    <AlertDescription className="font-pixelated text-xs">
                      {loginError}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleLogin}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-pixelated text-xs h-8"
                  disabled={!username.trim() || !password.trim()}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Login
                </Button>
              </CardContent>
            </Card>

            <div className="bg-muted/50 p-2 rounded-lg">
              <p className="font-pixelated text-xs text-muted-foreground text-center">
                Default: admin / socialchat2025
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-green-600" />
                <div>
                  <span className="font-pixelated text-xs text-green-800">Admin Active</span>
                  {notificationsSent > 0 && (
                    <p className="font-pixelated text-xs text-green-600">
                      {notificationsSent} sent
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={handleLogout}
                size="sm"
                variant="outline"
                className="font-pixelated text-xs h-6"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Logout
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-pixelated text-xs flex items-center gap-1">
                  <Zap className="h-3 w-3 text-orange-500" />
                  Send to All Users
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="title" className="font-pixelated text-xs">Title</Label>
                  <Input
                    id="title"
                    type="text"
                    value={notificationTitle}
                    onChange={(e) => setNotificationTitle(e.target.value)}
                    className="font-pixelated text-xs h-8"
                    placeholder="Enter notification title"
                    maxLength={50}
                  />
                  <div className="flex justify-end">
                    <p className="font-pixelated text-xs text-muted-foreground">
                      {notificationTitle.length}/50
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="message" className="font-pixelated text-xs">Message</Label>
                  <Textarea
                    id="message"
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    className="font-pixelated text-xs min-h-[60px] resize-none"
                    placeholder="Enter notification message"
                    maxLength={200}
                  />
                  <div className="flex justify-end">
                    <p className="font-pixelated text-xs text-muted-foreground">
                      {notificationMessage.length}/200
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleSendNotification}
                  disabled={!notificationTitle.trim() || !notificationMessage.trim() || isSending}
                  className="w-full bg-social-green hover:bg-social-light-green text-white font-pixelated text-xs h-8"
                >
                  <Send className="h-3 w-3 mr-1" />
                  {isSending ? 'Sending...' : 'Send Push Notification'}
                </Button>
              </CardContent>
            </Card>

            <Alert>
              <Bell className="h-3 w-3" />
              <AlertDescription className="font-pixelated text-xs">
                Sends real push notifications to all users' devices.
              </AlertDescription>
            </Alert>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
              <p className="font-pixelated text-xs text-yellow-800">
                <strong>Security:</strong> Auto-logout after 5 minutes or page refresh.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}