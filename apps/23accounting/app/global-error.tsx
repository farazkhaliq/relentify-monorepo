'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button, ThemeProvider } from '@relentify/ui';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <ThemeProvider initialPreset="B">
        <body className="bg-background flex items-center justify-center min-h-screen m-0 font-sans">
          <div className="text-center text-foreground">
            <p className="text-[var(--theme-destructive)] font-bold mb-4">Something went wrong</p>
            <Button onClick={reset} variant="primary">
              Try again
            </Button>
          </div>
        </body>
      </ThemeProvider>
    </html>
  );
}
