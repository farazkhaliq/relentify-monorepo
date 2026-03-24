'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function AcceptContent() {
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'unauthenticated'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('No invitation token found.'); return; }

    fetch('/api/team/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(r => r.json()).then(data => {
      if (data.error === 'You must be logged in to accept an invitation') {
        setStatus('unauthenticated');
      } else if (data.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Failed to accept invitation');
      }
    }).catch(() => { setStatus('error'); setErrorMsg('Something went wrong. Please try again.'); });
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-[var(--theme-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[var(--theme-text-muted)] text-sm">Verifying invitation…</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    const redirectUrl = `/dashboard/team/accept?token=${token}`;
    return (
      <div className="text-center space-y-4">
        <div className="w-12 h-12 bg-[var(--theme-warning)]/10 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-[var(--theme-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 className="text-lg font-bold text-[var(--theme-text)]">Please log in first</h2>
        <p className="text-[var(--theme-text-muted)] text-sm">You need a Relentify account to accept this invitation.</p>
        <a
          href={`https://login.relentify.com?redirect=${encodeURIComponent(`https://accounts.relentify.com${redirectUrl}`)}`}
          className="inline-block px-5 py-2.5 bg-[var(--theme-accent)] hover:bg-[var(--theme-accent)] text-[var(--theme-text)] text-sm font-bold rounded-lg transition-colors no-underline"
        >
          Log in to accept
        </a>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-center space-y-4">
        <div className="w-12 h-12 bg-[var(--theme-destructive)]/10 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-[var(--theme-destructive)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </div>
        <h2 className="text-lg font-bold text-[var(--theme-text)]">Invitation error</h2>
        <p className="text-[var(--theme-text-muted)] text-sm">{errorMsg}</p>
        <Link href="/dashboard" className="inline-block px-5 py-2.5 bg-[var(--theme-card)] hover:bg-[var(--theme-border)]/40 text-[var(--theme-text)] text-sm font-bold rounded-lg transition-colors no-underline">
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="w-12 h-12 bg-[var(--theme-accent)]/10 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-[var(--theme-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      </div>
      <h2 className="text-lg font-bold text-[var(--theme-text)]">You're in!</h2>
      <p className="text-[var(--theme-text-muted)] text-sm">Your invitation has been accepted. You can now switch to the shared workspace from the navigation.</p>
      <Link href="/dashboard" className="inline-block px-5 py-2.5 bg-[var(--theme-accent)] hover:bg-[var(--theme-accent)] text-[var(--theme-text)] text-sm font-bold rounded-lg transition-colors no-underline">
        Go to dashboard
      </Link>
    </div>
  );
}

export default function AcceptPage() {
  return (
    <div className="min-h-screen bg-[var(--theme-primary)]/3 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic p-8">
        <div className="mb-6 text-center">
          <span className="w-10 h-10 bg-[var(--theme-accent)] rounded-cinematic flex items-center justify-center shadow-lg mx-auto mb-3">
            <span className="text-lg font-black italic text-[var(--theme-text)]">R</span>
          </span>
          <h1 className="text-xl font-black text-[var(--theme-text)]">Workspace invitation</h1>
        </div>
        <Suspense fallback={<div className="text-center text-[var(--theme-text-muted)] text-sm">Loading…</div>}>
          <AcceptContent />
        </Suspense>
      </div>
    </div>
  );
}
