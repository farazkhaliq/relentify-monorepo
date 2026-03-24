"use client";

import { useEffect } from 'react';

export function ScrollToTop() {
  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0);
      }
    };
    // Listen for custom events or just run on mount
    handleScroll();
  }, []);
  
  return null;
}
