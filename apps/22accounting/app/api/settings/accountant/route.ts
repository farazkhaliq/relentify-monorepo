import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getClientAccountant, revokeAccessByClient, inviteClient } from '@/src/lib/accountant.service';
import { getUserByEmail } from '@/src/lib/user.service';
import { sendClientInviteToAccountant } from '@/src/lib/email';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accountant = await getClientAccountant(auth.userId);
  return NextResponse.json({ accountant: accountant ?? null });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { accountantEmail } = await req.json();
  if (!accountantEmail) return NextResponse.json({ error: 'accountantEmail required' }, { status: 400 });

  const accountant = await getUserByEmail(accountantEmail);
  if (!accountant || accountant.user_type !== 'accountant') {
    return NextResponse.json({ error: 'No accountant account found with that email' }, { status: 404 });
  }

  const invite = await inviteClient(accountant.id, auth.email);
  await sendClientInviteToAccountant({
    to: accountantEmail,
    clientName: auth.fullName,
    inviteToken: invite.invite_token,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await revokeAccessByClient(auth.userId);
  return NextResponse.json({ ok: true });
}
