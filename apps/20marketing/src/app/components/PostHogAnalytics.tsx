import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

export default function PostHogAnalytics() {
  const location = useLocation();

  useEffect(() => {
    if (!POSTHOG_KEY) return;
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
  }, []);

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    import('posthog-js').then(({ default: posthog }) => {
      if (!posthog.__loaded) return;
      posthog.capture('$pageview');
    });
  }, [location.pathname, location.search]);

  return null;
}
