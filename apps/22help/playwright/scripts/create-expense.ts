import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/expenses/new`)
  await page.waitForSelector('input[name="description"], input[placeholder*="description" i]')
  await page.fill('input[name="description"], input[placeholder*="description" i]', 'Team lunch')
  await page.fill('input[name="grossAmount"], input[placeholder*="amount" i]', '48.00')
  await page.waitForTimeout(800)
}
