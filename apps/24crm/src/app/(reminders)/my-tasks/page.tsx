import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getWorkspaces, getLists, createWorkspace } from '@/lib/services/reminders/workspace.service'
import { getTasks } from '@/lib/services/reminders/task.service'
import { TaskDashboard } from '@/components/reminders/TaskDashboard'

export default async function MyTasksPage() {
  const user = await getAuthUser()
  if (!user) redirect('https://auth.relentify.com/login?redirect=https://reminders.relentify.com/my-tasks')

  let workspaces = await getWorkspaces(user.userId)
  if (workspaces.length === 0) {
    await createWorkspace('My Workspace', user.userId)
    workspaces = await getWorkspaces(user.userId)
  }
  const workspace = workspaces[0]
  const lists = await getLists(workspace.id)
  const list = lists[0]
  const tasks = list ? await getTasks(list.id, user.userId) : []

  return <TaskDashboard initialTasks={tasks} user={user} listId={list?.id} workspaceId={workspace.id} />
}
