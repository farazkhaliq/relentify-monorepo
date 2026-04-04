'use client';

import { useState } from 'react';
import { ApiKeysPanel } from './ApiKeysPanel';
import { WebhooksPanel } from './WebhooksPanel';

export function SettingsTabs({ settingsForm }: { settingsForm: React.ReactNode }) {
  const [tab, setTab] = useState<'general' | 'api-keys' | 'webhooks'>('general');

  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--theme-border)] mb-8">
        {(['general', 'api-keys', 'webhooks'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'text-[var(--theme-accent)] border-[var(--theme-accent)]'
                : 'text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text)]'
            }`}
          >
            {t === 'general' ? 'General' : t === 'api-keys' ? 'API Keys' : 'Webhooks'}
          </button>
        ))}
      </div>
      {tab === 'general' && settingsForm}
      {tab === 'api-keys' && <ApiKeysPanel />}
      {tab === 'webhooks' && <WebhooksPanel />}
    </div>
  );
}
