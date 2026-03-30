import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright/scripts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3022',
  },
});
