/**
 * One-time script to create Stripe products, prices, and intro-period coupons.
 * Run with: npx ts-node scripts/setup-stripe.ts
 *
 * Requires STRIPE_SECRET_KEY in environment (test mode recommended first).
 * Prints env vars to paste into .env on completion.
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });

interface TierSetup {
  key: string;
  name: string;
  normalPricePence: number;  // recurring monthly price in pence
  introDiscountPence: number; // fixed amount off for 6 months
}

const TIERS: TierSetup[] = [
  { key: 'sole_trader',     name: 'Relentify Sole Trader',     normalPricePence: 499,  introDiscountPence: 400  },
  { key: 'small_business',  name: 'Relentify Small Business',  normalPricePence: 1250, introDiscountPence: 1051 },
  { key: 'medium_business', name: 'Relentify Medium Business', normalPricePence: 2900, introDiscountPence: 2401 },
  { key: 'corporate',       name: 'Relentify Corporate',       normalPricePence: 4900, introDiscountPence: 4001 },
];

async function main() {
  console.log('Setting up Stripe products, prices, and coupons...\n');

  const envLines: string[] = [];

  for (const tier of TIERS) {
    // Create product
    const product = await stripe.products.create({
      name: tier.name,
      metadata: { tier: tier.key },
    });
    console.log(`✅ Product: ${product.name} (${product.id})`);

    // Create recurring monthly price in GBP
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.normalPricePence,
      currency: 'gbp',
      recurring: { interval: 'month' },
      metadata: { tier: tier.key },
    });
    console.log(`✅ Price: £${(tier.normalPricePence / 100).toFixed(2)}/mo (${price.id})`);

    // Create 6-month fixed-amount intro coupon
    const coupon = await stripe.coupons.create({
      amount_off: tier.introDiscountPence,
      currency: 'gbp',
      duration: 'repeating',
      duration_in_months: 6,
      name: `${tier.name} — 6-month intro`,
      metadata: { tier: tier.key },
    });
    const introPricePence = tier.normalPricePence - tier.introDiscountPence;
    console.log(`✅ Coupon: £${(introPricePence / 100).toFixed(2)}/mo for 6 mo (${coupon.id})\n`);

    const envKey = tier.key.toUpperCase();
    envLines.push(`STRIPE_PRICE_${envKey}=${price.id}`);
    envLines.push(`STRIPE_COUPON_${envKey}=${coupon.id}`);
  }

  console.log('\n=== Add these to your .env ===\n');
  envLines.forEach(line => console.log(line));
  console.log('\n==============================\n');
  console.log('Done. Also add your webhook secret:');
  console.log('STRIPE_WEBHOOK_SECRET=whsec_...');
}

main().catch(err => { console.error(err); process.exit(1); });
