import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/vat`)
  await page.waitForSelector('button:has-text("Calculate"), button:has-text("Run")')
  await page.click('button:has-text("Calculate"), button:has-text("Run")')
  await page.waitForSelector('[data-testid="vat-boxes"], [data-testid="vat-return"]')
  await page.waitForTimeout(1200)
}
