import { getAuthUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAuditLogs } from '@/lib/services/reminders/audit.service';
import { getWorkspaces, createWorkspace } from '@/lib/services/reminders/workspace.service';
import { format } from 'date-fns';
import { Badge, Card, PageHeader } from '@relentify/ui';

export default async function ActivityPage() {
  const user = await getAuthUser();
  if (!user) redirect('https://auth.relentify.com/login?redirect=https://reminders.relentify.com/activity');

  let workspaces = await getWorkspaces(user.userId);
  if (workspaces.length === 0) {
    await createWorkspace('My Workspace', user.userId);
    workspaces = await getWorkspaces(user.userId);
  }
  const workspace = workspaces[0];
  const logs = await getAuditLogs(workspace.id);

  return (
    <>
      <PageHeader
        title="My Activity"
        description="A full audit trail of everything you've done."
      />
      <div className="space-y-4 max-w-4xl">
        {logs.map((log: any) => (
          <Card key={log.id} className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--theme-border)]">
              <div className="h-2 w-2 rounded-full bg-[var(--theme-accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--theme-text)] uppercase tracking-tight">{log.action}</span>
                <span className="text-xs text-[var(--theme-text-muted)] font-medium">—</span>
                <span className="text-sm text-[var(--theme-text)] font-semibold truncate">{log.task_title || 'Workspace Action'}</span>
              </div>
              <p className="mt-0.5 text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">
                {format(new Date(log.timestamp), 'PPpp')} • {log.user_name}
              </p>
            </div>
            <div>
              {log.action === 'complete' && (
                <Badge variant="outline" className="text-[var(--theme-accent)] border-[var(--theme-accent)]/20 uppercase text-[var(--theme-text-10)] font-black tracking-widest">
                  +10 PTS
                </Badge>
              )}
            </div>
          </Card>
        ))}
        {logs.length === 0 && (
          <div className="py-20 text-center text-[var(--theme-text-muted)] font-medium">
            No activity recorded yet.
          </div>
        )}
      </div>
    </>
  );
}
