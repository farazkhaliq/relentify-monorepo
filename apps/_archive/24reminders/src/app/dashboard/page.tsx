import { getAuthUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getWorkspaces, getLists } from '@/lib/workspace.service';
import { getTasks } from '@/lib/task.service';
import { TaskDashboard } from '@/components/TaskDashboard';
import { PageHeader } from '@relentify/ui';

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect('https://login.relentify.com/login');

  const workspaces = await getWorkspaces(user.userId);
  const workspace = workspaces[0];
  const lists = workspace ? await getLists(workspace.id) : [];
  const list = lists[0];
  const tasks = list ? await getTasks(list.id, user.userId) : [];

  return (
    <>
      <PageHeader
        title="My Tasks"
        description={`${workspace?.name || 'Default Workspace'} / ${list?.name || 'General'}`}
      />
      <TaskDashboard
        initialTasks={tasks}
        user={user}
        listId={list?.id}
        workspaceId={workspace?.id}
      />
    </>
  );
}
