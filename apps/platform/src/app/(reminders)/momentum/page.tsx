import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MomentumView } from '@/components/reminders/MomentumView'
import { getTasks } from '@/lib/services/reminders/task.service'
import { getLists, getWorkspaces, createWorkspace } from '@/lib/services/reminders/workspace.service'

export default async function MomentumPage() {
  const user = await getAuthUser()
  if (!user) redirect('https://auth.relentify.com/login?redirect=https://reminders.relentify.com/momentum')

  let workspaces = await getWorkspaces(user.userId)
  if (workspaces.length === 0) {
    await createWorkspace('My Workspace', user.userId)
    workspaces = await getWorkspaces(user.userId)
  }
  const workspace = workspaces[0]
  const lists = await getLists(workspace.id)
  const list = lists[0]
  const tasks = list ? await getTasks(list.id, user.userId) : []
  const activeTasks = tasks.filter((t: any) => t.status !== 'Completed' && t.status !== 'Cancelled')

  return (
    <div className="mx-auto max-w-3xl mt-12">
      <MomentumView initialTasks={activeTasks} user={user} />
    </div>
  )
}
