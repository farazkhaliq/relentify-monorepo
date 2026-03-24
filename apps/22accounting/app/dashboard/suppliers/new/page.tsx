import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/lib/auth';
import NewSupplierForm from '@/src/components/NewSupplierForm';

export default async function NewSupplierPage() {
  const auth = await getAuthUser();
  if (!auth) redirect('/login');

  return (
    <div className="min-h-screen bg-[var(--theme-primary)]/3">
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight mb-8">New Supplier</h2>
        <NewSupplierForm />
      </main>
    </div>
  );
}
