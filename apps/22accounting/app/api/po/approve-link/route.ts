import { NextRequest, NextResponse } from 'next/server';
import { getPOByToken, approvePOByToken, rejectPOByToken } from '@/src/lib/po.service';
import { sendPODecisionEmail } from '@/src/lib/email';
import { query } from '@/src/lib/db';

// Token-based approval from email link — no login required
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const action = req.nextUrl.searchParams.get('action'); // 'approve' | 'reject'

  if (!token || !action) {
    return new NextResponse('Invalid link', { status: 400 });
  }

  const po = await getPOByToken(token);
  if (!po) {
    return new NextResponse(renderPage('Link Expired', 'This approval link has expired or has already been used.', false), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (action === 'approve') {
    const updated = await approvePOByToken(token, 'system-email-link');
    if (!updated) {
      return new NextResponse(renderPage('Already Actioned', 'This PO has already been approved or rejected.', false), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Notify requester
    const reqRes = await query(`SELECT name, email FROM users WHERE id = $1`, [po.requested_by_id]);
    const requester = reqRes.rows[0];
    if (requester?.email) {
      await sendPODecisionEmail({
        recipientEmail: requester.email,
        recipientName: requester.name,
        deciderName: 'Your approver',
        decision: 'approved',
        po: updated,
      });
    }

    return new NextResponse(renderPage('Approved', `Purchase order <strong>${po.po_number}</strong> from ${po.supplier_name} has been approved.`, true), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (action === 'reject') {
    // Redirect to a simple rejection form page
    return NextResponse.redirect(
      new URL(`/po-reject?token=${token}`, req.url)
    );
  }

  return new NextResponse('Unknown action', { status: 400 });
}

// POST — token-based rejection form submission (no login required)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, reason } = body;

    if (!token || !reason?.trim()) {
      return NextResponse.json({ error: 'Token and reason are required' }, { status: 400 });
    }

    const po = await getPOByToken(token);
    if (!po) {
      return NextResponse.json({ error: 'Link expired or already actioned' }, { status: 400 });
    }

    const updated = await rejectPOByToken(token, 'system-email-link', reason.trim());
    if (!updated) {
      return NextResponse.json({ error: 'Already actioned' }, { status: 400 });
    }

    // Notify requester
    const reqRes = await query(`SELECT name, email FROM users WHERE id = $1`, [po.requested_by_id]);
    const requester = reqRes.rows[0];
    if (requester?.email) {
      await sendPODecisionEmail({
        recipientEmail: requester.email,
        recipientName: requester.name,
        deciderName: 'Your approver',
        decision: 'rejected',
        reason: reason.trim(),
        po: updated,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Token reject error:', e);
    return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
  }
}

function renderPage(title: string, message: string, success: boolean): string {
  const accent = '#10B981';
  const neutral = '#FFFFFF';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Relentify</title>
<style>
  body { 
    font-family: 'Inter', system-ui, sans-serif; 
    background: #000000; 
    color: #FFFFFF; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    min-height: 100vh; 
    margin: 0; 
    padding: 20px; 
  }
  .card { 
    background: rgba(26, 26, 26, 0.6); 
    backdrop-filter: blur(64px);
    border: 1px solid rgba(255, 255, 255, 0.08); 
    border-radius: 3rem; /* rounded-cinematic approx */
    padding: 48px; 
    max-width: 480px; 
    width: 100%; 
    text-align: center; 
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); /* shadow-cinematic approx */
  }
  .icon { 
    width: 64px; 
    height: 64px; 
    border-radius: 2rem; 
    background: ${success ? accent : 'rgba(255, 255, 255, 0.1)'}; 
    color: ${success ? '#000000' : '#FFFFFF'};
    display: flex; 
    align-items: center; 
    justify-content: center; 
    margin: 0 auto 32px; 
    font-size: 28px; 
    font-weight: bold;
  }
  h1 { 
    font-size: 24px; 
    font-weight: 900; 
    margin: 0 0 16px; 
    color: #FFFFFF; 
    letter-spacing: -0.02em;
  }
  p { 
    color: rgba(255, 255, 255, 0.6); 
    line-height: 1.6; 
    margin: 0; 
    font-size: 15px;
  }
  .brand { 
    margin-top: 40px; 
    font-size: 11px; 
    color: rgba(255, 255, 255, 0.3); 
    font-weight: 700; 
    letter-spacing: 0.2em; 
    text-transform: uppercase; 
  }
</style>
</head><body>
<div class="card">
  <div class="icon">${success ? '✓' : '○'}</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <div class="brand">Relentify</div>
</div>
</body></html>`;
}
