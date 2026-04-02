# E-Sign Remaining Work Plan

## Priority 1: Bug fixes (must fix before use)

### 1.1 Column name bug in request detail page
**File:** `apps/27sign/app/(main)/requests/[id]/page.tsx`
**Issue:** Queries `filename` but column is `original_filename`
**Fix:** Change the SELECT to use `original_filename`

### 1.2 Wire decline email notification
**File:** `apps/27sign/app/api/sign/[token]/decline/route.ts`
**Issue:** Updates DB status but doesn't email the sender
**Fix:** After `markSignerDeclined()`, look up the sender's email (via `created_by_user_id` → query relentify DB users table, or store sender email on signing_requests). Send `signerDeclinedEmail()` via `sendEmail()`.
**Decision needed:** The signing DB doesn't have the sender's email. Options:
- A) Add `sender_email` column to `signing_requests` (populated at creation)
- B) Query the shared relentify DB users table by `created_by_user_id`
- **Recommendation: A** — simpler, no cross-DB query

---

## Priority 2: MCP tests for document flow

### 2.1 Expand 27sign MCP test suite
**File:** `/opt/infra/mcp/27sign-mcp/run_tests.py` + new tool files
**Target:** 40+ tests (currently 25)

New tests needed:
- Document upload (PDF) → verify page count + dimensions returned
- Document upload (invalid file type) → 400
- Save field placements → verify stored correctly
- Get fields back → verify match
- Auto-detect fields → verify suggestions returned
- Multi-signer: create request with 2 signers → verify both get tokens
- Sequential signer: verify signer #2 blocked before #1 completes
- Fill field → verify audit log entry created
- Fill already-filled field → 409
- Decline to sign → verify status updated
- Complete all signers → verify `all_signed = TRUE`
- Signed PDF generation → verify `signed_pdf_data` populated
- Signer session JWT → verify issued after OTP, required for field fills
- Resend OTP → verify rate limiting (60s)
- Remind endpoint → verify email attempt

**Note:** Can't test Word→PDF conversion from MCP (LibreOffice runs inside Docker). Test with PDF only.

---

## Priority 3: Stripe products for E-Sign tiers

### 3.1 Create Stripe products + prices
Either via Stripe dashboard or API script:
- **Personal**: £5/mo, 50 requests, 3 API keys
- **Standard**: £12/mo, 500 requests, 5 API keys
- **Business Pro**: £22/mo, unlimited requests, 20 API keys

Store price IDs in `apps/27sign/.env`:
```
STRIPE_PRICE_PERSONAL=price_xxx
STRIPE_PRICE_STANDARD=price_xxx
STRIPE_PRICE_BUSINESS_PRO=price_xxx
```

### 3.2 Set up Stripe webhook endpoint
Register `https://esign.relentify.com/api/webhooks/stripe` in Stripe dashboard. Get webhook secret, add to `.env`:
```
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Priority 4: Reminder cron job

### 4.1 Create reminder script
**File:** `/opt/infra/scripts/esign-reminders.sh`
```bash
#!/bin/bash
# Send reminders for signing requests pending > 48h
curl -s -X POST http://localhost:3027/api/cron/reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 4.2 Create cron API route
**File:** `apps/27sign/app/api/cron/reminders/route.ts`
- Query signing_requests WHERE status = 'pending' AND created_at < NOW() - interval '48 hours' AND reminder_interval_hours > 0
- For each: check last reminder sent (audit log) — don't send more than once per interval
- Call `sendEmail()` with `reminderEmail()` template
- Auth: cron secret in header (same pattern as 22accounting cron routes)

### 4.3 Add to crontab
```
0 9 * * * /opt/infra/scripts/esign-reminders.sh
```
Run daily at 9am — checks all pending requests older than 48h.

---

## Priority 5: Browser verification

### 5.1 Manual testing checklist
- [ ] Login to esign.relentify.com → dashboard loads
- [ ] Click "New Request" → wizard shows upload + text options
- [ ] Upload a PDF → verify page renders via pdfjs-dist
- [ ] Place signature field on page → verify drag, resize, snap-to-grid
- [ ] Place date + text fields → verify different field types
- [ ] Add second signer → verify colour coding
- [ ] Click "Send" → verify request created, signing URL generated
- [ ] Open signing URL in incognito → verify OTP sent
- [ ] Enter OTP → verify document renders with field overlays
- [ ] Click signature field → verify signature pad opens
- [ ] Fill all fields → verify progress bar, "Finish Signing" enabled
- [ ] Submit → verify signed status
- [ ] Check dashboard → verify request shows as signed
- [ ] Check request detail → verify signer status, audit trail
- [ ] Download signed PDF → verify signatures at correct positions
- [ ] Certificate of Completion → verify all data present

---

## Build order

1. **1.1 + 1.2** — Bug fixes (30 min)
2. **2.1** — MCP tests (2 hours) — validates everything works before going further
3. **3.1 + 3.2** — Stripe products (30 min — mostly Stripe dashboard work)
4. **4.1 + 4.2 + 4.3** — Reminder cron (1 hour)
5. **5.1** — Browser testing (manual, 1 hour)
6. Rebuild + commit
