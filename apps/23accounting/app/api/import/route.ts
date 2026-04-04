import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { createCustomer } from '@/src/lib/customer.service';
import { createSupplier } from '@/src/lib/supplier.service';
import { createInvoice } from '@/src/lib/invoice.service';
import { createBill } from '@/src/lib/bill.service';
import { createExpense } from '@/src/lib/expense.service';
import { logAudit } from '@/src/lib/audit.service';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

function parseDate(val: unknown): string | null {
  if (!val) return null;
  // ExcelJS returns Date objects for date cells
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

function num(val: unknown, fallback = 0): number {
  const n = parseFloat(String(val ?? ''));
  return isNaN(n) ? fallback : n;
}

function str(val: unknown, fallback = ''): string {
  return val != null ? String(val).trim() : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'excel_import')) {
      return NextResponse.json({ error: 'Upgrade to Small Business to use data import' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const formData = await req.formData();
    const type = formData.get('type') as string;
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const validTypes = ['customers', 'suppliers', 'invoices', 'bills', 'expenses'];
    if (!validTypes.includes(type)) return NextResponse.json({ error: 'Invalid import type' }, { status: 400 });

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];

    // Extract header row and data rows as plain objects
    const headerRow = ws.getRow(1).values as (string | undefined)[];
    // ExcelJS row.values is 1-indexed (index 0 is undefined)
    const headers = headerRow.slice(1).map(h => str(h));

    const rows: Record<string, unknown>[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const values = row.values as unknown[];
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i + 1] ?? '';
      });
      rows.push(obj);
    });

    // Remove trailing empty rows
    const nonEmpty = rows.filter(r => Object.values(r).some(v => v !== '' && v !== null && v !== undefined));

    if (nonEmpty.length === 0) return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    if (nonEmpty.length > 500) return NextResponse.json({ error: 'Maximum 500 rows per import' }, { status: 400 });

    let imported = 0;
    const errors: string[] = [];

    if (type === 'customers') {
      for (let i = 0; i < nonEmpty.length; i++) {
        const row = nonEmpty[i];
        const name = str(row['Name']);
        if (!name) { errors.push(`Row ${i + 2}: Name is required`); continue; }
        try {
          await createCustomer({
            userId: auth.userId,
            entityId: entity.id,
            name,
            email: str(row['Email']) || undefined,
            phone: str(row['Phone']) || undefined,
            address: str(row['Address']) || undefined,
            notes: str(row['Notes']) || undefined,
          });
          imported++;
        } catch {
          errors.push(`Row ${i + 2}: Failed to import "${name}"`);
        }
      }
    }

    else if (type === 'suppliers') {
      for (let i = 0; i < nonEmpty.length; i++) {
        const row = nonEmpty[i];
        const name = str(row['Name']);
        if (!name) { errors.push(`Row ${i + 2}: Name is required`); continue; }
        try {
          await createSupplier({
            userId: auth.userId,
            entityId: entity.id,
            name,
            email: str(row['Email']) || undefined,
            phone: str(row['Phone']) || undefined,
            address: str(row['Address']) || undefined,
            notes: str(row['Notes']) || undefined,
          });
          imported++;
        } catch {
          errors.push(`Row ${i + 2}: Failed to import "${name}"`);
        }
      }
    }

    else if (type === 'invoices') {
      for (let i = 0; i < nonEmpty.length; i++) {
        const row = nonEmpty[i];
        const clientName = str(row['Client Name']);
        const description = str(row['Description']);

        if (!clientName) { errors.push(`Row ${i + 2}: Client Name is required`); continue; }
        if (!description) { errors.push(`Row ${i + 2}: Description is required`); continue; }

        const dueDate = parseDate(row['Due Date (YYYY-MM-DD)']);
        if (!dueDate) { errors.push(`Row ${i + 2}: Invalid or missing Due Date`); continue; }

        const quantity = num(row['Quantity'], 1);
        const unitPrice = num(row['Unit Price']);
        if (unitPrice <= 0) { errors.push(`Row ${i + 2}: Unit Price must be greater than 0`); continue; }

        const taxRate = num(row['Tax Rate %'], 0);
        const currency = str(row['Currency'], 'GBP').toUpperCase() || 'GBP';
        const issueDate = parseDate(row['Issue Date (YYYY-MM-DD)']) || new Date().toISOString().split('T')[0];

        try {
          await createInvoice({
            userId: auth.userId,
            entityId: entity.id,
            clientName,
            clientEmail: str(row['Client Email']) || undefined,
            clientAddress: str(row['Client Address']) || undefined,
            issueDate,
            dueDate,
            currency,
            taxRate,
            notes: str(row['Notes']) || undefined,
            items: [{ description, quantity, unitPrice, taxRate }],
          });
          imported++;
        } catch {
          errors.push(`Row ${i + 2}: Failed to import invoice for "${clientName}"`);
        }
      }
    }

    else if (type === 'bills') {
      for (let i = 0; i < nonEmpty.length; i++) {
        const row = nonEmpty[i];
        const supplierName = str(row['Supplier Name']);
        const amount = num(row['Amount']);

        if (!supplierName) { errors.push(`Row ${i + 2}: Supplier Name is required`); continue; }
        if (amount <= 0) { errors.push(`Row ${i + 2}: Amount must be greater than 0`); continue; }

        const dueDate = parseDate(row['Due Date (YYYY-MM-DD)']);
        if (!dueDate) { errors.push(`Row ${i + 2}: Invalid or missing Due Date`); continue; }

        try {
          await createBill(auth.userId, {
            entityId: entity.id,
            supplierName,
            amount,
            currency: str(row['Currency'], 'GBP').toUpperCase() || 'GBP',
            dueDate,
            category: str(row['Category'], 'general') || 'general',
            vatRate: num(row['VAT Rate %'], 0),
            vatAmount: num(row['VAT Amount'], 0),
            reference: str(row['Reference']) || undefined,
            notes: str(row['Notes']) || undefined,
          });
          imported++;
        } catch {
          errors.push(`Row ${i + 2}: Failed to import bill from "${supplierName}"`);
        }
      }
    }

    else if (type === 'expenses') {
      for (let i = 0; i < nonEmpty.length; i++) {
        const row = nonEmpty[i];
        const description = str(row['Description']);
        const grossAmount = num(row['Gross Amount']);

        if (!description) { errors.push(`Row ${i + 2}: Description is required`); continue; }
        if (grossAmount <= 0) { errors.push(`Row ${i + 2}: Gross Amount must be greater than 0`); continue; }

        const date = parseDate(row['Date (YYYY-MM-DD)']);
        if (!date) { errors.push(`Row ${i + 2}: Invalid or missing Date`); continue; }

        try {
          await createExpense(auth.userId, {
            date,
            description,
            category: str(row['Category'], 'general') || 'general',
            grossAmount,
            vatAmount: num(row['VAT Amount'], 0),
            notes: str(row['Notes']) || undefined,
          });
          imported++;
        } catch {
          errors.push(`Row ${i + 2}: Failed to import "${description}"`);
        }
      }
    }

    await logAudit(auth.userId, 'import', type, undefined, {
      imported,
      errors: errors.length,
      filename: file.name,
      entityId: entity.id,
    });

    return NextResponse.json({ imported, errors, total: nonEmpty.length });
  } catch (e) {
    console.error('Import error:', e);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
