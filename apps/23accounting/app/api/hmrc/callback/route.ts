import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { exchangeHmrcCode, storeHmrcTokens } from '@/src/lib/hmrc.service';

const VAT_URL = 'https://accounting.relentify.com/dashboard/vat';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.redirect(`${VAT_URL}?hmrc=error`);

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const stateParam = searchParams.get('state');

  // CSRF: validate state matches what we set in the cookie
  const storedState = req.cookies.get('hmrc_oauth_state')?.value;
  if (!storedState || storedState !== stateParam) {
    return NextResponse.redirect(`${VAT_URL}?hmrc=error`);
  }

  if (error || !code) {
    return NextResponse.redirect(`${VAT_URL}?hmrc=denied`);
  }

  try {
    const tokens = await exchangeHmrcCode(code);
    await storeHmrcTokens(auth.userId, tokens);
    const res = NextResponse.redirect(`${VAT_URL}?hmrc=connected`);
    res.cookies.delete('hmrc_oauth_state');
    return res;
  } catch (e) {
    console.error('HMRC callback error:', e);
    return NextResponse.redirect(`${VAT_URL}?hmrc=error`);
  }
}
