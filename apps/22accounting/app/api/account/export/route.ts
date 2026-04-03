import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { query } from '@/src/lib/db';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const userId = auth.userId;

  // Fetch all user data in parallel
  const [
    userResult,
    entitiesResult,
    invoicesResult,
    billsResult,
    expensesResult,
    mileageResult,
    customersResult,
    suppliersResult,
  ] = await Promise.all([
    query(`SELECT id, email, full_name, company_number, vat_number, created_at FROM users WHERE id = $1`, [userId]),
    query(`SELECT id, name, business_structure, vat_registered, vat_number, created_at FROM entities WHERE user_id = $1`, [userId]),
    query(`SELECT i.invoice_number, i.status, i.subtotal, i.tax_amount, i.total, i.issue_date, i.due_date, c.name as customer_name FROM acc_invoices i LEFT JOIN acc_customers c ON i.customer_id = c.id WHERE i.user_id = $1 ORDER BY i.issue_date DESC`, [userId]),
    query(`SELECT b.reference, b.status, b.amount, b.vat_amount, b.invoice_date, b.due_date, b.supplier_name FROM acc_bills b WHERE b.user_id = $1 ORDER BY b.invoice_date DESC`, [userId]),
    query(`SELECT description, gross_amount, category, status, date FROM acc_expenses WHERE user_id = $1 ORDER BY date DESC`, [userId]),
    query(`SELECT description, miles, rate, amount, date, status FROM acc_mileage_claims WHERE user_id = $1 ORDER BY date DESC`, [userId]),
    query(`SELECT name, email, phone, address FROM acc_customers WHERE user_id = $1 ORDER BY name`, [userId]),
    query(`SELECT name, email, phone, address FROM acc_suppliers WHERE user_id = $1 ORDER BY name`, [userId]),
  ]);

  function toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => {
          const v = row[h];
          if (v == null) return '';
          const s = String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        }).join(',')
      ),
    ];
    return lines.join('\n');
  }

  const sections = [
    { label: 'Account', rows: userResult.rows },
    { label: 'Business Entities', rows: entitiesResult.rows },
    { label: 'Invoices', rows: invoicesResult.rows },
    { label: 'Bills', rows: billsResult.rows },
    { label: 'Expenses', rows: expensesResult.rows },
    { label: 'Mileage Claims', rows: mileageResult.rows },
    { label: 'Customers', rows: customersResult.rows },
    { label: 'Suppliers', rows: suppliersResult.rows },
  ];

  const csv = sections
    .map(s => `# ${s.label}\n${toCsv(s.rows)}`)
    .join('\n\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="relentify-data-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
