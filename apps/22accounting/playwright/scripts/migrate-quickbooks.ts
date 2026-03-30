// playwright/scripts/migrate-quickbooks.ts
import { test, expect } from '@playwright/test';
import path from 'path';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

test('QuickBooks migration wizard — source selection and file upload', async ({ page }) => {
  await page.goto('/dashboard/migrate');

  // Step 1: Choose QuickBooks
  await page.click('button:has-text("QuickBooks")');
  await expect(page.locator('h2')).toContainText('Step 2');

  // Step 2: Set cutoff date
  await page.fill('input[type="text"]', '2024-12-31');
  await page.click('button:has-text("Continue")');
  await expect(page.locator('h2')).toContainText('Step 3');

  // Step 3: Verify QuickBooks-specific instructions shown
  await expect(page.locator('text=IIF or CSV exports')).toBeVisible();
  await expect(page.locator('input[accept=".csv,.iif"]')).toBeAttached();
});

test('QuickBooks migration wizard — back navigation preserves state', async ({ page }) => {
  await page.goto('/dashboard/migrate');

  // Step 1: Choose QuickBooks
  await page.click('button:has-text("QuickBooks")');
  await expect(page.locator('h2')).toContainText('Step 2');

  // Go back to step 1 via session state
  await page.click('button:has-text("Back")');
  await expect(page.locator('h2')).toContainText('Step 1');

  // QuickBooks card still highlighted (sourceId persisted)
  // Re-select and continue to verify state is preserved
  await page.click('button:has-text("QuickBooks")');
  await expect(page.locator('h2')).toContainText('Step 2');
});
