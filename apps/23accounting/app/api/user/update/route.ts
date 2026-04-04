import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { query } from '@/src/lib/db';

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fullName, businessName, businessStructure, companyNumber, vatRegistered, vatNumber, acceptCardPayments, paymentRemindersEnabled, registeredAddress, bankAccountName, sortCode, accountNumber } = body;

    if (businessStructure === 'company' && !companyNumber) {
      return NextResponse.json({ error: 'Company number is required for limited companies' }, { status: 400 });
    }

    if (vatRegistered && !vatNumber) {
      return NextResponse.json({ error: 'VAT number is required if VAT registered' }, { status: 400 });
    }

    await query(
      `UPDATE users
       SET full_name = $1,
           business_name = $2,
           business_structure = $3,
           company_number = $4,
           vat_registered = $5,
           vat_number = $6,
           accept_card_payments = $7,
           payment_reminders_enabled = $8,
           registered_address = $9,
           bank_account_name = $10,
           sort_code = $11,
           account_number = $12
       WHERE id = $13`,
      [
        fullName,
        businessName || null,
        businessStructure,
        companyNumber || null,
        vatRegistered,
        vatNumber || null,
        acceptCardPayments !== undefined ? acceptCardPayments : true,
        paymentRemindersEnabled !== undefined ? paymentRemindersEnabled : false,
        registeredAddress || null,
        bankAccountName || null,
        sortCode || null,
        accountNumber || null,
        auth.userId
      ]
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Update user error:', e);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
