import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError } from '@/src/lib/v1-helpers';
import { getInvoiceById, updateInvoicePaymentLink } from '@/src/lib/invoice.service';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { createConnectCheckout } from '@/src/lib/stripe';
import { sendInvoiceEmail } from '@/src/lib/email';
import { query } from '@/src/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;

  const scopeErr = requireScope(ctx, 'invoices:write');
  if (scopeErr) return scopeErr;

  if (ctx.isTestMode) {
    return apiSuccess({ sent: true, test: true }, { testMode: true });
  }

  const { id } = await params;
  try {
    const invoice = await getInvoiceById(id, ctx.userId);
    if (!invoice) return apiError('not_found', 'Invoice not found', 404);
    if (!invoice.client_email) return apiError('validation_error', 'Invoice must have a client email address', 400);

    const [user, entity] = await Promise.all([
      getUserById(ctx.userId),
      getActiveEntity(ctx.userId),
    ]);

    const acceptCardPayments = user?.accept_card_payments !== false;
    let paymentLink: string | null = null;

    if (acceptCardPayments && user?.stripe_account_id) {
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
      await query(`UPDATE acc_invoices SET status='sent', sent_at=NOW() WHERE id=$1`, [invoice.id]);
    }

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

    return apiSuccess({ sent: emailResult.success, paymentLink });
  } catch (e) {
    console.error('v1 send invoice:', e);
    return apiError('internal_error', 'Failed to send invoice', 500);
  }
}
