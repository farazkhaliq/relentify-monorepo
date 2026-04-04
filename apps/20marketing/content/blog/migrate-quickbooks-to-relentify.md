---
title: "How to Migrate from QuickBooks to Relentify: A Step-by-Step Guide"
slug: "migrate-quickbooks-to-relentify"
publishDate: "2025-06-03"
author: "Relentify"
category: "Industry Comparisons"
excerpt: "Moving from QuickBooks to Relentify is simpler than you might think. This guide covers the full migration process, from data export to verification, with tips to avoid common mistakes."
image: "/blog/migrate-quickbooks-to-relentify.jpg"
imageAlt: "Step-by-step data migration process shown on computer screen"
tags: ["migrate from quickbooks", "switching from quickbooks"]
region: "all"
---

QuickBooks is the most widely used small business accounting software, which means there are a lot of businesses thinking about whether it is still the right fit. Rising per-user costs, feature restrictions on lower tiers, and an interface that has grown more complex over time are common frustrations.

If you have decided that Relentify is the right move, this guide walks you through the entire migration process. The goal is a clean transition with no data loss and minimal disruption to your day-to-day operations.

## Choosing the right time

The ideal migration window is the start of a new financial year or VAT quarter. This creates a clean break: your QuickBooks data covers completed periods, and Relentify picks up from the new period forward.

If you cannot wait for a period boundary, mid-period migration works too — you will just need to handle the transition more carefully to ensure no transactions are missed or duplicated.

## Pre-migration preparation

Complete these tasks before starting the export process:

**Reconcile all bank accounts.** Every transaction in your bank feeds should be matched, categorised, or explained. Unreconciled items become discrepancies that are difficult to track down after migration.

**Process pending items.** Send any draft invoices, record pending payments, and enter outstanding bills. The cleaner your QuickBooks data, the smoother the migration.

**Submit pending VAT returns.** If you have an unsubmitted VAT period, complete and submit it through QuickBooks. Splitting a VAT period across two platforms creates unnecessary complexity.

**Run and save reports.** Generate PDF copies of your profit and loss, balance sheet, trial balance, aged receivables, and aged payables. These are your verification benchmarks after migration.

**Review your chart of accounts.** Note any custom accounts, particularly if you have created accounts that differ from QuickBooks' defaults.

**List recurring transactions.** Document all recurring invoices, bills, and journal entries. QuickBooks does not include these in standard exports, so you will need to recreate them manually.

## Step 1: Export data from QuickBooks

QuickBooks Online allows data export in CSV and Excel formats. Export the following:

**Chart of accounts:** Go to Settings > Chart of Accounts > Run Report > Export to Excel. This captures all account codes, names, types, and balances.

**Customer list:** Go to Sales > Customers > Export to Excel. This includes names, contact details, and outstanding balances.

**Supplier list:** Go to Expenses > Suppliers > Export to Excel.

**Trial balance:** Go to Reports > Trial Balance. Set the date range to your migration date and export.

**Outstanding invoices:** Go to Reports > Accounts Receivable Ageing Detail. Export the full list of unpaid invoices.

**Outstanding bills:** Go to Reports > Accounts Payable Ageing Detail. Export unpaid bills.

**Products and services:** If you use QuickBooks' product/service list for invoice line items, go to Settings > Products and Services > Export.

## Step 2: Set up Relentify

Create your Relentify account and configure the foundational settings:

- Company name, registration number, and VAT number
- Financial year start date (matching your QuickBooks setup)
- VAT scheme (standard, flat rate, or cash accounting)
- Bank accounts (connect via Open Banking or add manually)
- Currency settings (if you use multi-currency)

## Step 3: Set up your chart of accounts

Relentify includes a standard UK chart of accounts. Compare it to your QuickBooks export and decide your approach:

**For standard setups:** Use Relentify's default chart and add any custom accounts manually. This is faster for most businesses.

**For complex setups:** Use Relentify's chart of accounts import to upload your QuickBooks export. The import tool maps account types automatically and flags any that need manual review.

QuickBooks uses a slightly different account type classification than UK accounting standards. Relentify's import tool handles the most common mappings, but review the results to ensure accounts are classified correctly.

## Step 4: Import customers and suppliers

Upload your customer and supplier CSV files. Relentify automatically maps standard fields: name, email, phone, address, and VAT number.

QuickBooks' export format includes some fields that do not map directly (such as QuickBooks-specific internal IDs). These are safely ignored during import.

Review the import preview before confirming. Pay particular attention to customer names and email addresses, as these are used for invoice delivery.

## Step 5: Enter opening balances

Your opening balances are the foundation of your Relentify accounts. They must match your QuickBooks closing balances exactly.

Use the trial balance you exported from QuickBooks as your source. In Relentify:

1. Go to Settings > Opening Balances
2. Enter the balance for each account as shown on your QuickBooks trial balance
3. Alternatively, use the opening balance import template to upload balances in bulk

After entering balances, run a trial balance in Relentify and compare it line by line to your QuickBooks trial balance. The debits and credits must balance, and the totals must match.

Common issues at this stage:

- **Rounding differences:** QuickBooks sometimes displays rounded figures in reports. Use the exact figures from the detailed trial balance, not the summary.
- **Retained earnings:** Ensure the retained earnings figure is correct. This is the cumulative total of all prior-year profits and must match.
- **Bank balances:** Your opening bank balance in Relentify should match the reconciled balance in QuickBooks, which should match your actual bank statement.

## Step 6: Recreate outstanding invoices and bills

For unpaid invoices and bills, create them in Relentify with their original dates and amounts. This preserves the audit trail and allows you to track payments against specific documents.

For businesses with many outstanding items, you can use Relentify's bulk import feature to upload invoices and bills from a CSV file.

## Step 7: Set up recurring transactions

Review your QuickBooks recurring transaction list and recreate each one in Relentify:

- Recurring invoices (monthly retainers, subscriptions)
- Recurring bills (rent, utilities, subscriptions)
- Recurring journal entries (depreciation, accruals)

## Step 8: Connect bank feeds

Connect your bank accounts in Relentify via Open Banking. Bank transactions from your migration date forward will flow in automatically.

Historical transactions remain in your QuickBooks archive. There is no need to import historical bank data into Relentify.

## Step 9: Authorise MTD

If you submitted VAT returns through QuickBooks, authorise Relentify with HMRC for Making Tax Digital. Go to Settings > VAT > Connect to HMRC and sign in with your Government Gateway credentials.

This deauthorises QuickBooks as your MTD software provider. Only do this after your final VAT return has been submitted through QuickBooks.

## Step 10: Invite your team

Add your team members to Relentify. Unlike QuickBooks, there are no per-user fees — invite everyone who needs access without worrying about the cost.

Set appropriate permissions for each user based on their role: full access, invoice-only, expense submission, or view-only.

## Step 11: Verify

Run these verification checks:

1. **Trial balance comparison:** Relentify trial balance must match your saved QuickBooks trial balance
2. **Bank balances:** Must match your actual bank statements
3. **Outstanding receivables:** Aged receivables report must match your QuickBooks export
4. **Outstanding payables:** Aged payables report must match
5. **VAT registration:** Confirm MTD authorisation is active

If all checks pass, your migration is complete.

## Post-migration

Keep your QuickBooks account active for at least one month as a reference. QuickBooks offers a read-only mode after cancellation that preserves your data for a limited period.

Save PDF copies of any reports you might need for historical reference before your QuickBooks access expires.

## Timeline

A typical small business migration takes three to six hours:

- Data export from QuickBooks: 30 minutes
- Relentify setup and configuration: 30 minutes
- Chart of accounts and opening balances: 1-2 hours
- Customer, supplier, and outstanding item import: 1-2 hours
- Verification: 30 minutes

## Getting help

Relentify's support team is available via live chat to help with migration questions. For businesses with complex setups (multiple entities, custom integrations, or large transaction volumes), we offer guided migration support.

The hardest part of switching accounting software is making the decision. The actual migration is methodical, predictable, and faster than most businesses expect.
