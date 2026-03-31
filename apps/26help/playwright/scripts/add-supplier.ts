import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/suppliers/new`)
  await page.waitForSelector('input[name="name"], input[placeholder*="name" i]')
  await page.fill('input[name="name"], input[placeholder*="name" i]', 'Office Direct Ltd')
  await page.fill('input[type="email"]', 'accounts@officedirect.com')
  await page.waitForTimeout(800)
}
