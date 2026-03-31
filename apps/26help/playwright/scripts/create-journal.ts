import type { Page } from '@playwright/test'
export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/journals/new`)
  await page.waitForSelector('[data-testid="journal-line"], button:has-text("Add line")')
  await page.waitForTimeout(400)
  const firstLine = page.locator('[data-testid="journal-line"]').first()
  await firstLine.locator('input').first().fill('4000')
  await firstLine.locator('input[placeholder*="debit" i]').fill('1000')
  await page.waitForTimeout(800)
}
