'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'relentify_analytics_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function dismiss() {
    setFading(true);
    localStorage.setItem(CONSENT_KEY, 'true');
    setTimeout(() => setVisible(false), 600);
  }

  useEffect(() => {
    if (localStorage.getItem(CONSENT_KEY)) return;
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    timerRef.current = setTimeout(() => dismiss(), 8000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{position:'fixed',bottom:'1.25rem',left:'1.25rem',zIndex:9999,maxWidth:'260px',backgroundColor:'var(--theme-card)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',border:'1px solid var(--theme-border)',borderRadius:'0.75rem',padding:'0.75rem 1rem',boxShadow:'var(--shadow-cinematic)',opacity:fading?0:1,transform:fading?'translateY(6px)':'translateY(0)',transition:'opacity 0.6s ease, transform 0.6s ease'}}>
      <p style={{fontSize:'0.7rem',color:'var(--theme-text-muted)',margin:0,lineHeight:1.6}}>
        We use cookies for analytics. By staying on this page, we assume you agree.{' '}
        <Link href="/privacy" style={{color:'var(--theme-accent)',textDecoration:'none'}}>Privacy policy</Link>.
      </p>
    </div>
  );
}
