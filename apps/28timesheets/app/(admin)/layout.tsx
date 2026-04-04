'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BottomTabBar,
  CollapsibleSidebar,
  SidebarProvider,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  useIsMobile,
  Sheet,
  SheetContent,
  AppSwitcher,
} from '@relentify/ui'
import {
  Clock, Rss, CalendarDays, ClipboardCheck, LayoutDashboard,
  BarChart3, MapPin, Users, UserCog, Settings, Timer, Coffee,
  ScrollText, MoreHorizontal,
} from 'lucide-react'
import Link from 'next/link'

const NAV_ITEMS = [
  { label: 'Clock In', href: '/worker', icon: Clock, group: 'main' },
  { label: 'Feed', href: '/feed', icon: Rss, group: 'main' },
  { label: 'Schedule', href: '/schedule', icon: CalendarDays, group: 'main', minRole: 'manager' },
  { label: 'Approvals', href: '/approvals', icon: ClipboardCheck, group: 'main', minRole: 'manager' },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, group: 'main', minRole: 'admin' },
  { label: 'Reports', href: '/reports', icon: BarChart3, group: 'main', minRole: 'admin' },
  { label: 'Sites', href: '/sites', icon: MapPin, group: 'settings', minRole: 'admin' },
  { label: 'Workers', href: '/workers', icon: Users, group: 'settings', minRole: 'admin' },
  { label: 'Team', href: '/team', icon: UserCog, group: 'settings', minRole: 'admin' },
  { label: 'Overtime Rules', href: '/overtime-rules', icon: Timer, group: 'settings', minRole: 'admin' },
  { label: 'Break Rules', href: '/break-rules', icon: Coffee, group: 'settings', minRole: 'admin' },
  { label: 'Settings', href: '/settings', icon: Settings, group: 'settings', minRole: 'admin' },
  { label: 'Audit', href: '/audit', icon: ScrollText, group: 'settings', minRole: 'admin' },
]

const MOBILE_TABS = [
  { icon: <Clock size={20} />, label: 'Clock In', href: '/worker' },
  { icon: <Rss size={20} />, label: 'Feed', href: '/feed' },
  { icon: <CalendarDays size={20} />, label: 'Schedule', href: '/schedule' },
  { icon: <LayoutDashboard size={20} />, label: 'Dashboard', href: '/dashboard' },
  { icon: <MoreHorizontal size={20} />, label: 'More', href: '#more' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [moreOpen, setMoreOpen] = useState(false)

  // Close "more" sheet on nav
  useEffect(() => { setMoreOpen(false) }, [pathname])

  if (isMobile) {
    return (
      <div className="min-h-screen pb-16">
        {children}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-3 gap-3 p-4">
              {NAV_ITEMS.filter(i => !['Clock In', 'Feed', 'Schedule', 'Dashboard'].includes(i.label)).map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-[var(--theme-muted)] no-underline"
                  onClick={() => setMoreOpen(false)}
                >
                  <item.icon size={20} className="text-[var(--theme-text-muted)]" />
                  <span className="text-xs text-[var(--theme-text)]">{item.label}</span>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--theme-card)] border-t border-[var(--theme-border)] pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around h-14">
            {MOBILE_TABS.map(tab => {
              const isMore = tab.href === '#more'
              const isActive = !isMore && (pathname === tab.href || pathname.startsWith(tab.href + '/'))
              return (
                <button
                  key={tab.href}
                  onClick={() => isMore ? setMoreOpen(true) : (window.location.href = tab.href)}
                  className={`flex flex-col items-center gap-0.5 flex-1 h-full justify-center ${
                    isActive ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'
                  }`}
                >
                  {tab.icon}
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    )
  }

  // Desktop: CollapsibleSidebar
  const mainItems = NAV_ITEMS.filter(i => i.group === 'main')
  const settingsItems = NAV_ITEMS.filter(i => i.group === 'settings')

  return (
    <SidebarProvider>
      <CollapsibleSidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map(item => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + '/')}>
                      <Link href={item.href}>
                        <item.icon size={16} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsItems.map(item => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + '/')}>
                      <Link href={item.href}>
                        <item.icon size={16} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </CollapsibleSidebar>
      <SidebarInset>
        <div className="flex items-center justify-end p-2 border-b border-[var(--theme-border)]">
          <AppSwitcher currentApp="timesheets" />
        </div>
        <div className="p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
