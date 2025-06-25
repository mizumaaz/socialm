import React, { useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { UnifiedCommunityFeed } from '@/components/dashboard/UnifiedCommunityFeed';
import { StoriesContainer } from '@/components/stories/StoriesContainer';
import { ScrollArea } from '@/components/ui/scroll-area';

export function Dashboard() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto relative h-[calc(100vh-60px)]">
        {/* Stories Container - Fixed at top */}
        <StoriesContainer />
        
        {/* Scrollable Content Area */}
        <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-180px)] px-2 scroll-smooth">
          {/* Unified Feed with Firebase + Supabase */}
          <UnifiedCommunityFeed />
        </ScrollArea>
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;