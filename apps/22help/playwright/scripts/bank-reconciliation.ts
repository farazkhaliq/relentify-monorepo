import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/banking`)
  await page.waitForSelector('button:has-text("Sync"), [data-testid="sync-button"]')
  await page.waitForTimeout(600)
  await page.click('button:has-text("Sync"), [data-testid="sync-button"]')
  await page.waitForTimeout(1200)
  await page.waitForSelector('[data-testid="transaction-row"], table tbody tr')
  await page.waitForTimeout(800)
}
