---
title: "Understanding VAT Reverse Charge for Domestic Services"
slug: "vat-reverse-charge-domestic-services"
publishDate: "2025-12-23"
author: "Relentify"
category: "Accounting & Finance"
excerpt: "The domestic reverse charge changes who accounts for VAT on certain services. Here's how it works and how to handle it in your accounts."
image: "/blog/vat-reverse-charge-domestic-services.jpg"
imageAlt: "VAT reverse charge documentation and calculations"
tags: ["VAT reverse charge", "domestic reverse charge explained"]
region: "uk"
---

The VAT domestic reverse charge is a mechanism that shifts the responsibility for accounting for VAT from the supplier to the customer. Instead of the supplier charging VAT and paying it to HMRC, the customer accounts for the VAT in their own VAT return.

It was introduced in the UK construction sector in March 2021, and understanding it is essential for anyone working in affected industries. Getting it wrong means incorrect VAT returns, potential penalties, and cash flow complications.

## How the reverse charge works

Under normal VAT rules, the supplier charges VAT on their invoice, collects it from the customer, and pays it to HMRC. The customer reclaims the VAT as input tax.

Under the reverse charge, this process is different:

1. The supplier does **not** charge VAT on the invoice
2. The customer accounts for the VAT as both output tax (as if they had supplied the service to themselves) and input tax (as a purchase) on their VAT return
3. The net effect is usually zero — the output and input VAT cancel out

The invoice shows the VAT rate that would have applied and includes a statement that the reverse charge applies, but no VAT is actually charged.

## Why does it exist?

The domestic reverse charge was introduced to combat VAT fraud, specifically "missing trader" fraud (sometimes called carousel fraud). In this type of fraud:

1. A supplier charges VAT to the customer
2. The customer claims the input VAT back from HMRC
3. The supplier disappears without paying the output VAT to HMRC
4. HMRC loses the VAT

By shifting the obligation to the customer, the fraud opportunity is eliminated — the customer accounts for both sides of the transaction, and there is no supplier who can disappear with the VAT.

## Which services does it apply to?

The domestic reverse charge currently applies to:

### Construction services

Most construction services that fall within the Construction Industry Scheme (CIS) are covered, including:

- Construction, alteration, repair, extension, and demolition
- Installation of heating, lighting, power, water, and drainage systems
- Internal and external cleaning (as part of construction)
- Painting and decorating
- Site preparation and clearance

### Exclusions

The reverse charge does not apply to:

- Supplies of staff or workers (labour-only agency supplies are excluded)
- Construction services provided to "end users" (see below)
- Services where the VAT flat rate scheme applies to the supplier
- Services that are zero-rated or exempt

### The end user exception

If the customer is an "end user" — meaning they do not make onward supplies of the construction services — the normal VAT rules apply (the supplier charges VAT as usual). The customer must tell the supplier if they are an end user.

Examples of end users:
- A homeowner having their house renovated
- A business having its own offices refurbished (where it does not supply construction services to others)

Examples of non-end users (reverse charge applies):
- A main contractor receiving services from a subcontractor that are being supplied onwards as part of a larger construction project

## How it affects invoicing

### For suppliers

When the reverse charge applies, your invoice must:

- **Not include VAT** in the total
- State the VAT rate that would have applied (usually 20%)
- Include a clear statement that the domestic reverse charge applies, such as: "Reverse charge: customer to account for VAT to HMRC"
- Show the net amount only

Example invoice:

```
Construction services as per agreement     5,000.00
VAT at 20% - reverse charge applies            0.00
Total due                                  5,000.00

Reverse charge: Customer to account for
the output tax of £1,000 to HMRC
```

### For customers

When you receive a reverse charge invoice:

- Pay the net amount only (no VAT is charged)
- Account for the VAT in your VAT return as both output tax and input tax
- The net effect on your VAT return is usually nil (but the gross figures in Boxes 1, 4, 6, and 7 are affected)

## How it affects your VAT return

### For the supplier

The supply is reported in Box 6 (total value of sales) but not in Box 1 (VAT on sales). This means the sale does not generate any VAT liability for the supplier.

### For the customer

The customer reports:
- **Box 1** — Add the VAT that would have been charged (e.g., 1,000 on a 5,000 supply)
- **Box 4** — Claim the same amount as input tax (1,000)
- **Box 6** — No entry (it is not your sale)
- **Box 7** — Add the net value of the purchase (5,000)

The net effect on Box 5 (net VAT to pay or reclaim) is zero — the 1,000 output tax in Box 1 is cancelled out by the 1,000 input tax in Box 4.

However, if the customer is partly exempt (makes some exempt supplies and cannot reclaim all input VAT), the input VAT claim may be restricted, resulting in a net cost.

## Cash flow implications

The reverse charge has significant cash flow implications:

### For suppliers

You no longer receive VAT from your customer. Under normal rules, you would charge 5,000 plus 1,000 VAT = 6,000, keep the 5,000, and pay the 1,000 to HMRC after your VAT period. During the period, you had use of that 1,000.

Under the reverse charge, you receive only 5,000. The cash flow benefit of holding the VAT temporarily is lost.

### For customers

You no longer pay VAT to your supplier. Under normal rules, you would pay 6,000 and reclaim the 1,000 from HMRC later. Under the reverse charge, you only pay 5,000 and account for the VAT on paper in your return.

The customer's cash flow improves because they are not paying out VAT and waiting to reclaim it.

## Common mistakes

### Applying reverse charge to end users

If your customer is an end user, you should charge VAT normally. Always ask and document whether the customer is an end user before issuing the invoice.

### Forgetting the invoice statement

The invoice must clearly state that the reverse charge applies. An invoice that simply omits VAT without explanation will confuse the customer and may cause compliance issues.

### Incorrect VAT return entries

The customer must include the reverse charge VAT in both Box 1 and Box 4 of their VAT return. Missing one or both entries will cause the return to be incorrect.

### Suppliers on the flat rate scheme

If you are on the flat rate VAT scheme, you cannot apply the reverse charge — you must use normal VAT rules. You need to leave the flat rate scheme if you want to handle reverse charge supplies, or your customer is the one who applies normal rules.

### Not checking CIS scope

The reverse charge applies to services within the scope of CIS. If a service is not within CIS scope, normal VAT rules apply. Make sure you understand which of your services are covered.

## Handling it in your accounting software

Accounting software that supports the reverse charge makes compliance much easier. Look for:

- **Reverse charge VAT codes** — A specific tax code that handles the dual Box 1/Box 4 treatment
- **Invoice templates** — Automatic inclusion of the reverse charge statement
- **VAT return calculation** — Correct population of all nine boxes

In [Relentify](/accounting), reverse charge transactions are handled through dedicated VAT codes that automatically calculate the correct entries for your VAT return.

## Getting it right

The domestic reverse charge is conceptually simple but practically fiddly. The key is to determine, for every relevant transaction, whether the reverse charge applies:

1. Is the service within CIS scope?
2. Is both the supplier and customer VAT-registered?
3. Is the customer an end user?
4. Is the supplier on the flat rate scheme?

If the answer to 1 and 2 is yes, and 3 and 4 are no, the reverse charge applies. In all other cases, normal VAT rules apply.

Document your determination for each customer/supplier relationship, set up the correct VAT codes in your accounting software, and review your VAT returns carefully to ensure the figures are correctly reported.
