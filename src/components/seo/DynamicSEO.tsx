import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface SEOData {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
  canonicalUrl: string;
}

const defaultSEO: SEOData = {
  title: 'SocialChat - Real-time Social Messaging Platform | Connect with Friends',
  description: 'Join SocialChat - the ultimate real-time social messaging platform. Connect with friends, share posts and stories, chat instantly, build your social network.',
  keywords: ['social media', 'chat app', 'messaging platform', 'real-time chat', 'social network'],
  ogImage: 'https://socialchat.site/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
  canonicalUrl: 'https://socialchat.site/'
};

export function DynamicSEO() {
  const location = useLocation();
  
  useEffect(() => {
    const fetchSEOData = async () => {
      try {
        // Try to get SEO data for current path
        const { data, error } = await supabase
          .from('seo_metadata')
          .select('title, description, keywords, og_image, canonical_url')
          .eq('page_path', location.pathname)
          .single();
          
        if (error) {
          console.log('No specific SEO data for this path, using defaults');
          updateMetaTags(defaultSEO);
          return;
        }
        
        if (data) {
          updateMetaTags({
            title: data.title,
            description: data.description,
            keywords: data.keywords || [],
            ogImage: data.og_image || defaultSEO.ogImage,
            canonicalUrl: data.canonical_url || `https://socialchat.site${location.pathname}`
          });
        }
      } catch (error) {
        console.error('Error fetching SEO data:', error);
        updateMetaTags(defaultSEO);
      }
    };
    
    fetchSEOData();
  }, [location.pathname]);
  
  const updateMetaTags = (seo: SEOData) => {
    // Update title
    document.title = seo.title;
    
    // Update meta tags
    updateMetaTag('description', seo.description);
    updateMetaTag('keywords', seo.keywords.join(', '));
    
    // Update Open Graph tags
    updateMetaTag('og:title', seo.title);
    updateMetaTag('og:description', seo.description);
    updateMetaTag('og:image', seo.ogImage);
    updateMetaTag('og:url', seo.canonicalUrl);
    
    // Update Twitter tags
    updateMetaTag('twitter:title', seo.title);
    updateMetaTag('twitter:description', seo.description);
    updateMetaTag('twitter:image', seo.ogImage);
    
    // Update canonical URL
    let canonicalElement = document.querySelector('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement('link');
      canonicalElement.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.setAttribute('href', seo.canonicalUrl);
  };
  
  const updateMetaTag = (name: string, content: string) => {
    // Try to find by name or property
    let metaTag = document.querySelector(`meta[name="${name}"]`) || 
                  document.querySelector(`meta[property="${name}"]`);
    
    if (!metaTag) {
      metaTag = document.createElement('meta');
      if (name.startsWith('og:') || name.startsWith('twitter:')) {
        metaTag.setAttribute('property', name);
      } else {
        metaTag.setAttribute('name', name);
      }
      document.head.appendChild(metaTag);
    }
    
    metaTag.setAttribute('content', content);
  };
  
  return null; // This component doesn't render anything
}