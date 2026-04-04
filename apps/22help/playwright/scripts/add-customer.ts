import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/customers/new`)
  await page.waitForSelector('input[name="name"], input[placeholder*="name" i]')
  await page.fill('input[name="name"], input[placeholder*="name" i]', 'Acme Ltd')
  await page.fill('input[type="email"]', 'billing@acme.com')
  await page.waitForTimeout(800)
  await page.waitForSelector('button[type="submit"], button:has-text("Save")')
}
