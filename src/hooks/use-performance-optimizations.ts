import { useCallback, useMemo, useRef } from 'react';
import { debounce } from 'lodash-es';

// Performance optimization hooks for better user experience
export function usePerformanceOptimizations() {
  const requestIdRef = useRef<number>();
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Optimized debounced search
  const createOptimizedSearch = useCallback((
    searchFn: (query: string) => Promise<any[]>,
    delay: number = 300
  ) => {
    return debounce(async (query: string) => {
      // Cancel previous request if still pending
      if (requestIdRef.current) {
        cancelAnimationFrame(requestIdRef.current);
      }

      // Use requestAnimationFrame for better performance
      requestIdRef.current = requestAnimationFrame(async () => {
        try {
          await searchFn(query);
        } catch (error) {
          console.error('Search error:', error);
        }
      });
    }, delay);
  }, []);

  // Optimized scroll handler with throttling
  const createOptimizedScrollHandler = useCallback((
    handler: (scrollTop: number) => void,
    throttleMs: number = 16 // ~60fps
  ) => {
    let ticking = false;

    return (event: Event) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const target = event.target as HTMLElement;
          handler(target.scrollTop);
          ticking = false;
        });
        ticking = true;
      }
    };
  }, []);

  // Optimized image loading with lazy loading
  const createOptimizedImageLoader = useCallback(() => {
    const imageCache = new Map<string, HTMLImageElement>();

    return {
      preloadImage: (src: string): Promise<void> => {
        if (imageCache.has(src)) {
          return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            imageCache.set(src, img);
            resolve();
          };
          img.onerror = reject;
          img.src = src;
        });
      },
      
      getCachedImage: (src: string) => imageCache.get(src),
      
      clearCache: () => imageCache.clear()
    };
  }, []);

  // Optimized virtual scrolling for large lists
  const createVirtualScrolling = useCallback((
    itemHeight: number,
    containerHeight: number,
    items: any[]
  ) => {
    return useMemo(() => {
      const visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
      const totalHeight = items.length * itemHeight;

      return {
        getVisibleItems: (scrollTop: number) => {
          const startIndex = Math.floor(scrollTop / itemHeight);
          const endIndex = Math.min(startIndex + visibleCount, items.length);
          
          return {
            startIndex: Math.max(0, startIndex),
            endIndex,
            items: items.slice(startIndex, endIndex),
            offsetY: startIndex * itemHeight,
            totalHeight
          };
        }
      };
    }, [itemHeight, containerHeight, items]);
  }, []);

  // Memory cleanup utility
  const cleanup = useCallback(() => {
    if (requestIdRef.current) {
      cancelAnimationFrame(requestIdRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    createOptimizedSearch,
    createOptimizedScrollHandler,
    createOptimizedImageLoader,
    createVirtualScrolling,
    cleanup
  };
}

// Memoization utilities for expensive computations
export function useMemoizedComputation<T>(
  computeFn: () => T,
  dependencies: any[]
): T {
  return useMemo(computeFn, dependencies);
}

// Optimized event handlers
export function useOptimizedEventHandlers() {
  const handlersRef = useRef<Map<string, Function>>(new Map());

  const createHandler = useCallback((
    key: string,
    handler: Function,
    options: { throttle?: number; debounce?: number } = {}
  ) => {
    if (handlersRef.current.has(key)) {
      return handlersRef.current.get(key)!;
    }

    let optimizedHandler = handler;

    if (options.throttle) {
      let lastCall = 0;
      optimizedHandler = (...args: any[]) => {
        const now = Date.now();
        if (now - lastCall >= options.throttle!) {
          lastCall = now;
          return handler(...args);
        }
      };
    } else if (options.debounce) {
      let timeoutId: NodeJS.Timeout;
      optimizedHandler = (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => handler(...args), options.debounce);
      };
    }

    handlersRef.current.set(key, optimizedHandler);
    return optimizedHandler;
  }, []);

  const clearHandlers = useCallback(() => {
    handlersRef.current.clear();
  }, []);

  return { createHandler, clearHandlers };
}

// Performance monitoring utilities
export function usePerformanceMonitoring() {
  const metricsRef = useRef<Map<string, number>>(new Map());

  const startTiming = useCallback((label: string) => {
    metricsRef.current.set(label, performance.now());
  }, []);

  const endTiming = useCallback((label: string) => {
    const startTime = metricsRef.current.get(label);
    if (startTime) {
      const duration = performance.now() - startTime;
      console.log(`Performance: ${label} took ${duration.toFixed(2)}ms`);
      metricsRef.current.delete(label);
      return duration;
    }
    return 0;
  }, []);

  const measureAsync = useCallback(async <T>(
    label: string,
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    startTiming(label);
    try {
      const result = await asyncFn();
      endTiming(label);
      return result;
    } catch (error) {
      endTiming(label);
      throw error;
    }
  }, [startTiming, endTiming]);

  return { startTiming, endTiming, measureAsync };
}