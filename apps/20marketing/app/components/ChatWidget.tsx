'use client';
import { useEffect } from 'react';

export default function ChatWidget() {
  useEffect(() => {
    (window as any).chatwootSettings = {
      position: 'right',
      type: 'expanded_bubble',
      launcherTitle: 'Chat with us',
      showPopoutButton: false,
      darkMode: 'auto',
    };
    const s = document.createElement('script');
    s.src = 'https://chat.relentify.com/packs/js/sdk.js';
    s.async = true;
    s.defer = true;
    s.onload = () => {
      (window as any).chatwootSDK?.run({
        websiteToken: 'ca9Jcc8BiJQD68gdgCyYPqKA',
        baseUrl: 'https://chat.relentify.com',
      });
    };
    document.head.appendChild(s);
    return () => { document.head.removeChild(s); };
  }, []);
  return null;
}
