import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/bills`)
  await page.waitForSelector('table tbody tr')
  await page.click('table tbody tr:first-child')
  await page.waitForSelector('button:has-text("Record Payment")')
  await page.click('button:has-text("Record Payment")')
  await page.waitForSelector('input[name="amount"], input[placeholder*="amount" i]')
  await page.fill('input[name="amount"], input[placeholder*="amount" i]', '120')
  await page.waitForTimeout(800)
}
