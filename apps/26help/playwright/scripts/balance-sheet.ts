import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/reports/balance-sheet`)
  await page.waitForSelector('button:has-text("Run"), button:has-text("Generate")')
  await page.click('button:has-text("Run"), button:has-text("Generate")')
  await page.waitForSelector('[data-testid="report-table"], table')
  await page.waitForTimeout(1000)
}
