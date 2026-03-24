import { getAuthUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, Button, PageHeader } from '@relentify/ui';
import { Bell, Shield, Smartphone, Globe } from 'lucide-react';

export default async function SettingsPage() {
  const user = await getAuthUser();
  if (!user) redirect('https://login.relentify.com/login');

  return (
    <>
      <PageHeader
        title="Workspace Settings"
        description="Manage your notification preferences and gamification."
      />

      <div className="grid gap-6 max-w-4xl">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--theme-text)] mb-6">
            <Bell className="h-4 w-4 text-[var(--theme-accent)]" />
            Notification Channels
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-[var(--theme-border)] dark:bg-[var(--theme-border)] border border-[var(--theme-border)] rounded-cinematic">
               <div className="flex items-center gap-4">
                 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]">
                   <Smartphone className="h-5 w-5" />
                 </div>
                 <div>
                   <p className="text-sm font-bold text-[var(--theme-text)]">Telegram Integration</p>
                   <p className="text-xs text-[var(--theme-text-muted)]">Receive instant reminders via Telegram bot.</p>
                 </div>
               </div>
               <Button variant="outline" size="sm" className="font-bold text-[var(--theme-text-10)] uppercase tracking-widest">Connect</Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-[var(--theme-border)] dark:bg-[var(--theme-border)] border border-[var(--theme-border)] rounded-cinematic">
               <div className="flex items-center gap-4">
                 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]">
                   <Globe className="h-5 w-5" />
                 </div>
                 <div>
                   <p className="text-sm font-bold text-[var(--theme-text)]">Email Digests</p>
                   <p className="text-xs text-[var(--theme-text-muted)]">A daily summary of your outstanding tasks.</p>
                 </div>
               </div>
               <div className="flex h-6 w-11 items-center rounded-full bg-[var(--theme-accent)] px-1">
                  <div className="h-4 w-4 rounded-full bg-[var(--theme-background)] ml-auto" />
               </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--theme-text)] mb-4">
            <Shield className="h-4 w-4 text-[var(--theme-accent)]" />
            Gamification
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--theme-text)]">Enable Points & Leaderboard</p>
              <p className="text-xs text-[var(--theme-text-muted)]">Compete with your team and earn badges.</p>
            </div>
            <div className="flex h-6 w-11 items-center rounded-full bg-[var(--theme-accent)] px-1">
               <div className="h-4 w-4 rounded-full bg-[var(--theme-background)] ml-auto" />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
