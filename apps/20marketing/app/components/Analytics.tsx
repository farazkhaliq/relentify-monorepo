'use client';

import { useEffect, Suspense } from 'react';
import { usePathname } from 'next/navigation';

function GAScript() {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    if (!gaMeasurementId) return;

    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
    script.async = true;
    document.head.appendChild(script);

    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) {
      (window as any).dataLayer.push(args);
    }
    (window as any).gtag = gtag;
    gtag('js', new Date());
    gtag('config', gaMeasurementId);

    return () => {
      document.head.removeChild(script);
    };
  }, [gaMeasurementId]);

  return null;
}

function PostHogScript() {
  const pathname = usePathname();
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  useEffect(() => {
    if (!posthogKey) return;

    import('posthog-js').then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(posthogKey, {
          api_host: posthogHost || 'https://app.posthog.com',
          capture_pageview: false,
        });
      }
      posthog.capture('$pageview', { $current_url: window.location.href });
    });
  }, [pathname, posthogKey, posthogHost]);

  return null;
}

export default function Analytics() {
  return (
    <>
      <GAScript />
      <PostHogScript />
    </>
  );
}
