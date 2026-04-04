'use client';
import Script from 'next/script';

export default function ChatWidget() {
  return (
    <Script
      src="https://chat.relentify.com/widget.js"
      data-entity-id="13f1f21c-955e-4f09-8b26-247db0ba4943"
      strategy="lazyOnload"
    />
  );
}
