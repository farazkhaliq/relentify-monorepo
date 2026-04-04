import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/invoices`)
  await page.waitForSelector('table tbody tr')
  await page.click('table tbody tr:first-child')
  await page.waitForSelector('button:has-text("Send")')
  await page.click('button:has-text("Send")')
  await page.waitForSelector('[role="dialog"], form:has(input[type="email"])')
  await page.waitForTimeout(1000)
}
