import { chromium } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../.env') })

const SCRIPT_NAME = process.argv[2]
if (!SCRIPT_NAME) {
  console.error('Usage: ts-node record.ts <script-name>')
  console.error('Example: ts-node record.ts create-invoice')
  process.exit(1)
}

const SCRIPTS_DIR = path.join(__dirname, 'scripts')
const TMP_DIR = path.join(__dirname, '../tmp-videos')
const OUTPUT_DIR = path.join(__dirname, '../public/videos')

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3022'
const EMAIL = process.env.PLAYWRIGHT_EMAIL ?? ''
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('Set PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD in .env')
  process.exit(1)
}

async function run() {
  fs.mkdirSync(TMP_DIR, { recursive: true })
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: TMP_DIR,
      size: { width: 1280, height: 720 },
    },
  })

  const page = await context.newPage()

  // Log in
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/dashboard**`)

  // Run the feature script
  const scriptPath = path.join(SCRIPTS_DIR, `${SCRIPT_NAME}.ts`)
  if (!fs.existsSync(scriptPath)) {
    console.error(`Script not found: ${scriptPath}`)
    process.exit(1)
  }
  const { run: runScript } = await import(scriptPath)
  await runScript(page, BASE_URL)

  await page.waitForTimeout(1000)

  await context.close()
  await browser.close()

  // Find the recorded file
  const files = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.webm'))
  if (files.length === 0) {
    console.error('No video recorded')
    process.exit(1)
  }
  const rawPath = path.join(TMP_DIR, files[0])
  const outputPath = path.join(OUTPUT_DIR, `${SCRIPT_NAME}.webm`)

  // Compress with ffmpeg: VP9, CRF 28, fast preset (~70% smaller than raw)
  console.log(`Compressing ${rawPath} → ${outputPath}`)
  execSync(
    `ffmpeg -i "${rawPath}" -c:v libvpx-vp9 -crf 28 -b:v 0 -deadline realtime -cpu-used 5 "${outputPath}" -y`,
    { stdio: 'inherit' }
  )

  fs.unlinkSync(rawPath)
  console.log(`✅ Saved: ${outputPath}`)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
