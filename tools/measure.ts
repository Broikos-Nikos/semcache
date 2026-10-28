/**
 * Replays the committed streams through the cache and writes what happened to
 * src/generated/measure.json. The page and the README read that file and
 * compute nothing of their own.
 *
 * Three caches, the same code (`src/lib/cache.ts`) with three guards:
 * similarity only; a guard that compares digits; a guard that compares digits
 * and the shop's own names (`CATALOG`).
 *
 * 1. **Choose** each cache's threshold on `data/calibrate.json`: the one that
 *    cuts the most of the bill with no wrong answer.
 * 2. **Measure** the headline on `data/test.json` at those thresholds, a stream
 *    none of them were chosen on. The full sweep on it feeds the page's slider.
 * 3. **Break** them on `data/words.json`, where every answer depends on a
 *    product or a country, at the same thresholds.
 *
 * A hit is correct only if the stored answer was for the same intent and the
 * same entity. The bill is priced from the assumptions below, which are
 * assumptions: the page shows them, the measurement does not vary them.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SemanticCache } from '../src/lib/cache.ts'
import { cosine, embed } from '../src/lib/embed.ts'
import { digits, digitsAndNames, type Entities } from '../src/lib/entities.ts'
import { INTENTS, WORD_INTENTS, CATALOG } from './intents.ts'
import type { Req } from './streams.ts'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export const ASSUME = { inPerM: 3, outPerM: 15, embedPerM: 0.02, charsPerToken: 4 }
export const THRESHOLDS = Array.from({ length: 25 }, (_, i) => Math.round((0.5 + i * 0.02) * 100) / 100)
export const MODES = ['plain', 'digits', 'names'] as const
export type Mode = (typeof MODES)[number]
const GUARDS: Record<Mode, Entities | null> = { plain: null, digits, names: digitsAndNames(CATALOG) }

type Stored = { intent: string; entity: number | string | null; text: string; i: number }

const tokens = new Map([...INTENTS, ...WORD_INTENTS].map((i) => [i.id, i.tokens]))
const llmCost = (intent: string) => { const [a, b] = tokens.get(intent)!; return (a * ASSUME.inPerM + b * ASSUME.outPerM) / 1e6 }
const embedCost = (text: string) => (text.length / ASSUME.charsPerToken) * ASSUME.embedPerM / 1e6
const round = (x: number) => Math.round(x * 1e6) / 1e6

/** One stream, read once: its requests, its hash, and every pairwise similarity, computed once. */
export function load(file: string) {
  const raw = readFileSync(here(`../data/${file}`), 'utf8')
  const stream = JSON.parse(raw) as Req[]
  const vecs = stream.map((q) => embed(q.text))
  const sims = new Float32Array((stream.length * (stream.length - 1)) / 2)
  for (let i = 1; i < stream.length; i++) for (let j = 0; j < i; j++) sims[(i * (i - 1)) / 2 + j] = cosine(vecs[i], vecs[j])
  return { file, stream, vecs, sims, sha256: createHash('sha256').update(raw).digest('hex') }
}
type Loaded = ReturnType<typeof load>

function replay(s: Loaded, tau: number, mode: Mode) {
  let current = 0
  const sim = (e: { value: Stored }) => s.sims[(current * (current - 1)) / 2 + e.value.i]
  const cache = new SemanticCache<Stored>(tau, GUARDS[mode], sim)
  let hits = 0, correct = 0, entitySwaps = 0, crossIntent = 0, vetoed = 0, baseline = 0, bill = 0
  const samples: { request: string; cached: string; score: number; kind: string }[] = []
  s.stream.forEach((q, i) => {
    current = i
    baseline += llmCost(q.intent)
    bill += embedCost(q.text)
    const l = cache.lookup(q.text, s.vecs[i])
    if (l.vetoed) vetoed++
    if (l.hit && l.entry) {
      hits++
      const v = l.entry.value
      if (v.intent === q.intent && v.entity === q.entity) correct++
      else {
        const kind = v.intent === q.intent ? 'another entity' : 'another question'
        if (v.intent === q.intent) entitySwaps++
        else crossIntent++
        if (samples.length < 6) samples.push({ request: q.text, cached: v.text, score: round(l.score), kind })
      }
    } else {
      bill += llmCost(q.intent)
      cache.insert(q.text, { intent: q.intent, entity: q.entity, text: q.text, i }, s.vecs[i])
    }
  })
  const n = s.stream.length
  return { tau, hits, correct, wrong: hits - correct, entitySwaps, crossIntent, vetoed, hitRate: round(hits / n), wrongRate: round((hits - correct) / n), billCut: round(1 - bill / baseline), baseline: round(baseline), bill: round(bill), samples }
}
type Row = ReturnType<typeof replay>
const brief = (r: Row) => ({ tau: r.tau, hits: r.hits, wrong: r.wrong, entitySwaps: r.entitySwaps, crossIntent: r.crossIntent, vetoed: r.vetoed, hitRate: r.hitRate, billCut: r.billCut, samples: r.samples })

/** The most any cache could cut: every repeat of the same intent and entity answered from cache, none wrongly. */
function ceiling(s: Loaded) {
  const seen = new Set<string>()
  let hits = 0, saved = 0, baseline = 0
  for (const q of s.stream) {
    const key = `${q.intent}|${q.entity}`
    baseline += llmCost(q.intent)
    if (seen.has(key)) { hits++; saved += llmCost(q.intent) }
    seen.add(key)
  }
  return { hits, hitRate: round(hits / s.stream.length), billCut: round(saved / baseline) }
}

/** Each cache's threshold: the one that cuts the most with no wrong answer on the stream given. */
export function choose(s: Loaded) {
  const chosen = {} as Record<Mode, { tau: number; billCut: number; hits: number }>
  for (const mode of MODES) {
    const rows = THRESHOLDS.map((t) => replay(s, t, mode)).filter((r) => r.wrong === 0).sort((a, b) => b.billCut - a.billCut || a.tau - b.tau)
    if (!rows.length) throw new Error(`no threshold with zero wrong answers for ${mode}`)
    chosen[mode] = { tau: rows[0].tau, billCut: rows[0].billCut, hits: rows[0].hits }
  }
  return chosen
}

export function measure() {
  const cal = load('calibrate.json'), test = load('test.json'), words = load('words.json')

  // 1. choose, on the calibration stream only
  const chosen = choose(cal)

  // 2. measure on the test stream: the full sweep for the page, and the chosen thresholds for the headline
  const sweep = Object.fromEntries(MODES.map((mode) => [mode, THRESHOLDS.map((t) => replay(test, t, mode))])) as Record<Mode, Row[]>
  const atChosen = Object.fromEntries(MODES.map((mode) => [mode, brief(sweep[mode].find((r) => r.tau === chosen[mode].tau)!)])) as Record<Mode, ReturnType<typeof brief>>
  const at080 = Object.fromEntries(MODES.map((mode) => [mode, brief(sweep[mode].find((r) => r.tau === 0.8)!)])) as Record<Mode, ReturnType<typeof brief>>

  // 3. break: the questions about a product or a country, at the same thresholds
  const wordsAt = Object.fromEntries(MODES.map((mode) => [mode, brief(replay(words, chosen[mode].tau, mode))])) as Record<Mode, ReturnType<typeof brief>>

  return {
    streams: Object.fromEntries([cal, test, words].map((s) => [s.file.replace('.json', ''), { sha256: s.sha256, requests: s.stream.length, naming: s.stream.filter((q) => q.entity !== null).length }])),
    intents: INTENTS.length, wordIntents: WORD_INTENTS.length, catalog: CATALOG.length,
    assume: ASSUME,
    chosen,
    test: { ceiling: ceiling(test), atChosen, at080, sweep },
    words: { ceiling: ceiling(words), atChosen: wordsAt },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t0 = Date.now()
  const m = measure()
  mkdirSync(here('../src/generated'), { recursive: true })
  writeFileSync(here('../src/generated/measure.json'), JSON.stringify(m, null, 1) + '\n')
  const show = (o: Record<string, { tau: number; billCut: number; wrong?: number; hits: number }>) => Object.entries(o).map(([k, v]) => `${k} tau ${v.tau} cut ${(v.billCut * 100).toFixed(1)}% hits ${v.hits}${v.wrong === undefined ? '' : ` wrong ${v.wrong}`}`).join(' | ')
  console.log(`${Date.now() - t0} ms`)
  console.log('chosen on calibrate:', show(m.chosen))
  console.log('test at chosen:     ', show(m.test.atChosen))
  console.log('test at 0.80:       ', show(m.test.at080))
  console.log('words at chosen:    ', show(m.words.atChosen))
  console.log('ceilings: test', m.test.ceiling, 'words', m.words.ceiling)
}
