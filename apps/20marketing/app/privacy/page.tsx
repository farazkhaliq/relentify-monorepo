'use client';
import React from 'react';
import { useTheme } from '@relentify/ui';

export default function Privacy() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h1
          className={`text-5xl font-bold tracking-tighter mb-4 ${theme.typography.headings}`}
          style={{ color: `var(--theme-text)` }}
        >
          Privacy Policy
        </h1>
        <p className="text-sm mb-16" style={{ color: `var(--theme-text-muted)` }}>
          Last updated: March 2026
        </p>

        <div className="space-y-12" style={{ color: `var(--theme-text)` }}>

          <section>
            <h2 className="text-xl font-semibold mb-4" style={{ color: `var(--theme-text)` }}>
              Who we are
            </h2>
            <p className="leading-relaxed" style={{ color: `var(--theme-text-muted)` }}>
              Relentify is a business software suite. This policy explains what data we collect,
              why we collect it, and how we use it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4" style={{ color: `var(--theme-text)` }}>
              What we collect
            </h2>
            <ul className="space-y-3" style={{ color: `var(--theme-text-muted)` }}>
              <li className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `var(--theme-primary)` }} />
                <span><strong style={{ color: `var(--theme-text)` }}>Account data</strong> — your name, email address, and business details you provide when signing up.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `var(--theme-primary)` }} />
                <span><strong style={{ color: `var(--theme-text)` }}>Business data</strong> — invoices, transactions, contacts, and other records you create inside the product.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `var(--theme-primary)` }} />
                <span><strong style={{ color: `var(--theme-text)` }}>Usage data</strong> — pages visited and features used, collected via PostHog analytics. This helps us improve the product.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `var(--theme-primary)` }} />
                <span><strong style={{ color: `var(--theme-text)` }}>Payment data</strong> — handled entirely by Stripe. We never see or store your card details.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4" style={{ color: `var(--theme-text)` }}>
              How we use it
            </h2>
            <ul className="space-y-3" style={{ color: `var(--theme-text-muted)` }}>
              <li className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `var(--theme-primary)` }} />
                <span>To provide and operate the Relentify services you've signed up for.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `var(--theme-primary)` }} />
                <span>To send you transactional emails (invoices, payment receipts, account alerts). No marketing unless you opt in.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `var(--theme-primary)` }} />
                <span>To understand how the product is used so we can improve it.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4" style={{ color: `var(--theme-text)` }}>
              Who we share it with
            </h2>
            <p className="leading-relaxed mb-4" style={{ color: `var(--theme-text-muted)` }}>
              We don't sell your data. We share it only with the services needed to run the product:
            </p>
            <ul className="space-y-3" style={{ color: `var(--theme-text-muted)` }}>
              <li className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `var(--theme-primary)` }} />
                <span><strong style={{ color: `var(--theme-text)` }}>Stripe</strong> — payment processing.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `var(--theme-primary)` }} />
                <span><strong style={{ color: `var(--theme-text)` }}>PostHog</strong> — product analytics.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `var(--theme-primary)` }} />
                <span><strong style={{ color: `var(--theme-text)` }}>Hetzner / our VPS host</strong> — infrastructure and data storage.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4" style={{ color: `var(--theme-text)` }}>
              Data retention
            </h2>
            <p className="leading-relaxed" style={{ color: `var(--theme-text-muted)` }}>
              We keep your data for as long as your account is active. If you close your account,
              we delete your personal data within 30 days. Business records (invoices etc.) may be
              retained for up to 7 years to meet legal requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4" style={{ color: `var(--theme-text)` }}>
              Your rights
            </h2>
            <p className="leading-relaxed mb-4" style={{ color: `var(--theme-text-muted)` }}>
              You can request a copy of your data or delete your account at any time from the
              Settings page inside any Relentify app. For anything else, email us at{' '}
              <a
                href="mailto:privacy@relentify.com"
                style={{ color: `var(--theme-primary)` }}
                className="hover:underline"
              >
                privacy@relentify.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4" style={{ color: `var(--theme-text)` }}>
              Cookies
            </h2>
            <p className="leading-relaxed" style={{ color: `var(--theme-text-muted)` }}>
              We use cookies for analytics (PostHog) and to keep you logged in. We don't use
              advertising cookies or sell data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4" style={{ color: `var(--theme-text)` }}>
              Changes
            </h2>
            <p className="leading-relaxed" style={{ color: `var(--theme-text-muted)` }}>
              We'll update this page if anything material changes. The date at the top shows
              when it was last revised.
            </p>
          </section>

          <div
            className="mt-16 pt-8 border-t"
            style={{ borderColor: `var(--theme-border)`, color: `var(--theme-text-dim)` }}
          >
            <p className="text-sm">
              Relentify · privacy@relentify.com
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
