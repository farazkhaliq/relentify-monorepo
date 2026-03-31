import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/quotes/new`)
  await page.waitForSelector('input[placeholder*="customer" i], [data-testid="customer-input"]')
  await page.waitForTimeout(500)
  await page.click('button:has-text("Add"), button:has-text("Add line item")')
  await page.waitForTimeout(400)
  await page.locator('input[placeholder*="Description" i]').first().fill('Website design')
  await page.locator('input[placeholder*="price" i], input[placeholder*="amount" i]').first().fill('1200')
  await page.waitForTimeout(800)
}
