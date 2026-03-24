import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

const TEMPLATES: Record<string, { headers: string[]; example: string[][] }> = {
  customers: {
    headers: ['Name', 'Email', 'Phone', 'Address', 'Notes'],
    example: [
      ['Acme Ltd', 'billing@acme.com', '020 7946 0000', '1 Business Park, London, EC1A 1AA', 'Key account'],
      ['John Smith', 'john@example.com', '07700 900000', '42 High Street, Manchester, M1 1AD', ''],
    ],
  },
  suppliers: {
    headers: ['Name', 'Email', 'Phone', 'Address', 'Notes'],
    example: [
      ['Office Depot', 'orders@officedepot.co.uk', '0800 345 6789', 'Depot House, Birmingham, B1 1BB', 'Account no: 12345'],
      ['BT Business', 'accounts@bt.com', '0800 800 150', '', 'Monthly contract'],
    ],
  },
  invoices: {
    headers: [
      'Client Name', 'Client Email', 'Client Address',
      'Issue Date (YYYY-MM-DD)', 'Due Date (YYYY-MM-DD)',
      'Currency', 'Tax Rate %',
      'Description', 'Quantity', 'Unit Price',
      'Notes',
    ],
    example: [
      ['Acme Ltd', 'billing@acme.com', '1 Business Park, London', '2024-01-15', '2024-02-14', 'GBP', '20', 'Web design services', '1', '1500.00', 'January project'],
      ['John Smith', 'john@example.com', '', '2024-01-20', '2024-02-19', 'GBP', '0', 'Consulting - 5 days', '5', '400.00', ''],
    ],
  },
  bills: {
    headers: [
      'Supplier Name', 'Amount', 'Currency',
      'Due Date (YYYY-MM-DD)', 'Category',
      'VAT Rate %', 'VAT Amount',
      'Reference', 'Notes',
    ],
    example: [
      ['Office Depot', '250.00', 'GBP', '2024-02-01', 'office', '20', '50.00', 'INV-2024-001', 'Stationery and supplies'],
      ['BT Business', '89.99', 'GBP', '2024-02-15', 'utilities', '20', '18.00', 'BT-JAN-24', ''],
    ],
  },
  expenses: {
    headers: ['Date (YYYY-MM-DD)', 'Description', 'Category', 'Gross Amount', 'VAT Amount', 'Notes'],
    example: [
      ['2024-01-15', 'Client lunch - Acme Ltd', 'entertainment', '85.00', '0', 'Business development'],
      ['2024-01-18', 'Train to Manchester', 'travel', '67.50', '0', 'Client meeting'],
    ],
  },
};

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const user = await getUserById(auth.userId);
  if (!canAccess(user?.tier, 'excel_import')) {
    return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get('type');
  if (!type || !TEMPLATES[type]) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const tpl = TEMPLATES[type];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(type);

  // Header row
  ws.addRow(tpl.headers);
  // Example rows
  for (const row of tpl.example) {
    ws.addRow(row);
  }

  // Auto-width columns
  tpl.headers.forEach((h, i) => {
    const maxLen = Math.max(h.length, ...tpl.example.map(row => String(row[i] || '').length)) + 4;
    ws.getColumn(i + 1).width = maxLen;
  });

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="relentify-${type}-template.xlsx"`,
    },
  });
}
