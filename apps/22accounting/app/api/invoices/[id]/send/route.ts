import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getInvoiceById, updateInvoicePaymentLink } from '@/src/lib/invoice.service';
import { checkPermission } from '@/src/lib/workspace-auth';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { createConnectCheckout } from '@/src/lib/stripe';
import { sendInvoiceEmail } from '@/src/lib/email';
import { logAudit } from '@/src/lib/audit.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const denied = checkPermission(auth, 'invoices', 'create');
    if (denied) return denied;
    const { id } = await params;
    const invoice = await getInvoiceById(id, auth.userId);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const [user, entity] = await Promise.all([
      getUserById(auth.userId),
      getActiveEntity(auth.userId),
    ]);

    if (!invoice.client_email) {
      return NextResponse.json({ error: 'Invoice must have a client email address' }, { status: 400 });
    }

    const acceptCardPayments = user?.accept_card_payments !== false;

    let paymentLink: string | null = null;

    if (acceptCardPayments) {
      if (!user?.stripe_account_id) {
        return NextResponse.json({ error: 'Please connect your Stripe account in Settings first' }, { status: 400 });
      }

      const totalPence = Math.round(parseFloat(invoice.total) * 100);
      const session = await createConnectCheckout({
        connectedAccountId: user.stripe_account_id,
        totalPence,
        currency: invoice.currency,
        invoiceNumber: invoice.invoice_number,
        invoiceId: invoice.id,
        customerEmail: invoice.client_email,
        clientName: invoice.client_name,
      });

      await updateInvoicePaymentLink(invoice.id, session.url, session.sessionId);
      paymentLink = session.url;
    } else {
      // Just mark as sent without a payment link
      const { query } = await import('@/src/lib/db');
      await query(`UPDATE invoices SET status='sent', sent_at=NOW() WHERE id=$1`, [invoice.id]);
    }

    // Send email
    const emailResult = await sendInvoiceEmail({
      to: invoice.client_email,
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client_name,
      total: invoice.total,
      currency: invoice.currency,
      dueDate: invoice.due_date,
      paymentLink: paymentLink || '',
      businessName: user?.business_name || user?.full_name,
      logoUrl: entity?.logo_url ?? undefined,
      brandColor: entity?.brand_color ?? undefined,
      invoiceFooter: entity?.invoice_footer ?? undefined,
      phone: entity?.phone ?? undefined,
      website: entity?.website ?? undefined,
    });

    if (!emailResult.success) {
      console.error('Email failed:', emailResult.error);
    }

    await logAudit(auth.userId, 'invoice.sent', 'invoice', invoice.id, { invoice_number: invoice.invoice_number, client: invoice.client_name, total: invoice.total });
    return NextResponse.json({
      paymentLink,
      emailSent: emailResult.success
    });
  } catch (e) {
    console.error('Send invoice error:', e);
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 });
  }
}
