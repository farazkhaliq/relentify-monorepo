import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/quotes`)
  await page.waitForSelector('table tbody tr')
  await page.click('table tbody tr:first-child')
  await page.waitForSelector('button:has-text("Convert to Invoice")')
  await page.click('button:has-text("Convert to Invoice")')
  await page.waitForSelector('[data-testid="invoice-form"], form')
  await page.waitForTimeout(1000)
}
