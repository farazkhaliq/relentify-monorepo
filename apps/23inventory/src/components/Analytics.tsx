'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

function initPosthog() {
  if (!POSTHOG_KEY || typeof window === 'undefined') return;
  import('posthog-js').then(({ default: posthog }) => {
    if (posthog.__loaded) return;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      persistence: 'localStorage+cookie',
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: { password: true },
      },
    });
  });
}

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPosthog();
  }, []);

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    import('posthog-js').then(({ default: posthog }) => {
      if (!posthog.__loaded) return;
      posthog.capture('$pageview');
    });
  }, [pathname, searchParams]);

  return null;
}
