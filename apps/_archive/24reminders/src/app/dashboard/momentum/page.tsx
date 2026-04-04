import { getAuthUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MomentumView } from '@/components/MomentumView';
import { getTasks } from '@/lib/task.service';
import { getLists, getWorkspaces } from '@/lib/workspace.service';
import { PageHeader } from '@relentify/ui';

export default async function MomentumPage() {
  const user = await getAuthUser();
  if (!user) redirect('https://login.relentify.com/login');

  const workspaces = await getWorkspaces(user.userId);
  const workspace = workspaces[0];
  const lists = workspace ? await getLists(workspace.id) : [];
  const list = lists[0];
  const tasks = list ? await getTasks(list.id, user.userId) : [];

  const activeTasks = tasks.filter((t: any) => t.status !== 'Completed' && t.status !== 'Cancelled');

  return (
    <>
      <PageHeader
        title="Momentum Mode"
        description="One task at a time. Zero distractions."
      />
      <div className="mx-auto max-w-3xl mt-12">
        <MomentumView initialTasks={activeTasks} user={user} />
      </div>
    </>
  );
}
