/**
 * The page a visitor gets, read after its script has run, at 1280 and at 390.
 *
 *   npm run check:page        (inside npm run verify, which starts the server)
 *
 * The HTML file is empty where the claims go, because src/main.ts writes every
 * figure from src/generated/measure.json, so this reads the DOM a browser built
 * and holds it to the measurement and to the cache itself:
 *
 * - the headline, and the readout at load (the guard on numbers at its chosen
 *   threshold), say what measure.json says;
 * - each cache button and the slider move the readout to that cache's row of
 *   the sweep, including similarity alone at 0.80 serving its wrong answers;
 * - the three figures for product and country questions match;
 * - every example request in the box gets the verdict the same cache gives in
 *   Node, so a bundling mistake cannot put a different cache on the page;
 * - no console error, and nothing wider than the window at either width.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from 'playwright'
import { SemanticCache } from '../src/lib/cache.ts'
import { digits, digitsAndNames } from '../src/lib/entities.ts'
import { INTENTS, WORD_INTENTS, CATALOG } from './intents.ts'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const m = JSON.parse(readFileSync(here('../src/generated/measure.json'), 'utf8'))
const url = process.env.SEMCACHE_URL
if (!url) { console.error('SEMCACHE_URL is not set: run this through `npm run verify`'); process.exit(1) }

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const fmt = (n: number) => n.toLocaleString('en-US')
const fails: string[] = []
const expect = (ok: boolean, what: string) => { if (!ok) fails.push(what) }
type Mode = 'plain' | 'digits' | 'names'
const GUARD = { plain: null, digits, names: digitsAndNames(CATALOG) }
const STORED = [...INTENTS, ...WORD_INTENTS].map((it) => ({ id: it.id, text: it.ask[0].replace('{n}', '1042').replace('{p}', 'blue kettle').replace('{c}', 'germany') }))

const readout = (page: Page) => page.$$eval('#readout .stat .n', (ns) => ns.map((n) => n.textContent!.trim()))
const rowOf = (mode: Mode, tau: number) => m.test.sweep[mode].find((r: { tau: number }) => Math.abs(r.tau - tau) < 1e-9)
const wantReadout = (mode: Mode, tau: number) => { const r = rowOf(mode, tau); return [pct(r.billCut), pct(r.hitRate), fmt(r.wrong), fmt(r.vetoed)] }

const browser = await chromium.launch()
try {
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    const errors: string[] = []
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(url)
    await page.waitForSelector('#readout .stat')
    const at = `at ${w}`

    const t = m.test.atChosen, wd = m.words.atChosen
    const headline = (await page.textContent('#headline'))!.trim()
    const want = `An entity guard lets a semantic cache cut ${pct(t.digits.billCut)} of the bill instead of ${pct(t.plain.billCut)}, until the questions name a product or a country: then it serves ${fmt(wd.digits.wrong)} wrong answers in ${fmt(m.streams.words.requests)}.`
    expect(headline === want, `${at}: the headline reads "${headline}", the measurement says "${want}"`)

    const first = await readout(page)
    expect(JSON.stringify(first) === JSON.stringify(wantReadout('digits', m.chosen.digits.tau)), `${at}: at load the readout is ${JSON.stringify(first)}, the guard on numbers at ${m.chosen.digits.tau} measured ${JSON.stringify(wantReadout('digits', m.chosen.digits.tau))}`)

    for (const mode of ['plain', 'names', 'digits'] as Mode[]) {
      await page.click(`#mode [data-mode="${mode}"]`)
      for (const tau of [0.8, m.chosen[mode].tau]) {
        await page.$eval('#tau', (el, v) => { (el as HTMLInputElement).value = String(v); el.dispatchEvent(new Event('input')) }, tau)
        const got = await readout(page)
        expect(JSON.stringify(got) === JSON.stringify(wantReadout(mode, tau)), `${at}: ${mode} at ${tau} reads ${JSON.stringify(got)}, the sweep says ${JSON.stringify(wantReadout(mode, tau))}`)
      }
    }

    const words = await page.$$eval('#words .stat .n', (ns) => ns.map((n) => n.textContent!.trim()))
    const wantWords = (['plain', 'digits', 'names'] as Mode[]).map((mode) => fmt(wd[mode].wrong))
    expect(JSON.stringify(words) === JSON.stringify(wantWords), `${at}: the product and country figures are ${JSON.stringify(words)}, the measurement says ${JSON.stringify(wantWords)}`)

    // the box: each example, under each cache at its chosen threshold, against the same cache in Node
    for (const mode of ['plain', 'digits', 'names'] as Mode[]) {
      await page.click(`#mode [data-mode="${mode}"]`)
      const tau = m.chosen[mode].tau
      await page.$eval('#tau', (el, v) => { (el as HTMLInputElement).value = String(v); el.dispatchEvent(new Event('input')) }, tau)
      const chips = await page.$$('#ask .chip')
      for (const chip of chips) {
        await chip.click()
        const q = await page.inputValue('#q')
        const cache = new SemanticCache<string>(tau, GUARD[mode])
        for (const s of STORED) cache.insert(s.text, s.id)
        const l = cache.lookup(q)
        const node = l.hit ? 'HIT' : l.vetoed ? 'TURNED BACK' : 'MISS'
        const tag = (await page.textContent('#live .tag'))!
        const shown = tag.startsWith('HIT') ? 'HIT' : tag.includes('TURNED BACK') ? 'TURNED BACK' : 'MISS'
        expect(shown === node, `${at}: "${q}" under ${mode} at ${tau} shows ${shown} in the page and ${node} in Node`)
      }
    }

    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(wide <= 0, `${at}: the page is ${wide}px wider than the window`)
    expect(!errors.length, `${at}: console errors: ${errors.join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
}

if (fails.length) { console.error(fails.map((f) => 'FAIL  ' + f).join('\n')); process.exit(1) }
console.log('check:page ok: headline, readout at load, every cache at 0.80 and at its chosen threshold, the product and country figures, and every example agree with Node, at 1280 and 390')
