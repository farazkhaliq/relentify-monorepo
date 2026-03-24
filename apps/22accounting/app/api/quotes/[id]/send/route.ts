import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getQuoteById, updateQuoteStatus } from '@/src/lib/quote.service';
import { getUserById } from '@/src/lib/user.service';
import { sendQuoteEmail } from '@/src/lib/email';
import { logAudit } from '@/src/lib/audit.service';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const quote = await getQuoteById(id, auth.userId);
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    if (!quote.client_email) {
      return NextResponse.json({ error: 'Quote has no client email address' }, { status: 400 });
    }

    const user = await getUserById(auth.userId);
    const businessName = user?.business_name || user?.full_name || 'Relentify';

    const result = await sendQuoteEmail({
      to: quote.client_email,
      quoteNumber: quote.quote_number,
      clientName: quote.client_name,
      total: quote.total,
      currency: quote.currency,
      validUntil: quote.valid_until,
      businessName,
      notes: quote.notes || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
    }

    // Mark quote as sent
    const updated = await updateQuoteStatus(id, auth.userId, 'sent');

    await logAudit(auth.userId, 'quote_sent', 'quote', id, { to: quote.client_email, quoteNumber: quote.quote_number });

    return NextResponse.json({ quote: updated, emailId: result.emailId });
  } catch (e) {
    console.error('Quote send error:', e);
    return NextResponse.json({ error: 'Failed to send quote' }, { status: 500 });
  }
}
