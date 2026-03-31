import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/invoices`)
  await page.waitForSelector('table tbody tr, [data-testid="invoice-row"]')
  await page.click('table tbody tr:first-child, [data-testid="invoice-row"]:first-child')
  await page.waitForSelector('button:has-text("Record Payment")')
  await page.click('button:has-text("Record Payment")')
  await page.waitForSelector('input[name="amount"], input[placeholder*="amount" i]')
  await page.fill('input[name="amount"], input[placeholder*="amount" i]', '500')
  await page.waitForTimeout(800)
}
