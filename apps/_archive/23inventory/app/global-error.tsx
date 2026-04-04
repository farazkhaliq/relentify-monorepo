'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html><body style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: 'var(--theme-background)', color: 'var(--theme-text)' }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Something went wrong</h2>
        <button onClick={reset} style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer', background: 'var(--theme-card)', color: 'var(--theme-text)', border: '1px solid var(--theme-border)', borderRadius: 8 }}>Try again</button>
      </div>
    </body></html>
  );
}
