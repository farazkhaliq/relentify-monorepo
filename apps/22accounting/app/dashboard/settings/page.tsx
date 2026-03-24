import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import SettingsForm from '@/src/components/SettingsForm';

export default async function SettingsPage() {
  const auth = await getAuthUser();
  if (!auth) redirect('/login');

  const user = await getUserById(auth.userId);
  if (!user) redirect('/login');

  const entity = await getActiveEntity(auth.userId);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight mb-8">Settings</h2>
      <SettingsForm user={{ ...user, last_fy_end_date: entity?.last_fy_end_date ?? null }} />
    </main>
  );
}
