import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getQuotesByUser, createQuote } from '@/src/lib/quote.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const quotes = await getQuotesByUser(auth.userId);
    return NextResponse.json({ quotes });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'quotes', 'create');
    if (denied) return denied;

    const body = await req.json();
    const { customerId, clientName, clientEmail, clientAddress, issueDate, validUntil, taxRate, currency, notes, items } = body;

    if (!clientName) return NextResponse.json({ error: 'Client name required' }, { status: 400 });
    if (!validUntil) return NextResponse.json({ error: 'Valid until date required' }, { status: 400 });
    if (!items?.length) return NextResponse.json({ error: 'At least one line item required' }, { status: 400 });

    const quote = await createQuote({
      userId: auth.userId,
      customerId, clientName, clientEmail, clientAddress,
      issueDate, validUntil,
      taxRate: Number(taxRate) || 0,
      currency: currency || 'GBP',
      notes,
      items: items.map((i: { description: string; quantity: number; unitPrice: number; taxRate: number }) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        taxRate: Number(i.taxRate) || 0,
      })),
    });
    return NextResponse.json({ quote }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 });
  }
}
