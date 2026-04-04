import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { inviteClient, getInviteByToken } from '@/src/lib/accountant.service';
import { getUserByEmail, getUserById } from '@/src/lib/user.service';
import { sendAccountantInviteToClient, sendClientInviteToAccountant } from '@/src/lib/email';

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, direction } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  if (direction === 'client_to_accountant') {
    // Client invites their accountant — accountant must already have an account
    const accountant = await getUserByEmail(email);
    if (!accountant || accountant.user_type !== 'accountant') {
      return NextResponse.json({ error: 'No accountant account found with that email. Ask them to sign up as an accountant first.' }, { status: 404 });
    }
    const invite = await inviteClient(accountant.id, auth.email);
    await sendClientInviteToAccountant({
      to: email,
      clientName: auth.fullName,
      inviteToken: invite.invite_token,
    });
    return NextResponse.json({ ok: true });
  }

  // Default: accountant invites client
  if (auth.userType !== 'accountant') {
    return NextResponse.json({ error: 'Only accountant accounts can send client invites' }, { status: 403 });
  }
  const invite = await inviteClient(auth.userId, email);
  const accountantUser = await getUserById(auth.userId);
  await sendAccountantInviteToClient({
    to: email,
    accountantName: auth.fullName,
    accountantFirm: accountantUser?.business_name || undefined,
    inviteToken: invite.invite_token,
  });
  return NextResponse.json({ ok: true, inviteId: invite.id });
}
