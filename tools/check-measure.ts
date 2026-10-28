/**
 * Replays every stream again and holds the result to the committed measurement,
 * then holds the facts the headline stands on, which are not allowed to be a
 * matter of a number in a file:
 *
 * - the streams are the committed ones, by hash;
 * - on the stream the thresholds were not chosen on, the guard on numbers cuts
 *   more of the bill than similarity alone, each at its own chosen threshold;
 * - similarity alone at 0.80 really does serve another order's answer there,
 *   so the near miss the guard exists for is in the data;
 * - on the questions about products and countries, the guard on numbers really
 *   does fail, and the guard given the shop's names really does fail less.
 *
 * If any of these flips, the README's argument is false even if every number in
 * it still matches the file.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { measure, load, choose } from './measure.ts'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const fail: string[] = []

for (const line of readFileSync(here('../data/streams.sha256'), 'utf8').trim().split('\n')) {
  const [want, file] = line.split(/\s+/)
  const got = createHash('sha256').update(readFileSync(here(`../data/${file}`), 'utf8')).digest('hex')
  if (got !== want) fail.push(`data/${file} does not match data/streams.sha256: run \`npm run build:streams\``)
}

const now = measure()
const stored = JSON.parse(readFileSync(here('../src/generated/measure.json'), 'utf8'))
if (JSON.stringify(now) !== JSON.stringify(stored)) fail.push('src/generated/measure.json is stale: run `npm run measure` and read the diff')

// the method the README states, checked apart from the code that follows it: choosing on any other stream would
// still match a regenerated file, so the thresholds are chosen again here, on the calibration stream
if (JSON.stringify(choose(load('calibrate.json'))) !== JSON.stringify(now.chosen)) fail.push('the thresholds in the measurement are not the ones the calibration stream chooses')

const t = now.test.atChosen, w = now.words.atChosen
if (t.digits.billCut <= t.plain.billCut) fail.push(`on the test stream the guard on numbers cuts ${t.digits.billCut} and similarity alone ${t.plain.billCut}: the guard no longer pays for itself`)
if (now.test.at080.plain.wrong < 20) fail.push(`similarity alone serves only ${now.test.at080.plain.wrong} wrong answers at 0.80: the stream no longer shows the near miss`)
if (w.digits.wrong < 100) fail.push(`the guard on numbers serves only ${w.digits.wrong} wrong answers on product and country questions: the published failure is no longer there`)
if (w.names.wrong >= w.digits.wrong) fail.push(`given the shop's names, the guard serves ${w.names.wrong} wrong answers against ${w.digits.wrong} without them: the names do not help`)
for (const mode of ['plain', 'digits', 'names'] as const) if (now.chosen[mode].tau !== t[mode].tau || now.chosen[mode].tau !== w[mode].tau) fail.push(`${mode}: the test and words streams were not measured at the threshold chosen on the calibration stream`)

if (fail.length) { console.error(fail.map((f) => 'FAIL ' + f).join('\n')); process.exit(1) }
const p = (x: number) => (x * 100).toFixed(1) + '%'
console.log(`check:measure ok: chosen on calibrate, measured on test: plain ${p(t.plain.billCut)} with ${t.plain.wrong} wrong, numbers ${p(t.digits.billCut)} with ${t.digits.wrong} wrong; on product and country questions, numbers serve ${w.digits.wrong} wrong and numbers and names ${w.names.wrong}`)
