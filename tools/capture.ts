/**
 * The pictures: `docs/semcache.png` at the top of the README, and
 * `public/card.png` at 1200 by 630 for link previews. Both are the built page at
 * load: the guard on numbers at its chosen threshold, on the stream it was not
 * chosen on, with its readout and the start of its curve.
 *
 *   npm run capture
 *
 * Beside them, `docs/capture.json` keeps the words the README picture shows.
 * `check:capture` reads the same words off the current page and fails when they
 * differ, so a page that changed its claim cannot keep an old picture of it.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { browserReady } from './preflight.ts'
import { serve } from './serve.ts'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/** The words a reader sees in the picture: the claim, which cache, its threshold, and the readout. */
export async function visibleWords(page: import('playwright').Page) {
  return page.evaluate(() => ({
    headline: document.querySelector('#headline')!.textContent!.trim(),
    mode: document.querySelector('#mode [aria-pressed="true"]')!.textContent!.trim(),
    threshold: document.querySelector('#tau-out')!.textContent!.trim(),
    readout: [...document.querySelectorAll('#readout .stat .n')].map((n) => n.textContent!.trim()),
  }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await browserReady()
  const server = await serve()
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1040 }, deviceScaleFactor: 1 })
    await page.goto(server.url)
    await page.waitForSelector('#readout .stat')
    await page.screenshot({ path: here('../docs/semcache.png') })
    writeFileSync(here('../docs/capture.json'), JSON.stringify(await visibleWords(page), null, 1) + '\n')
    const card = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
    await card.goto(server.url)
    await card.waitForSelector('#readout .stat')
    await card.screenshot({ path: here('../public/card.png') })
    console.log('wrote docs/semcache.png, docs/capture.json and public/card.png')
  } finally {
    await browser.close()
    server.stop()
  }
}
