// playwright/scripts/migrate-xero.ts
import { test, expect } from '@playwright/test';
import path from 'path';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

test('Xero migration wizard — completes full 6-step flow', async ({ page }) => {
  // Navigate to migrate page (assumes authenticated session)
  await page.goto('/dashboard/migrate');

  // Step 1: Choose source
  await page.click('button:has-text("Xero")');
  await expect(page.locator('h2')).toContainText('Step 2');

  // Step 2: Set cutoff date
  await page.fill('input[type="text"]', '2024-12-31');
  await page.click('button:has-text("Continue")');
  await expect(page.locator('h2')).toContainText('Step 3');

  // Step 3: Upload files
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('div.border-dashed'),
  ]);
  await fileChooser.setFiles([
    path.join(FIXTURES, 'xero-coa.csv'),
    path.join(FIXTURES, 'xero-trial-balance.csv'),
  ]);
  await page.click('button:has-text("Parse Files")');
  await expect(page.locator('h2')).toContainText('Step 4', { timeout: 15000 });

  // Step 4: Map accounts — accept auto-mappings
  await page.click('button:has-text("Continue to Preview")');
  await expect(page.locator('h2')).toContainText('Step 5');

  // Step 5: Validate — trial balance should be balanced
  await expect(page.locator('text=Trial balance')).toContainText('=');

  // Step 6: Import button exists and is enabled (trial balance balanced)
  await expect(page.locator('button:has-text("Import")')).toBeEnabled();
});
