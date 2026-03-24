import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { exchangeTrueLayerCode, fetchAndStoreAccounts } from '@/src/lib/openbanking.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.redirect('https://accounts.relentify.com/dashboard/banking?ob=error');

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect('https://accounts.relentify.com/dashboard/banking?ob=denied');
  }

  try {
    const tokens = await exchangeTrueLayerCode(code);
    const count = await fetchAndStoreAccounts(auth.userId, tokens);
    return NextResponse.redirect(`https://accounts.relentify.com/dashboard/banking?ob=connected&accounts=${count}`);
  } catch (e) {
    console.error('TrueLayer callback error:', e);
    return NextResponse.redirect('https://accounts.relentify.com/dashboard/banking?ob=error');
  }
}
