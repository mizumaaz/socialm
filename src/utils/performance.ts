// Performance utilities for optimizing the application
export class PerformanceOptimizer {
  private static imageCache = new Map<string, HTMLImageElement>();
  private static requestCache = new Map<string, Promise<any>>();
  private static observers = new Map<string, IntersectionObserver>();

  // Optimized image loading with caching
  static async preloadImage(src: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(src)) {
      return this.imageCache.get(src)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  // Optimized API request caching
  static async cachedRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttlMs: number = 60000 // 1 minute default TTL
  ): Promise<T> {
    if (this.requestCache.has(key)) {
      return this.requestCache.get(key) as Promise<T>;
    }

    const promise = requestFn();
    this.requestCache.set(key, promise);

    // Auto-expire the cache entry
    setTimeout(() => {
      this.requestCache.delete(key);
    }, ttlMs);

    return promise;
  }

  // Lazy loading for images and components
  static createLazyLoader(
    onIntersect: (entry: IntersectionObserverEntry) => void,
    options: IntersectionObserverInit = { rootMargin: '100px', threshold: 0.1 }
  ): (element: Element) => void {
    const observerId = `observer-${Date.now()}`;
    
    if (!this.observers.has(observerId)) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            onIntersect(entry);
            observer.unobserve(entry.target);
          }
        });
      }, options);
      
      this.observers.set(observerId, observer);
    }
    
    const observer = this.observers.get(observerId)!;
    
    return (element: Element) => {
      if (element) {
        observer.observe(element);
      }
    };
  }

  // Optimized list rendering with windowing
  static getWindowedItems<T>(
    items: T[],
    scrollTop: number,
    containerHeight: number,
    itemHeight: number,
    overscan: number = 5
  ): { items: T[]; startIndex: number; endIndex: number; totalHeight: number } {
    const totalItems = items.length;
    const totalHeight = totalItems * itemHeight;
    
    const visibleStartIndex = Math.floor(scrollTop / itemHeight);
    const visibleEndIndex = Math.min(
      Math.ceil((scrollTop + containerHeight) / itemHeight),
      totalItems - 1
    );
    
    const startIndex = Math.max(0, visibleStartIndex - overscan);
    const endIndex = Math.min(totalItems - 1, visibleEndIndex + overscan);
    
    return {
      items: items.slice(startIndex, endIndex + 1),
      startIndex,
      endIndex,
      totalHeight
    };
  }

  // Debounce function for performance-critical event handlers
  static debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return function(...args: Parameters<T>) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  // Throttle function for scroll events
  static throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    
    return function(...args: Parameters<T>) {
      const now = Date.now();
      if (now - lastCall >= limit) {
        lastCall = now;
        return fn(...args);
      }
    };
  }

  // Memory management - clear caches
  static clearCaches(): void {
    this.imageCache.clear();
    this.requestCache.clear();
    
    // Disconnect and clear all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }

  // Optimize rendering with requestAnimationFrame
  static scheduleRender(renderFn: () => void): number {
    return requestAnimationFrame(renderFn);
  }

  // Batch DOM operations for better performance
  static batchDOMOperations(operations: (() => void)[]): void {
    // Use requestAnimationFrame to batch operations in the next frame
    requestAnimationFrame(() => {
      // Create a document fragment for batch operations
      const fragment = document.createDocumentFragment();
      
      // Execute all operations
      operations.forEach(operation => operation());
    });
  }

  // Optimize animations with hardware acceleration
  static applyHardwareAcceleration(element: HTMLElement): void {
    element.style.transform = 'translateZ(0)';
    element.style.backfaceVisibility = 'hidden';
    element.style.perspective = '1000px';
  }
}

// Optimized data structures for better performance
export class OptimizedDataStructures {
  // Efficient map implementation for frequent lookups
  static createLookupMap<K, V>(items: V[], keyFn: (item: V) => K): Map<K, V> {
    const map = new Map<K, V>();
    items.forEach(item => map.set(keyFn(item), item));
    return map;
  }

  // Efficient set implementation for membership checks
  static createLookupSet<T, K>(items: T[], keyFn: (item: T) => K): Set<K> {
    const set = new Set<K>();
    items.forEach(item => set.add(keyFn(item)));
    return set;
  }

  // Optimized array operations
  static arrayOperations = {
    // Efficient filtering without creating new arrays
    filterInPlace<T>(array: T[], predicate: (value: T, index: number, array: T[]) => boolean): T[] {
      let j = 0;
      
      for (let i = 0; i < array.length; i++) {
        const val = array[i];
        if (predicate(val, i, array)) {
          array[j++] = val;
        }
      }
      
      array.length = j;
      return array;
    },
    
    // Efficient unique values
    uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
      const seen = new Set<K>();
      return array.filter(item => {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  };
}

// Memory management utilities
export class MemoryManager {
  private static intervals: Set<NodeJS.Timeout> = new Set();
  private static timeouts: Set<NodeJS.Timeout> = new Set();
  private static animationFrames: Set<number> = new Set();
  
  // Register and track timeouts
  static setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const id = setTimeout(() => {
      callback();
      this.timeouts.delete(id);
    }, delay);
    
    this.timeouts.add(id);
    return id;
  }
  
  // Register and track intervals
  static setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const id = setInterval(callback, delay);
    this.intervals.add(id);
    return id;
  }
  
  // Register and track animation frames
  static requestAnimationFrame(callback: () => void): number {
    const id = requestAnimationFrame(() => {
      callback();
      this.animationFrames.delete(id);
    });
    
    this.animationFrames.add(id);
    return id;
  }
  
  // Clear a specific timeout
  static clearTimeout(id: NodeJS.Timeout): void {
    clearTimeout(id);
    this.timeouts.delete(id);
  }
  
  // Clear a specific interval
  static clearInterval(id: NodeJS.Timeout): void {
    clearInterval(id);
    this.intervals.delete(id);
  }
  
  // Clear a specific animation frame
  static cancelAnimationFrame(id: number): void {
    cancelAnimationFrame(id);
    this.animationFrames.delete(id);
  }
  
  // Clear all registered timeouts
  static clearAllTimeouts(): void {
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts.clear();
  }
  
  // Clear all registered intervals
  static clearAllIntervals(): void {
    this.intervals.forEach(id => clearInterval(id));
    this.intervals.clear();
  }
  
  // Clear all registered animation frames
  static cancelAllAnimationFrames(): void {
    this.animationFrames.forEach(id => cancelAnimationFrame(id));
    this.animationFrames.clear();
  }
  
  // Clear everything
  static clearAll(): void {
    this.clearAllTimeouts();
    this.clearAllIntervals();
    this.cancelAllAnimationFrames();
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static metrics = new Map<string, { start: number; count: number; total: number }>();
  
  // Start timing a specific operation
  static startTiming(label: string): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, { start: 0, count: 0, total: 0 });
    }
    
    const metric = this.metrics.get(label)!;
    metric.start = performance.now();
  }
  
  // End timing and record the duration
  static endTiming(label: string): number {
    const metric = this.metrics.get(label);
    if (!metric) return 0;
    
    const duration = performance.now() - metric.start;
    metric.count++;
    metric.total += duration;
    
    return duration;
  }
  
  // Get average duration for a specific operation
  static getAverageDuration(label: string): number {
    const metric = this.metrics.get(label);
    if (!metric || metric.count === 0) return 0;
    
    return metric.total / metric.count;
  }
  
  // Log all recorded metrics
  static logMetrics(): void {
    console.group('Performance Metrics');
    this.metrics.forEach((metric, label) => {
      if (metric.count > 0) {
        console.log(
          `${label}: ${metric.count} calls, avg ${(metric.total / metric.count).toFixed(2)}ms, total ${metric.total.toFixed(2)}ms`
        );
      }
    });
    console.groupEnd();
  }
  
  // Reset all metrics
  static resetMetrics(): void {
    this.metrics.clear();
  }
  
  // Measure an async function execution time
  static async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.startTiming(label);
    try {
      return await fn();
    } finally {
      this.endTiming(label);
    }
  }
  
  // Measure a synchronous function execution time
  static measureSync<T>(label: string, fn: () => T): T {
    this.startTiming(label);
    try {
      return fn();
    } finally {
      this.endTiming(label);
    }
  }
}