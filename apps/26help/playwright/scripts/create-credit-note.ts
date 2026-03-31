import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/credit-notes/new`)
  await page.waitForSelector('input[placeholder*="customer" i], [data-testid="customer-input"]')
  await page.waitForTimeout(400)
  await page.locator('input[placeholder*="Description" i]').first().fill('Returned goods')
  await page.locator('input[placeholder*="amount" i], input[placeholder*="price" i]').first().fill('200')
  await page.waitForTimeout(800)
}
