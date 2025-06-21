// Localization utilities for improved user experience
export interface LocalizedStrings {
  // Time-related strings
  timeAgo: {
    now: string;
    minutesAgo: (count: number) => string;
    hoursAgo: (count: number) => string;
    daysAgo: (count: number) => string;
    weeksAgo: (count: number) => string;
    monthsAgo: (count: number) => string;
    yearsAgo: (count: number) => string;
  };
  
  // Action strings
  actions: {
    like: string;
    unlike: string;
    comment: string;
    share: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    send: string;
    reply: string;
  };
  
  // Status strings
  status: {
    online: string;
    offline: string;
    typing: string;
    lastSeen: (time: string) => string;
    edited: string;
    deleted: string;
  };
  
  // Notification strings
  notifications: {
    newMessage: (sender: string) => string;
    newLike: (liker: string) => string;
    newComment: (commenter: string) => string;
    friendRequest: (requester: string) => string;
    friendAccepted: (accepter: string) => string;
  };
  
  // Error strings
  errors: {
    networkError: string;
    loadingFailed: string;
    postFailed: string;
    deleteFailed: string;
    updateFailed: string;
    permissionDenied: string;
  };
}

// Default English strings
const englishStrings: LocalizedStrings = {
  timeAgo: {
    now: 'now',
    minutesAgo: (count) => `${count}m ago`,
    hoursAgo: (count) => `${count}h ago`,
    daysAgo: (count) => `${count}d ago`,
    weeksAgo: (count) => `${count}w ago`,
    monthsAgo: (count) => `${count}mo ago`,
    yearsAgo: (count) => `${count}y ago`,
  },
  actions: {
    like: 'Like',
    unlike: 'Unlike',
    comment: 'Comment',
    share: 'Share',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    send: 'Send',
    reply: 'Reply',
  },
  status: {
    online: 'Online',
    offline: 'Offline',
    typing: 'typing...',
    lastSeen: (time) => `Last seen ${time}`,
    edited: 'edited',
    deleted: 'deleted',
  },
  notifications: {
    newMessage: (sender) => `${sender} sent you a message`,
    newLike: (liker) => `${liker} liked your post`,
    newComment: (commenter) => `${commenter} commented on your post`,
    friendRequest: (requester) => `${requester} sent you a friend request`,
    friendAccepted: (accepter) => `${accepter} accepted your friend request`,
  },
  errors: {
    networkError: 'Network error. Please check your connection.',
    loadingFailed: 'Failed to load content',
    postFailed: 'Failed to create post',
    deleteFailed: 'Failed to delete',
    updateFailed: 'Failed to update',
    permissionDenied: 'Permission denied',
  },
};

// Optimized time formatting for better performance
export function formatTimeAgo(date: Date | string, strings: LocalizedStrings = englishStrings): string {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return strings.timeAgo.now;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return strings.timeAgo.minutesAgo(diffInMinutes);
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return strings.timeAgo.hoursAgo(diffInHours);
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return strings.timeAgo.daysAgo(diffInDays);
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return strings.timeAgo.weeksAgo(diffInWeeks);
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return strings.timeAgo.monthsAgo(diffInMonths);
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return strings.timeAgo.yearsAgo(diffInYears);
}

// Memoized time formatting for performance
const timeFormatCache = new Map<string, { result: string; timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute

export function formatTimeAgoMemoized(date: Date | string, strings: LocalizedStrings = englishStrings): string {
  const dateString = typeof date === 'string' ? date : date.toISOString();
  const now = Date.now();
  
  const cached = timeFormatCache.get(dateString);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.result;
  }

  const result = formatTimeAgo(date, strings);
  timeFormatCache.set(dateString, { result, timestamp: now });
  
  // Clean up old cache entries
  if (timeFormatCache.size > 1000) {
    const cutoff = now - CACHE_DURATION;
    for (const [key, value] of timeFormatCache.entries()) {
      if (value.timestamp < cutoff) {
        timeFormatCache.delete(key);
      }
    }
  }
  
  return result;
}

// Get localized strings (can be extended for multiple languages)
export function getLocalizedStrings(locale: string = 'en'): LocalizedStrings {
  // For now, only English is supported
  // This can be extended to support multiple languages
  return englishStrings;
}

// Number formatting utilities
export function formatCount(count: number): string {
  if (count < 1000) {
    return count.toString();
  } else if (count < 1000000) {
    return `${(count / 1000).toFixed(1)}k`;
  } else {
    return `${(count / 1000000).toFixed(1)}m`;
  }
}

// Optimized text truncation
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - suffix.length) + suffix;
}

// Debounced search utility
export function createDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  delay: number = 300
) {
  let timeoutId: NodeJS.Timeout;
  
  return (query: string): Promise<T[]> => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          const results = await searchFn(query);
          resolve(results);
        } catch (error) {
          console.error('Search error:', error);
          resolve([]);
        }
      }, delay);
    });
  };
}