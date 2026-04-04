import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/invoices/new`)
  await page.waitForSelector('[data-testid="customer-input"], input[placeholder*="customer" i]')
  await page.click('[data-testid="customer-input"], input[placeholder*="customer" i]')
  await page.waitForTimeout(400)
  await page.waitForSelector('button:has-text("Add line item"), button:has-text("Add item")')
  await page.click('button:has-text("Add line item"), button:has-text("Add item")')
  await page.waitForTimeout(300)
  await page.locator('input[placeholder*="Description" i], input[placeholder*="Item" i]').first().fill('Consulting services')
  await page.locator('input[placeholder*="price" i], input[placeholder*="amount" i]').first().fill('500')
  await page.waitForTimeout(1000)
  await page.waitForSelector('button:has-text("Save"), button:has-text("Save as Draft")')
}
