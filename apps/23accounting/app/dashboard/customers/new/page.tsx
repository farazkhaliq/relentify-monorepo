import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/lib/auth';
import NewCustomerForm from '@/src/components/NewCustomerForm';

export default async function NewCustomerPage() {
  const auth = await getAuthUser();
  if (!auth) redirect('/login');

  return (
    <div className="min-h-screen bg-[var(--theme-primary)]/3">
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight mb-8">New Customer</h2>
        <NewCustomerForm />
      </main>
    </div>
  );
}
