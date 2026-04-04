---
title: "The Complete Guide to MTD for VAT: Software, Bridging, and Filing"
slug: "mtd-for-vat-complete-guide"
publishDate: "2025-11-21"
author: "Relentify"
category: "Accounting & Finance"
excerpt: "Making Tax Digital for VAT is now mandatory. Here's everything you need to know about compatible software, digital links, and filing your returns."
image: "/blog/mtd-for-vat-complete-guide.jpg"
imageAlt: "VAT return being filed through MTD-compatible software"
tags: ["MTD for VAT software", "making tax digital VAT filing"]
region: "uk"
---

Making Tax Digital for VAT (MTD for VAT) is the most mature part of the government's digital tax programme. All VAT-registered businesses must now keep digital records and file their VAT returns through MTD-compatible software. There are no exemptions based on size or turnover.

If you are already compliant, this guide helps you optimise your process. If you are still getting to grips with the requirements, it covers everything you need to know.

## What MTD for VAT requires

Two core obligations:

### 1. Digital record-keeping

You must keep your VAT records digitally. This includes:

- Your business name, address, and VAT registration number
- VAT accounting scheme used
- For supplies made: date, value, and rate of VAT
- For supplies received: date, value, and amount of input tax to be claimed
- A VAT account summarising total output tax and input tax for each period

"Digital" means in software — not on paper, and not in a simple spreadsheet unless it is linked to filing software (more on this below).

### 2. Software-based filing

You must submit your VAT return to HMRC using the API (Application Programming Interface) built into MTD-compatible software. You can no longer file by logging into the HMRC portal and typing in your nine-box figures manually.

The software communicates directly with HMRC's systems, transmitting the data digitally.

## The nine-box VAT return

Your VAT return consists of nine boxes:

| Box | Description |
|-----|-------------|
| 1 | VAT due on sales and other outputs |
| 2 | VAT due on acquisitions from other EU countries (post-Brexit, mainly used for Northern Ireland) |
| 3 | Total VAT due (Box 1 + Box 2) |
| 4 | VAT reclaimed on purchases and other inputs |
| 5 | Net VAT to pay or reclaim (Box 3 - Box 4) |
| 6 | Total value of sales and other outputs excluding VAT |
| 7 | Total value of purchases and other inputs excluding VAT |
| 8 | Total value of supplies to EU countries (mainly Northern Ireland) |
| 9 | Total value of acquisitions from EU countries (mainly Northern Ireland) |

Your software must calculate these figures from your digital records and submit them to HMRC through the MTD API.

## Choosing MTD-compatible software

### What to look for

Not all accounting software is MTD-compatible. HMRC maintains a list of recognised software, but here are the key features to evaluate:

**HMRC API integration** — The software must be able to submit VAT returns directly to HMRC through the MTD API. This is the non-negotiable requirement.

**Digital record-keeping** — The software must store your VAT records in the required format — not just generate the return, but maintain the underlying records digitally.

**Bank feeds** — Automatic import of bank transactions saves time and reduces errors.

**VAT scheme support** — Does it support your VAT scheme (standard, cash accounting, flat rate)?

**Error checking** — Good software flags potential errors before submission — unusual figures, missing transactions, or inconsistencies.

**Multi-rate handling** — Can it handle standard (20%), reduced (5%), zero (0%), and exempt supplies?

**Reporting** — Can you review your VAT figures before submission and compare with prior periods?

Modern platforms like [Relentify](/accounting) are built with MTD compliance at their core, handling the record-keeping, calculation, and filing in a single integrated workflow.

### Types of MTD software

**Full accounting software** — Manages all your accounting (invoicing, expenses, bank reconciliation, reporting) and files your VAT return. This is the most efficient approach because everything is in one place.

**VAT filing-only software** — Only handles the VAT return submission. You maintain your records elsewhere (often in spreadsheets) and enter or import the nine-box figures into the filing tool. This is the minimum requirement but misses the broader benefits of digital accounting.

**Bridging software** — Connects spreadsheets to HMRC's MTD API. If you want to continue using spreadsheets for your records, bridging software submits the figures digitally. However, you must ensure digital links between your spreadsheet and the bridging tool.

## Digital links: the misunderstood requirement

One of the most confusing aspects of MTD for VAT is the digital links requirement.

### What is a digital link?

A digital link is an electronic or digital transfer or exchange of data between software programs, products, or applications. In simple terms, if data moves between two systems, the transfer must be digital — not manual re-keying.

### What qualifies as a digital link?

- Importing a CSV file from one system to another
- An API connection between two software products
- A linked cell in a spreadsheet that pulls data from another spreadsheet
- A direct database connection
- Copy-pasting within a software product (some interpretations)

### What does NOT qualify?

- **Manually typing figures** from one system into another. If you look at a spreadsheet and type the figures into your VAT filing software, that is not a digital link.
- **Reading from a paper printout** and entering figures manually.

### Why it matters

If you use multiple software products in your VAT process (e.g., a spreadsheet for records and separate filing software for submission), the chain of data must be digitally linked at every step. Breaking the chain with manual re-entry violates the requirements.

### The practical solution

The simplest way to comply is to use a single software product that handles everything — records, calculations, and filing. This eliminates the need for digital links between systems because there is only one system.

If you use spreadsheets, they must be linked to your filing software either through:
- A direct integration (the filing software reads the spreadsheet)
- An export/import process (you export from the spreadsheet and import into the filing software without manual intervention)

## Filing your VAT return through MTD

### Step 1: Ensure records are complete

Before filing, make sure all transactions for the VAT period are recorded. Reconcile your bank accounts, enter any missing invoices or expenses, and review for errors.

### Step 2: Review the VAT figures

Run a VAT report for the period. Check:
- Do the figures look reasonable compared to prior periods?
- Are there any unusually large or small amounts?
- Have you included all sales and purchases?
- Are the VAT rates correct on all transactions?

### Step 3: Submit through software

In your MTD-compatible software, navigate to the VAT filing section, select the period, review the nine-box summary, and submit. The software sends the data to HMRC and confirms receipt.

### Step 4: Note the receipt

HMRC will confirm successful submission with a receipt. Keep this for your records.

### Step 5: Arrange payment

Filing the return and paying the VAT are separate processes. If you owe VAT (Box 5 is positive), arrange payment by the deadline — one month and seven days after the VAT period end.

## Deadlines and penalties

### Filing and payment deadline

VAT returns must be filed, and any tax owed must be paid, by one month and seven days after the end of the VAT period. For a quarter ending 30 June, the deadline is 7 August.

### Late submission penalties

HMRC uses a points-based system for late VAT submissions:

- Each late submission earns one point
- When you reach the threshold (4 points for quarterly filers), you receive a penalty
- Points expire after a period of compliance

### Late payment penalties

Late payment incurs:
- A penalty calculated as a percentage of the outstanding amount
- Daily interest on the unpaid tax

### Interest on late payment

HMRC charges interest from the day after the deadline until the tax is paid.

## Common MTD for VAT mistakes

### Filing through the HMRC portal

You cannot file your VAT return by logging into the HMRC website and entering figures manually. This is the old method and no longer satisfies MTD requirements. You must use MTD-compatible software.

### Breaking the digital link chain

If your data passes through multiple systems, each transfer must be digital. Manual re-entry at any point breaks the chain and is non-compliant.

### Not reconciling before filing

Submitting a VAT return without reconciling your bank accounts risks including incorrect figures. Always reconcile first.

### Filing for the wrong period

Make sure you are filing for the correct VAT period. Your software should align with the periods HMRC has assigned to you.

### Forgetting about partial exemption

If your business makes both taxable and exempt supplies, you may need to apply partial exemption rules to your input VAT claim. This affects how much input VAT you can reclaim.

## Getting help

If you are unsure about MTD for VAT compliance:

- **Check HMRC's software list** to confirm your software is recognised
- **Talk to your accountant** about your specific situation
- **Contact HMRC's VAT helpline** for specific questions about your obligations
- **Test your software** by running a trial return (most software allows this)

MTD for VAT has been in place long enough that the initial teething problems are resolved. If you are still not fully compliant, now is the time to get your house in order. The penalties for non-compliance are real, and HMRC's enforcement is becoming more consistent.
