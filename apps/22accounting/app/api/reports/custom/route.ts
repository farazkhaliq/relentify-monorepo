import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { canAccess } from '@/src/lib/tiers';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { query } from '@/src/lib/db';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  invoice: 'Invoices',
  bill: 'Bills',
  expense: 'Expenses',
  mileage: 'Mileage',
  payment: 'Payments',
  manual: 'Manual Journals',
  credit_note: 'Credit Notes',
};

function formatSourceType(s: string): string {
  return SOURCE_TYPE_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'real_time_reports')) {
      return NextResponse.json({ error: 'Upgrade to Sole Trader or above to access custom reports' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const today = new Date();
    const from = searchParams.get('from') || `${today.getFullYear()}-01-01`;
    const to = searchParams.get('to') || today.toISOString().split('T')[0];
    const accountTypesParam = searchParams.get('accountTypes') || '';
    const accountCodesParam = searchParams.get('accountCodes') || '';
    const groupBy = (searchParams.get('groupBy') || 'account') as 'account' | 'source_type' | 'month';

    const accountTypes = accountTypesParam ? accountTypesParam.split(',').filter(Boolean) : [];
    const accountCodes = accountCodesParam ? accountCodesParam.split(',').map(Number).filter(Boolean) : [];

    const params: (string | number)[] = [entity.id, from, to];
    let typeFilter = '';
    let codeFilter = '';

    if (accountTypes.length > 0) {
      const placeholders = accountTypes.map((_, i) => `$${params.length + i + 1}`).join(',');
      accountTypes.forEach(t => params.push(t));
      typeFilter = `AND coa.account_type IN (${placeholders})`;
    }

    if (accountCodes.length > 0) {
      const placeholders = accountCodes.map((_, i) => `$${params.length + i + 1}`).join(',');
      accountCodes.forEach(c => params.push(c));
      codeFilter = `AND coa.code IN (${placeholders})`;
    }

    const linesRes = await query(
      `SELECT
         je.entry_date,
         je.reference,
         je.description AS entry_description,
         je.source_type,
         jl.description AS line_description,
         jl.debit,
         jl.credit,
         coa.code AS account_code,
         coa.name AS account_name,
         coa.account_type
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
       WHERE je.entity_id = $1
         AND je.entry_date >= $2
         AND je.entry_date <= $3
         ${typeFilter}
         ${codeFilter}
       ORDER BY je.entry_date ASC, je.created_at ASC, coa.code ASC`,
      params
    );

    type Line = {
      date: string;
      reference: string;
      description: string;
      accountCode: number;
      accountName: string;
      accountType: string;
      sourceType: string;
      debit: number;
      credit: number;
    };

    const lines: Line[] = linesRes.rows.map((r: Record<string, unknown>) => ({
      date: r.entry_date instanceof Date
        ? (r.entry_date as Date).toISOString().split('T')[0]
        : String(r.entry_date).split('T')[0],
      reference: String(r.reference || ''),
      description: String(r.line_description || r.entry_description || ''),
      accountCode: parseInt(String(r.account_code)),
      accountName: String(r.account_name),
      accountType: String(r.account_type),
      sourceType: String(r.source_type || 'manual'),
      debit: parseFloat(String(r.debit)) || 0,
      credit: parseFloat(String(r.credit)) || 0,
    }));

    type Group = {
      key: string;
      label: string;
      totalDebit: number;
      totalCredit: number;
      net: number;
      lines: Line[];
    };

    const groupMap = new Map<string, Group>();

    for (const line of lines) {
      let key: string;
      let label: string;

      if (groupBy === 'account') {
        key = String(line.accountCode);
        label = `${line.accountCode} — ${line.accountName}`;
      } else if (groupBy === 'source_type') {
        key = line.sourceType;
        label = formatSourceType(line.sourceType);
      } else {
        key = line.date.slice(0, 7);
        label = formatMonth(key);
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, { key, label, lines: [], totalDebit: 0, totalCredit: 0, net: 0 });
      }
      const g = groupMap.get(key)!;
      g.lines.push(line);
      g.totalDebit += line.debit;
      g.totalCredit += line.credit;
      g.net = g.totalDebit - g.totalCredit;
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => a.key.localeCompare(b.key));

    const totals = {
      totalDebit: lines.reduce((s, l) => s + l.debit, 0),
      totalCredit: lines.reduce((s, l) => s + l.credit, 0),
      net: lines.reduce((s, l) => s + l.debit - l.credit, 0),
    };

    return NextResponse.json({ groups, totals, from, to });
  } catch (e) {
    console.error('Custom report error:', e);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
