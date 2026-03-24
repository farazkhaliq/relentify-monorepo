import { LayoutDashboard, Zap, History, Settings } from 'lucide-react';

export const NAV_ITEMS = [
  { name: 'My Tasks', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Momentum', href: '/dashboard/momentum', icon: Zap },
  { name: 'Activity', href: '/dashboard/activity', icon: History },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];
