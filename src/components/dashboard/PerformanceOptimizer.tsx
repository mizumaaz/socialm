import React, { useEffect } from 'react';

interface PerformanceOptimizerProps {
  children: React.ReactNode;
}

export function PerformanceOptimizer({ children }: PerformanceOptimizerProps) {
  useEffect(() => {
    // Optimize image loading
    const lazyLoadImages = () => {
      const images = document.querySelectorAll('img[data-src]');
      
      if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const image = entry.target as HTMLImageElement;
              image.src = image.dataset.src || '';
              image.removeAttribute('data-src');
              imageObserver.unobserve(image);
            }
          });
        });
        
        images.forEach(img => imageObserver.observe(img));
      } else {
        // Fallback for browsers without IntersectionObserver
        images.forEach(img => {
          const image = img as HTMLImageElement;
          image.src = image.dataset.src || '';
          image.removeAttribute('data-src');
        });
      }
    };

    // Optimize script loading
    const deferNonCriticalScripts = () => {
      const scripts = document.querySelectorAll('script[data-defer]');
      
      scripts.forEach(script => {
        const newScript = document.createElement('script');
        
        Array.from(script.attributes).forEach(attr => {
          if (attr.name !== 'data-defer') {
            newScript.setAttribute(attr.name, attr.value);
          }
        });
        
        newScript.innerHTML = script.innerHTML;
        script.parentNode?.replaceChild(newScript, script);
      });
    };

    // Preconnect to important domains
    const addPreconnect = () => {
      const domains = [
        'https://jhppdxxamrvayvpruwde.supabase.co',
        'https://www.googleapis.com',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com'
      ];
      
      domains.forEach(domain => {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = domain;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      });
    };

    // Add event listeners for performance monitoring
    const setupPerformanceMonitoring = () => {
      if ('PerformanceObserver' in window) {
        try {
          // Monitor long tasks
          const longTaskObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
              console.log('Long task detected:', entry.duration, 'ms');
            });
          });
          longTaskObserver.observe({ entryTypes: ['longtask'] });
          
          // Monitor layout shifts
          const layoutShiftObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
              if ((entry as any).hadRecentInput) return;
              console.log('Layout shift detected:', (entry as any).value);
            });
          });
          layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
          
          // Monitor largest contentful paint
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            console.log('Largest Contentful Paint:', lastEntry.startTime, 'ms');
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (e) {
          console.error('Performance observer error:', e);
        }
      }
    };

    // Run optimizations
    lazyLoadImages();
    deferNonCriticalScripts();
    addPreconnect();
    setupPerformanceMonitoring();

    // Clean up event listeners
    return () => {
      if ('PerformanceObserver' in window) {
        PerformanceObserver.supportedEntryTypes.forEach(type => {
          try {
            const observer = new PerformanceObserver(() => {});
            observer.observe({ entryTypes: [type] });
            observer.disconnect();
          } catch (e) {
            // Ignore errors
          }
        });
      }
    };
  }, []);

  return <>{children}</>;
}