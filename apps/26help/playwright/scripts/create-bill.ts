import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/bills/new`)
  await page.waitForSelector('input[placeholder*="supplier" i], [data-testid="supplier-input"]')
  await page.waitForTimeout(500)
  await page.locator('input[placeholder*="Description" i], input[placeholder*="Item" i]').first().fill('Office supplies')
  await page.locator('input[placeholder*="amount" i], input[placeholder*="price" i]').first().fill('120')
  await page.waitForTimeout(800)
}
