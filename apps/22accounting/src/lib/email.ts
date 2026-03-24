import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$',
  CHF: 'CHF ', SEK: 'kr', NOK: 'kr', DKK: 'kr', JPY: '¥', ZAR: 'R',
  HKD: 'HK$', SGD: 'S$', INR: '₹', MXN: 'MX$', BRL: 'R$',
};
function currencySymbol(c: string): string { return CURRENCY_SYMBOLS[c] ?? c + ' '; }

interface SendInvoiceEmailParams {
  to: string;
  invoiceNumber: string;
  clientName: string;
  total: string;
  currency: string;
  dueDate: string;
  paymentLink: string;
  businessName: string;
  paymentTerms?: string;
  vatNumber?: string;
  logoUrl?: string;
  brandColor?: string;
  invoiceFooter?: string;
  phone?: string;
  website?: string;
}

function formatPaymentTermsLabel(terms: string): string {
  const labels: Record<string, string> = { due_on_receipt: 'Due on Receipt', net_7: 'Net 7 Days', net_14: 'Net 14 Days', net_30: 'Net 30 Days', net_60: 'Net 60 Days', custom: 'Custom' };
  return labels[terms] || terms;
}

export async function sendInvoiceEmail(params: SendInvoiceEmailParams) {
  const { to, invoiceNumber, clientName, total, currency, dueDate, paymentLink, businessName, paymentTerms, vatNumber, logoUrl, brandColor, invoiceFooter, phone, website } = params;
  const accentColor = brandColor || '#10B981';
  const symbol = currencySymbol(currency);
  const dueDateFormatted = new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #000000; background: #F8F9FB; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; padding: 0; background: white; border-radius: 12px; border: 1px solid rgba(0, 0, 0, 0.04); overflow: hidden; }
    .header { background: #000000; color: white; padding: 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
    .content { padding: 40px; }
    .invoice-details { background: #F8F9FB; padding: 24px; border-radius: 12px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.04); }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: rgba(0, 0, 0, 0.4); font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
    .value { color: #000000; font-weight: 500; }
    .total { font-size: 24px; font-weight: 800; color: #000000; }
    .cta-button { display: inline-block; background: ${accentColor}; color: white; padding: 16px 40px; text-decoration: none; border-radius: 5rem; font-weight: 700; margin: 24px 0; font-size: 15px; text-transform: uppercase; letter-spacing: 0.1em; }
    .footer { text-align: center; color: rgba(0, 0, 0, 0.4); font-size: 12px; padding: 40px; border-top: 1px solid rgba(0, 0, 0, 0.04); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" style="max-height:50px;max-width:200px;object-fit:contain;margin-bottom:20px;display:block;margin-left:auto;margin-right:auto;" />` : ''}
      <h1>Invoice from ${businessName}</h1>
    </div>
    <div class="content">
      <p style="font-size: 16px; margin-top: 0;">Hi ${clientName},</p>
      <p style="color: rgba(0, 0, 0, 0.6);">You have received a new invoice. Please review the details below:</p>
      
      <div class="invoice-details">
        <div class="detail-row">
          <span class="label">Invoice Number</span>
          <span class="value">${invoiceNumber}</span>
        </div>
        ${paymentTerms ? `
        <div class="detail-row">
          <span class="label">Payment Terms</span>
          <span class="value">${formatPaymentTermsLabel(paymentTerms)}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="label">Due Date</span>
          <span class="value">${dueDateFormatted}</span>
        </div>
        <div class="detail-row" style="border: none; padding-top: 20px; margin-top: 8px;">
          <span class="label" style="color: #000000;">Amount Due</span>
          <span class="value total">${symbol}${Number(total).toFixed(2)}</span>
        </div>
      </div>

      <center>
        <a href="${paymentLink}" class="cta-button">Pay Invoice Now</a>
      </center>

      <p style="color: rgba(0, 0, 0, 0.4); font-size: 13px; text-align: center; margin-top: 32px;">
        Secure payment processed by Relentify.
      </p>
    </div>
    
    <div class="footer">
      <p style="margin-top: 0;">${invoiceFooter || 'Sent via Relentify Accounting'}</p>
      ${phone || website ? `<p>${[phone, website].filter(Boolean).join(' &nbsp;•&nbsp; ')}</p>` : ''}
      <p>If you have any questions, please contact ${businessName} directly.</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `Invoice ${invoiceNumber} from ${businessName}`,
      html,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, emailId: data?.id };
  } catch (error) {
    console.error('Email send failed:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

export async function sendTeamInviteEmail(params: { to: string; inviterName: string; workspaceName: string; inviteUrl: string }) {
  const { to, inviterName, workspaceName, inviteUrl } = params;
  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#000000;background:#F8F9FB;margin:0;padding:0}
    .c{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,.04);overflow:hidden}
    .h{background:#000000;color:#fff;padding:40px;text-align:center}
    .b{padding:40px}
    .btn{display:inline-block;background:#10B981;color:#fff;padding:16px 40px;text-decoration:none;border-radius:5rem;font-weight:700;margin:24px 0;text-transform:uppercase;letter-spacing:.1em;font-size:14px}
    .f{text-align:center;color:rgba(0,0,0,.4);font-size:12px;padding:40px;border-top:1px solid rgba(0,0,0,.04)}
  </style></head><body><div class="c">
    <div class="h"><h2 style="margin:0;font-size:20px">Relentify Workspace Invite</h2></div>
    <div class="b">
      <p style="margin-top:0">Hi there,</p>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> on Relentify.</p>
      <center><a href="${inviteUrl}" class="btn">Join Workspace</a></center>
      <p style="color:rgba(0,0,0,.4);font-size:13px">If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
    <div class="f"><p>Sent via Relentify</p></div>
  </div></body></html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `${inviterName} invited you to ${workspaceName} on Relentify`,
      html,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, emailId: data?.id };
  } catch {
    return { success: false, error: 'Failed to send invite email' };
  }
}

export async function sendReminderEmail(params: { to: string; invoiceNumber: string; clientName: string; total: string; currency: string; dueDate: string; paymentLink: string | null; businessName: string }, triggerType: '3_days_before' | 'due_date' | '7_days_after') {
  const { to, invoiceNumber, clientName, total, currency, dueDate, paymentLink, businessName } = params;
  const symbol = currencySymbol(currency);
  const dueDateFormatted = new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const subjects = { '3_days_before': `Reminder: Invoice ${invoiceNumber} due in 3 days`, 'due_date': `Invoice ${invoiceNumber} is due today`, '7_days_after': `Overdue: Invoice ${invoiceNumber} was due ${dueDateFormatted}` };
  const intros = { '3_days_before': `friendly reminder that invoice ${invoiceNumber} for ${symbol}${Number(total).toFixed(2)} is due in 3 days.`, 'due_date': `Invoice ${invoiceNumber} for ${symbol}${Number(total).toFixed(2)} is due today.`, '7_days_after': `Invoice ${invoiceNumber} for ${symbol}${Number(total).toFixed(2)} is now overdue.` };

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#000000;background:#F8F9FB;margin:0;padding:0}
    .c{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,.04);overflow:hidden}
    .h{background:#000000;color:#fff;padding:40px;text-align:center}
    .b{padding:40px}
    .btn{display:inline-block;background:#10B981;color:#fff;padding:16px 40px;text-decoration:none;border-radius:5rem;font-weight:700;margin:24px 0;text-transform:uppercase;letter-spacing:.1em;font-size:14px}
    .f{text-align:center;color:rgba(0,0,0,.4);font-size:12px;padding:40px;border-top:1px solid rgba(0,0,0,.04)}
  </style></head><body><div class="c">
    <div class="h"><h2 style="margin:0;font-size:20px">Payment Reminder</h2></div>
    <div class="b">
      <p style="margin-top:0">Hi ${clientName},</p>
      <p>This is a ${intros[triggerType]}</p>
      ${paymentLink ? `<center><a href="${paymentLink}" class="btn">Pay Invoice</a></center>` : ''}
    </div>
    <div class="f"><p>Sent via Relentify on behalf of ${businessName}</p></div>
  </div></body></html>`;

  try {
    const { data, error } = await resend.emails.send({ from: 'Relentify <invoices@relentify.com>', to: [to], subject: subjects[triggerType], html });
    if (error) return { success: false, error: error.message };
    return { success: true, emailId: data?.id };
  } catch {
    return { success: false, error: 'Failed' };
  }
}

export async function sendQuoteEmail(params: any): Promise<{ success: boolean; emailId?: string; error?: string }> { return { success: true }; }

// ─── PO Approval Emails ───────────────────────────────────────────────────────

interface SendPOApprovalRequestEmailParams {
  to: string;
  approverName: string;
  requesterName: string;
  poNumber: string;
  total: number;
  currency: string;
  supplierName: string;
  description?: string;
  approveUrl: string;
  rejectUrl: string;
}

export async function sendPOApprovalRequestEmail(params: SendPOApprovalRequestEmailParams): Promise<{ success: boolean; emailId?: string; error?: string }> {
  const { to, approverName, requesterName, poNumber, total, currency, supplierName, description, approveUrl, rejectUrl } = params;
  const symbol = currencySymbol(currency);

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#000000;background:#F8F9FB;margin:0;padding:0}
    .c{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,.04);overflow:hidden}
    .h{background:#000000;color:#fff;padding:40px;text-align:center}
    .b{padding:40px}
    .box{background:#F8F9FB;padding:20px 24px;border-radius:10px;margin:20px 0}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.04)}
    .row:last-child{border-bottom:none}
    .lbl{font-weight:600;color:rgba(0,0,0,.4);font-size:12px;text-transform:uppercase;letter-spacing:.05em}
    .val{color:#000;font-weight:500;font-size:14px}
    .total{font-size:22px;font-weight:800}
    .btn{display:inline-block;padding:14px 32px;text-decoration:none;border-radius:50px;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.08em}
    .btn-approve{background:#10B981;color:#fff}
    .btn-reject{background:#F8F9FB;color:#000;border:1px solid rgba(0,0,0,.15)}
    .actions{display:flex;gap:12px;justify-content:center;margin:28px 0;flex-wrap:wrap}
    .f{text-align:center;color:rgba(0,0,0,.4);font-size:12px;padding:32px 40px;border-top:1px solid rgba(0,0,0,.04)}
  </style></head><body><div class="c">
    <div class="h"><h2 style="margin:0;font-size:20px">PO Approval Required</h2></div>
    <div class="b">
      <p style="margin-top:0">Hi ${approverName},</p>
      <p><strong>${requesterName}</strong> has submitted a purchase order for your approval.</p>
      <div class="box">
        <div class="row"><span class="lbl">PO Number</span><span class="val">${poNumber}</span></div>
        <div class="row"><span class="lbl">Supplier</span><span class="val">${supplierName}</span></div>
        ${description ? `<div class="row"><span class="lbl">Description</span><span class="val">${description}</span></div>` : ''}
        <div class="row" style="padding-top:16px;margin-top:4px"><span class="lbl" style="color:#000">Total</span><span class="val total">${symbol}${total.toFixed(2)}</span></div>
      </div>
      <div class="actions">
        <a href="${approveUrl}" class="btn btn-approve">Approve PO</a>
        <a href="${rejectUrl}" class="btn btn-reject">Reject</a>
      </div>
      <p style="color:rgba(0,0,0,.4);font-size:13px;text-align:center">These links expire after 72 hours. You can also approve or reject from the Purchase Orders page in Relentify.</p>
    </div>
    <div class="f"><p>Sent via Relentify Accounting</p></div>
  </div></body></html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `PO Approval Required: ${poNumber} — ${symbol}${total.toFixed(2)} from ${requesterName}`,
      html,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, emailId: data?.id };
  } catch {
    return { success: false, error: 'Failed to send PO approval request email' };
  }
}

interface SendPODecisionEmailParams {
  to: string;
  requesterName: string;
  poNumber: string;
  total: number;
  currency: string;
  decision: 'approved' | 'rejected';
  approverName: string;
  rejectionReason?: string;
}

export async function sendPODecisionEmail(params: SendPODecisionEmailParams): Promise<{ success: boolean; emailId?: string; error?: string }> {
  const { to, requesterName, poNumber, total, currency, decision, approverName, rejectionReason } = params;
  const symbol = currencySymbol(currency);
  const isApproved = decision === 'approved';

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#000000;background:#F8F9FB;margin:0;padding:0}
    .c{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,.04);overflow:hidden}
    .h{background:#000000;color:#fff;padding:40px;text-align:center}
    .b{padding:40px}
    .badge{display:inline-block;padding:6px 16px;border-radius:50px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:20px}
    .approved{background:#D1FAE5;color:#065F46}
    .rejected{background:#FEE2E2;color:#991B1B}
    .box{background:#F8F9FB;padding:20px 24px;border-radius:10px;margin:20px 0}
    .reason{background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-top:16px}
    .f{text-align:center;color:rgba(0,0,0,.4);font-size:12px;padding:32px 40px;border-top:1px solid rgba(0,0,0,.04)}
  </style></head><body><div class="c">
    <div class="h"><h2 style="margin:0;font-size:20px">Purchase Order ${isApproved ? 'Approved' : 'Rejected'}</h2></div>
    <div class="b">
      <p style="margin-top:0">Hi ${requesterName},</p>
      <span class="badge ${decision}">${decision}</span>
      <p>Your purchase order <strong>${poNumber}</strong> (${symbol}${total.toFixed(2)}) has been <strong>${decision}</strong> by ${approverName}.</p>
      ${!isApproved && rejectionReason ? `<div class="reason"><p style="margin:0;font-size:14px;color:#991B1B"><strong>Reason:</strong> ${rejectionReason}</p></div>` : ''}
      <p style="color:rgba(0,0,0,.4);font-size:13px;margin-top:20px">View your purchase orders in Relentify for more details.</p>
    </div>
    <div class="f"><p>Sent via Relentify Accounting</p></div>
  </div></body></html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `PO ${poNumber} ${isApproved ? 'Approved' : 'Rejected'} — ${symbol}${total.toFixed(2)}`,
      html,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, emailId: data?.id };
  } catch {
    return { success: false, error: 'Failed to send PO decision email' };
  }
}

// ─── Expense Approval Emails ──────────────────────────────────────────────────

interface SendExpenseApprovalRequestEmailParams {
  to: string;
  approverName: string;
  claimerName: string;
  description: string;
  amount: number;
  category?: string;
  expenseId: string;
  type: 'expense' | 'mileage';
}

export async function sendExpenseApprovalRequestEmail(params: SendExpenseApprovalRequestEmailParams): Promise<{ success: boolean; emailId?: string; error?: string }> {
  const { to, approverName, claimerName, description, amount, category, expenseId, type } = params;
  const typeLabel = type === 'mileage' ? 'Mileage Claim' : 'Expense Claim';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accounting.relentify.com';

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#000000;background:#F8F9FB;margin:0;padding:0}
    .c{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,.04);overflow:hidden}
    .h{background:#000000;color:#fff;padding:40px;text-align:center}
    .b{padding:40px}
    .box{background:#F8F9FB;padding:20px 24px;border-radius:10px;margin:20px 0}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.04)}
    .row:last-child{border-bottom:none}
    .lbl{font-weight:600;color:rgba(0,0,0,.4);font-size:12px;text-transform:uppercase;letter-spacing:.05em}
    .val{color:#000;font-weight:500;font-size:14px}
    .amount{font-size:22px;font-weight:800}
    .btn{display:inline-block;background:#10B981;color:#fff;padding:14px 40px;text-decoration:none;border-radius:50px;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.08em}
    .f{text-align:center;color:rgba(0,0,0,.4);font-size:12px;padding:32px 40px;border-top:1px solid rgba(0,0,0,.04)}
  </style></head><body><div class="c">
    <div class="h"><h2 style="margin:0;font-size:20px">${typeLabel} Awaiting Approval</h2></div>
    <div class="b">
      <p style="margin-top:0">Hi ${approverName},</p>
      <p><strong>${claimerName}</strong> has submitted a ${typeLabel.toLowerCase()} for your approval.</p>
      <div class="box">
        <div class="row"><span class="lbl">Description</span><span class="val">${description}</span></div>
        ${category ? `<div class="row"><span class="lbl">Category</span><span class="val">${category}</span></div>` : ''}
        <div class="row" style="padding-top:16px;margin-top:4px"><span class="lbl" style="color:#000">Amount</span><span class="val amount">£${amount.toFixed(2)}</span></div>
      </div>
      <center><a href="${appUrl}/dashboard/expenses" class="btn">Review in Relentify</a></center>
      <p style="color:rgba(0,0,0,.4);font-size:13px;text-align:center;margin-top:20px">Log in to approve or reject from the Expenses page.</p>
    </div>
    <div class="f"><p>Sent via Relentify Accounting</p></div>
  </div></body></html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `${typeLabel} for Approval: ${description} — £${amount.toFixed(2)} from ${claimerName}`,
      html,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, emailId: data?.id };
  } catch {
    return { success: false, error: 'Failed to send expense approval request email' };
  }
}

interface SendExpenseDecisionEmailParams {
  to: string;
  claimerName: string;
  description: string;
  amount: number;
  decision: 'approved' | 'rejected';
  approverName: string;
  type: 'expense' | 'mileage';
  rejectionReason?: string;
}

export async function sendExpenseDecisionEmail(params: SendExpenseDecisionEmailParams): Promise<{ success: boolean; emailId?: string; error?: string }> {
  const { to, claimerName, description, amount, decision, approverName, type, rejectionReason } = params;
  const typeLabel = type === 'mileage' ? 'Mileage Claim' : 'Expense Claim';
  const isApproved = decision === 'approved';

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#000000;background:#F8F9FB;margin:0;padding:0}
    .c{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,.04);overflow:hidden}
    .h{background:#000000;color:#fff;padding:40px;text-align:center}
    .b{padding:40px}
    .badge{display:inline-block;padding:6px 16px;border-radius:50px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:20px}
    .approved{background:#D1FAE5;color:#065F46}
    .rejected{background:#FEE2E2;color:#991B1B}
    .reason{background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-top:16px}
    .f{text-align:center;color:rgba(0,0,0,.4);font-size:12px;padding:32px 40px;border-top:1px solid rgba(0,0,0,.04)}
  </style></head><body><div class="c">
    <div class="h"><h2 style="margin:0;font-size:20px">${typeLabel} ${isApproved ? 'Approved' : 'Rejected'}</h2></div>
    <div class="b">
      <p style="margin-top:0">Hi ${claimerName},</p>
      <span class="badge ${decision}">${decision}</span>
      <p>Your ${typeLabel.toLowerCase()} <strong>"${description}"</strong> (£${amount.toFixed(2)}) has been <strong>${decision}</strong> by ${approverName}.</p>
      ${!isApproved && rejectionReason ? `<div class="reason"><p style="margin:0;font-size:14px;color:#991B1B"><strong>Reason:</strong> ${rejectionReason}</p></div>` : ''}
      ${isApproved ? `<p style="color:rgba(0,0,0,.5);font-size:13px;margin-top:16px">Your claim has been approved and will be processed for reimbursement.</p>` : ''}
    </div>
    <div class="f"><p>Sent via Relentify Accounting</p></div>
  </div></body></html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `${typeLabel} ${isApproved ? 'Approved' : 'Rejected'}: ${description} — £${amount.toFixed(2)}`,
      html,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, emailId: data?.id };
  } catch {
    return { success: false, error: 'Failed to send expense decision email' };
  }
}

// ── Accountant invites client to sign up ──────────────────────────────────────

export async function sendAccountantInviteToClient(params: {
  to: string;
  accountantName: string;
  accountantFirm?: string;
  inviteToken: string;
}) {
  const { to, accountantName, accountantFirm, inviteToken } = params;
  const signupUrl = `https://accounts.relentify.com/register?ref=${inviteToken}`;
  const senderLabel = accountantFirm ? `${accountantName} (${accountantFirm})` : accountantName;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `${senderLabel} has invited you to Relentify Accounting`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="margin-top: 0;">You've been invited to Relentify</h2>
          <p>Hi,</p>
          <p><strong>${senderLabel}</strong> has invited you to use Relentify Accounting and has requested access to help manage your accounts.</p>
          <p>Click the link below to create your account. ${accountantName} will automatically be connected as your accountant once you sign up.</p>
          <p style="margin: 32px 0;">
            <a href="${signupUrl}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">Create Account</a>
          </p>
          <p style="color: #666; font-size: 13px;">If you did not expect this invitation, you can ignore this email.</p>
        </div>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false }; }
    return { success: true, emailId: data?.id };
  } catch (e) {
    console.error('Email send failed:', e);
    return { success: false };
  }
}

// ── Client invites existing accountant ───────────────────────────────────────

export async function sendClientInviteToAccountant(params: {
  to: string;
  clientName: string;
  clientBusiness?: string;
  inviteToken: string;
}) {
  const { to, clientName, clientBusiness, inviteToken } = params;
  const acceptUrl = `https://accounts.relentify.com/dashboard/accountant?accept=${inviteToken}`;
  const senderLabel = clientBusiness ? `${clientName} (${clientBusiness})` : clientName;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `${senderLabel} has invited you as their accountant on Relentify`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="margin-top: 0;">New client invitation</h2>
          <p>Hi,</p>
          <p><strong>${senderLabel}</strong> has invited you to access their Relentify Accounting as their accountant.</p>
          <p>Accept the invitation from your Relentify accountant portal to get started.</p>
          <p style="margin: 32px 0;">
            <a href="${acceptUrl}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">Accept Invitation</a>
          </p>
          <p style="color: #666; font-size: 13px;">If you don't have a Relentify accountant account yet, <a href="https://accounts.relentify.com/register">sign up first</a>.</p>
        </div>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false }; }
    return { success: true, emailId: data?.id };
  } catch (e) {
    console.error('Email send failed:', e);
    return { success: false };
  }
}

// ── Comment notification ──────────────────────────────────────────────────────

export async function sendCommentNotification(params: {
  to: string
  senderName: string
  body: string
  recordType: string
  recordLabel: string   // e.g. "Bill REF-001", "Invoice #42"
  recordUrl: string     // full URL to the record page
}) {
  const { to, senderName, body, recordType, recordLabel, recordUrl } = params;
  const typeLabel = {
    bill: 'bill', invoice: 'invoice', expense: 'expense',
    bank_transaction: 'bank transaction', journal: 'journal',
  }[recordType] ?? recordType;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `New comment on ${typeLabel}: ${recordLabel}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="margin-top: 0;">New comment</h2>
          <p><strong>${senderName}</strong> commented on <strong>${recordLabel}</strong>:</p>
          <blockquote style="border-left: 3px solid #e5e7eb; margin: 16px 0; padding: 12px 16px; background: #f9fafb; border-radius: 4px;">
            <p style="margin: 0;">${body.replace(/\n/g, '<br>')}</p>
          </blockquote>
          <p style="margin: 32px 0;">
            <a href="${recordUrl}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">View comment</a>
          </p>
        </div>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false }; }
    return { success: true, emailId: data?.id };
  } catch (e) {
    console.error('Comment notification failed:', e);
    return { success: false };
  }
}
