import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../.env') })

const SCRIPTS_DIR = path.join(__dirname, 'scripts')
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3022'
const EMAIL = process.env.PLAYWRIGHT_EMAIL ?? ''
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD ?? ''

interface ValidationResult {
  script: string
  passed: boolean
  error?: string
}

async function validateAll() {
  if (!EMAIL || !PASSWORD) {
    console.error('PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD must be set')
    process.exit(1)
  }

  const scripts = fs
    .readdirSync(SCRIPTS_DIR)
    .filter(f => f.endsWith('.ts'))
    .map(f => f.replace('.ts', ''))

  console.log(`Validating ${scripts.length} scripts against ${BASE_URL}\n`)

  const results: ValidationResult[] = []

  for (const scriptName of scripts) {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const page = await context.newPage()

    try {
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(`${BASE_URL}/dashboard**`, { timeout: 10000 })

      const { run } = await import(path.join(SCRIPTS_DIR, `${scriptName}.ts`))
      await run(page, BASE_URL)

      results.push({ script: scriptName, passed: true })
      process.stdout.write(`  ✅ ${scriptName}\n`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ script: scriptName, passed: false, error: message })
      process.stdout.write(`  ❌ ${scriptName}: ${message}\n`)
    } finally {
      await context.close()
      await browser.close()
    }
  }

  const failed = results.filter(r => !r.passed)
  console.log(`\nResults: ${results.length - failed.length}/${results.length} passed`)

  if (failed.length > 0) {
    console.error(`\nFailing scripts (UI may have changed):`)
    failed.forEach(r => console.error(`  ${r.script}: ${r.error}`))
    process.exit(1)
  }

  console.log('\nAll scripts valid ✅')
}

validateAll().catch(err => {
  console.error(err)
  process.exit(1)
})
