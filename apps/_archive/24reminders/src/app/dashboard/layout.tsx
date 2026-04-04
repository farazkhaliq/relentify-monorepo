import { getAuthUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect('https://auth.relentify.com/login?redirect=https://reminders.relentify.com/dashboard');

  return <AppLayout user={user}>{children}</AppLayout>;
}
