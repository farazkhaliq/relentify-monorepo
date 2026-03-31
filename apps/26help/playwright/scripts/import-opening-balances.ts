import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/settings`)
  await page.waitForSelector('a:has-text("Opening Balances"), [href*="opening-balances"]')
  await page.click('a:has-text("Opening Balances"), [href*="opening-balances"]')
  await page.waitForSelector('button:has-text("Download template"), input[type="file"]')
  await page.waitForTimeout(1000)
}
