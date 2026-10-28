/**
 * The page. Every figure on it is read from src/generated/measure.json, written
 * by `npm run measure`. The only thing computed here is the box where a visitor
 * asks something, which runs the same cache and the same guards as the
 * measurement on one request.
 */
import './style.css'
import m from './generated/measure.json'
import { SemanticCache } from './lib/cache'
import { digits, digitsAndNames, type Entities } from './lib/entities'
import { INTENTS, WORD_INTENTS, CATALOG } from '../tools/intents'

const el = <T extends HTMLElement>(id: string): T => {
  const n = document.getElementById(id)
  if (!n) throw new Error(`the page is missing #${id}`)
  return n as T
}
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`
const fmt = (n: number) => n.toLocaleString('en-US')
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

type Mode = 'plain' | 'digits' | 'names'
const LABEL: Record<Mode, string> = { plain: 'similarity only', digits: 'guard: numbers', names: 'guard: numbers and names' }
const GUARD: Record<Mode, Entities | null> = { plain: null, digits, names: digitsAndNames(CATALOG) }
const state = { mode: 'digits' as Mode, tau: m.chosen.digits.tau }
const sweep = m.test.sweep as Record<Mode, typeof m.test.sweep.plain>
const row = () => sweep[state.mode].find((r) => Math.abs(r.tau - state.tau) < 1e-9)!

const t = m.test.atChosen, w = m.words.atChosen
el('headline').textContent = `An entity guard lets a semantic cache cut ${pct(t.digits.billCut)} of the bill instead of ${pct(t.plain.billCut)}, until the questions name a product or a country: then it serves ${fmt(w.digits.wrong)} wrong answers in ${fmt(m.streams.words.requests)}.`
el('lead').textContent = `The guard is one rule: if two similar requests name different entities, they are different questions. Each cache's threshold was chosen on one stream of ${fmt(m.streams.calibrate.requests)} support requests and is measured here on another ${fmt(m.streams.test.requests)} it never saw.`

// the chart: bill cut against threshold on the test stream, one line per cache
const W = 640, H = 260, L = 44, R = 12, T = 12, B = 30
const x = (tau: number) => L + ((tau - 0.5) / 0.48) * (W - L - R)
const y = (v: number) => T + (1 - v) * (H - T - B)
const STROKE: Record<Mode, string> = { plain: '#9a8f88', digits: '#ff6a00', names: '#ffffff' }
function drawChart() {
  const line = (mode: Mode) => {
    const pts = sweep[mode].map((r) => `${x(r.tau).toFixed(1)},${y(r.billCut).toFixed(1)}`).join(' ')
    const dots = sweep[mode].map((r) => `<circle cx="${x(r.tau).toFixed(1)}" cy="${y(r.billCut).toFixed(1)}" r="${mode === state.mode ? 3.6 : 2.6}" fill="${r.wrong > 0 ? '#e63c00' : '#080604'}" stroke="${STROKE[mode]}" stroke-width="1.4"/>`).join('')
    return `<polyline class="l-${mode}${mode === state.mode ? ' on' : ''}" points="${pts}" stroke="${STROKE[mode]}"/>${dots}`
  }
  const grid = [0, 0.25, 0.5, 0.75, 1].map((v) => `<line class="ax" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tx" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`).join('')
  const ticks = [0.5, 0.6, 0.7, 0.8, 0.9].map((tau) => `<text class="tx" x="${x(tau)}" y="${H - 10}" text-anchor="middle">${tau.toFixed(1)}</text>`).join('')
  const c = m.test.ceiling.billCut
  const ceil = `<line class="ax" x1="${L}" x2="${W - R}" y1="${y(c)}" y2="${y(c)}" stroke-dasharray="4 4" style="stroke:#8a7f76"/><text class="tx" x="${W - R}" y="${y(c) - 5}" text-anchor="end">ceiling ${pct(c, 0)}</text>`
  const order: Mode[] = (['plain', 'names', 'digits'] as Mode[]).filter((mm) => mm !== state.mode).concat(state.mode)
  el('chart').innerHTML = grid + ticks + ceil + order.map(line).join('') + `<line class="sel" x1="${x(state.tau)}" x2="${x(state.tau)}" y1="${T}" y2="${H - B}"/>`
}
el('chart-t').textContent = 'Bill cut against threshold on the stream the thresholds were not chosen on. Grey: similarity only. Orange: guard on numbers. White: guard on numbers and names. A red dot is a threshold where wrong answers were served. The dashed line is the most any cache could cut: above it, the extra cut is wrong answers counted as savings. The white line runs under the orange one, because on this stream the names change almost nothing.'

function render() {
  const r = row()
  el('tau-out').textContent = state.tau.toFixed(2)
  const stat = (n: string, what: string, hot = false) => `<div class="stat"><div class="n${hot ? ' hot' : ''}">${n}</div><div class="what">${what}</div></div>`
  el('readout').innerHTML = [
    stat(pct(r.billCut), `of the bill cut, from $${r.baseline.toFixed(2)} to $${r.bill.toFixed(2)} at the assumed prices`, true),
    stat(pct(r.hitRate), `of requests served from the cache (${fmt(r.hits)} of ${fmt(m.streams.test.requests)})`),
    stat(fmt(r.wrong), r.wrong === 0 ? 'wrong answers served' : `wrong answers served: ${fmt(r.entitySwaps)} about another order, ${fmt(r.crossIntent)} to another question`, r.wrong > 0),
    stat(fmt(r.vetoed), state.mode === 'plain' ? 'turned back: there is no guard' : 'hits the guard turned back into misses, because the entities differed'),
  ].join('')
  el('wrong-h').textContent = r.wrong === 0 ? 'No wrong answers at this threshold' : `Wrong answers at this threshold, ${r.samples.length < r.wrong ? `the first ${r.samples.length}` : 'all of them'}`
  el('wrong').innerHTML = r.samples.map((s) => `<li><b>asked</b> <code>${esc(s.request)}</code><br><b>answered with the stored reply to</b> <code>${esc(s.cached)}</code><br>similarity ${s.score.toFixed(3)}, ${s.kind}</li>`).join('')
  drawChart()
  live()
  document.querySelectorAll('#mode .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === state.mode)))
}

// where the guard stops working: the words stream, at each cache's own chosen threshold
const stat = (n: string, what: string, hot = false) => `<div class="stat"><div class="n${hot ? ' hot' : ''}">${n}</div><div class="what">${what}</div></div>`
el('words').innerHTML = (['plain', 'digits', 'names'] as Mode[]).map((mode) => stat(fmt(w[mode].wrong), `wrong answers, ${LABEL[mode]}, at ${w[mode].tau.toFixed(2)}`, mode === 'digits')).join('')
el('words-ex').innerHTML = [...w.digits.samples.slice(0, 2), ...w.names.samples.slice(0, 1)].map((s, i) => `<li><span class="mono who">${i < 2 ? LABEL.digits : LABEL.names}</span><b>asked</b> <code>${esc(s.request)}</code><br><b>answered with the stored reply to</b> <code>${esc(s.cached)}</code></li>`).join('')
el('words-note').textContent = `${fmt(m.streams.words.requests)} requests, every one about a product or a country. Given the shop's own ${m.catalog} names, the guard turns the swaps back into misses. What remains is a different question about the same product, and names the customer misspelled: a guard cannot compare an entity nobody told it about.`

// the box: one answered request per question, the same cache and guards as the measurement
const STORED = [...INTENTS, ...WORD_INTENTS].map((it) => ({ id: it.id, text: it.ask[0].replace('{n}', '1042').replace('{p}', 'blue kettle').replace('{c}', 'germany') }))
function live() {
  const cache = new SemanticCache<string>(state.tau, GUARD[state.mode])
  for (const s of STORED) cache.insert(s.text, s.id)
  const l = cache.lookup(el<HTMLInputElement>('q').value)
  const box = el('live')
  box.className = 'verdict ' + (l.hit ? 'hit' : l.vetoed ? 'back' : 'miss')
  const tag = l.hit ? 'HIT: THE STORED ANSWER IS SERVED' : l.vetoed ? 'MISS, TURNED BACK BY THE GUARD' : 'MISS: THE MODEL IS ASKED'
  box.innerHTML = `<span class="tag">${tag}</span><p>${l.hit ? 'Served: the stored answer to' : 'Nearest stored request:'} <code>${esc((l.hit ? l.entry : l.nearest)?.text ?? 'none')}</code></p><p>Similarity ${l.nearestScore < 0 ? 'none' : l.nearestScore.toFixed(3)} against a threshold of ${state.tau.toFixed(2)}, ${LABEL[state.mode]}.</p>` + (l.vetoed ? '<p>It was close enough, but it names something different, so the model is asked.</p>' : '')
}
const ASK = ['where is my order 1043', 'how much is the red kettle', 'do you ship to cyprus', 'where is my refund for order 1042']
ASK.forEach((q) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'chip'
  b.textContent = q
  b.addEventListener('click', () => { el<HTMLInputElement>('q').value = q; live() })
  el('ask').append(b)
})

el<HTMLInputElement>('tau').value = String(state.tau)
el<HTMLInputElement>('tau').addEventListener('input', (e) => { state.tau = Number((e.target as HTMLInputElement).value); render() })
el('mode').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('[data-mode]')
  if (b) { state.mode = b.getAttribute('data-mode') as Mode; render() }
})
el<HTMLInputElement>('q').addEventListener('input', live)

el('failures').innerHTML = [
  ['Zero on a stream is not zero', `The calibration stream showed no wrong answer at ${t.digits.tau.toFixed(2)} and the stream measured here showed ${fmt(t.digits.wrong)}: a different question about the same order. Choosing and reporting on one stream would have printed a zero.`],
  ['The requests are templated', `${m.intents} questions, each asked in 3 to 6 ways with greetings, typos and capitals added. Real traffic has more ways to ask, so the ceiling of ${pct(m.test.ceiling.billCut)} is higher here than a real log would give. Take the shape of the curves, not the percentages.`],
  ['The embedder is not a neural model', 'It is hashed character and word n-grams, so it runs in a tab and the repository has no dependencies. A neural embedder separates paraphrases better and would move every number. The cache, the threshold and the guard are unchanged by swapping it.'],
  ['The prices are assumptions', `$${m.assume.inPerM} in and $${m.assume.outPerM} out per million tokens, with the token counts of each answer written beside the questions. A wrong answer is counted as a saving here; a customer who has to ask again costs more than that.`],
].map(([h, p]) => `<div class="fail"><h3>${h}</h3><p>${p}</p></div>`).join('')

render()
