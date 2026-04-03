'use client'

import { usePathname } from 'next/navigation'
import { BottomTabBar } from '@relentify/ui'
import { Clock, ListTodo, FileText } from 'lucide-react'

const WORKER_TABS = [
  { icon: <Clock size={20} />, label: 'Clock In', href: '/worker' },
  { icon: <ListTodo size={20} />, label: 'My Shifts', href: '/worker/shifts' },
  { icon: <FileText size={20} />, label: 'Timesheets', href: '/worker/timesheets' },
]

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      {children}
      <BottomTabBar items={WORKER_TABS} activeHref={pathname} />
    </div>
  )
}
