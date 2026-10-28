/**
 * The three request streams, each in arrival order with the intent and the entity
 * it really was:
 *
 * - `data/calibrate.json`, seed 4242: where the thresholds are chosen. It is the
 *   stream the first version measured on, unchanged byte for byte.
 * - `data/test.json`, seed 9001: where the headline is measured, with the
 *   thresholds chosen on the other one. The first version chose and reported on
 *   the same stream, which flatters any number it picks.
 * - `data/words.json`, seed 77: questions about a product or a country, the
 *   entity a guard that knows only digits cannot see.
 *
 * Intent frequencies are Zipf shaped (a few questions are most of the traffic)
 * and one bound request in three reuses a recent entity, because a customer who
 * asks about an order usually asks about it again. Greetings, sign offs, typos
 * and capitals are added. Deterministic, from a fixed PRNG.
 *
 *   npm run build:streams
 */
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { INTENTS, WORD_INTENTS, PRODUCTS, COUNTRIES, type Intent } from './intents.ts'

export type Req = { id: number; text: string; intent: string; entity: number | string | null }

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PRE = ['', '', '', '', 'hi, ', 'hello, ', 'please ', 'urgent: ', 'hey ', 'good morning, ']
const POST = ['', '', '', '', ' thanks', ' thank you!', ' asap', ' please', ' ?']

export function makeStream(seed: number, count: number, intents: Intent[]): Req[] {
  const r = mulberry32(seed)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const typo = (s: string) => {
    const w = s.split(' ')
    const i = Math.floor(r() * w.length)
    if (w[i].length > 4 && !/\d/.test(w[i])) {
      const k = 1 + Math.floor(r() * (w[i].length - 3))
      w[i] = w[i].slice(0, k) + w[i][k + 1] + w[i][k] + w[i].slice(k + 2)
    }
    return w.join(' ')
  }
  // a fixed shuffle of the intents, then Zipf weights over their rank
  const order = intents.map((_, i) => i).sort(() => r() - 0.5)
  const weights = order.map((_, rank) => 1 / (rank + 1) ** 0.9)
  const total = weights.reduce((a, b) => a + b, 0)
  const draw = () => {
    let x = r() * total
    for (let k = 0; k < order.length; k++) { x -= weights[k]; if (x <= 0) return order[k] }
    return order[0]
  }
  // one list of recent entities per kind, so a product is never reused as a country
  const recent: Record<string, (number | string)[]> = { n: [], p: [], c: [] }
  const out: Req[] = []
  for (let i = 0; i < count; i++) {
    const it = intents[draw()]
    let entity: number | string | null = null
    let text = pick(it.ask)
    if (it.bound) {
      const kind = text.includes('{p}') ? 'p' : text.includes('{c}') ? 'c' : 'n'
      const list = recent[kind]
      const fresh = () => (kind === 'n' ? 1000 + Math.floor(r() * 300) : pick(kind === 'p' ? PRODUCTS : COUNTRIES))
      entity = list.length && r() < 0.33 ? pick(list) : fresh()
      list.push(entity)
      if (list.length > 30) list.shift()
      text = text.replace(`{${kind}}`, String(entity))
    }
    text = pick(PRE) + text + pick(POST)
    if (r() < 0.15) text = typo(text)
    if (r() < 0.1) text = text.toUpperCase()
    out.push({ id: i + 1, text: text.replace(/\s+/g, ' ').trim(), intent: it.id, entity })
  }
  return out
}

export const STREAMS = [
  { file: 'calibrate.json', seed: 4242, count: 2000, intents: INTENTS },
  { file: 'test.json', seed: 9001, count: 2000, intents: INTENTS },
  { file: 'words.json', seed: 77, count: 1000, intents: WORD_INTENTS },
] as const

export const serialise = (s: Req[]) => JSON.stringify(s).replace(/\},\{/g, '},\n{') + '\n'

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sums: string[] = []
  for (const s of STREAMS) {
    const body = serialise(makeStream(s.seed, s.count, [...s.intents]))
    writeFileSync(new URL(`../data/${s.file}`, import.meta.url), body)
    sums.push(`${createHash('sha256').update(body).digest('hex')}  ${s.file}`)
    console.log(s.file, s.count, 'requests, seed', s.seed)
  }
  writeFileSync(new URL('../data/streams.sha256', import.meta.url), sums.join('\n') + '\n')
}
