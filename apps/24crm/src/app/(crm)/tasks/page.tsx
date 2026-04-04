import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getOrCreateEntityWorkspace, getLists } from '@/lib/services/reminders/workspace.service'
import { getTasks } from '@/lib/services/reminders/task.service'
import { TaskDashboard } from '@/components/reminders/TaskDashboard'

export default async function CrmTasksPage() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) redirect('https://auth.relentify.com/login?redirect=https://crm.relentify.com/tasks')

  const workspace = await getOrCreateEntityWorkspace(user.activeEntityId, user.userId)
  const lists = await getLists(workspace.id)
  const list = lists[0]
  const tasks = list ? await getTasks(list.id, user.userId) : []

  return <TaskDashboard initialTasks={tasks} user={user} listId={list?.id} workspaceId={workspace.id} />
}
