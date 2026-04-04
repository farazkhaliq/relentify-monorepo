import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/expenses`)
  await page.waitForSelector('[role="tab"]:has-text("Pending"), button:has-text("Pending")')
  await page.click('[role="tab"]:has-text("Pending"), button:has-text("Pending")')
  await page.waitForSelector('table tbody tr')
  await page.click('table tbody tr:first-child')
  await page.waitForSelector('button:has-text("Approve")')
  await page.waitForTimeout(600)
  await page.click('button:has-text("Approve")')
  await page.waitForTimeout(800)
}
