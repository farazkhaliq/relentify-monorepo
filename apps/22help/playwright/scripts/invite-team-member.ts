import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/settings/team`)
  await page.waitForSelector('button:has-text("Invite")')
  await page.click('button:has-text("Invite")')
  await page.waitForSelector('[role="dialog"] input[type="email"]')
  await page.fill('[role="dialog"] input[type="email"]', 'colleague@example.com')
  await page.waitForTimeout(800)
}
