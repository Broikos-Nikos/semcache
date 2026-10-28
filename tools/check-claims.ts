/**
 * Every figure the README and the page's meta tags quote is held to the
 * measurement. The sentences below are built from src/generated/measure.json and
 * must be found word for word, so a number typed into prose fails the build the
 * moment the measurement moves. The two wrong answers the README quotes must be
 * among the ones the measurement recorded, at the similarity it prints.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const m = JSON.parse(readFileSync(here('../src/generated/measure.json'), 'utf8'))
const readme = readFileSync(here('../README.md'), 'utf8')
const html = readFileSync(here('../index.html'), 'utf8')
const p1 = (x: number) => (x * 100).toFixed(1) + '%'
const f = (n: number) => n.toLocaleString('en-US')
const t = m.test.atChosen, w = m.words.atChosen, c = m.chosen

const headline = `An entity guard lets a semantic cache cut ${p1(t.digits.billCut)} of the bill instead of ${p1(t.plain.billCut)}, until the questions name a product or a country: then it serves ${f(w.digits.wrong)} wrong answers in ${f(m.streams.words.requests)}.`
const readmeClaims = [
  `### ${headline}`,
  `one stream of ${f(m.streams.calibrate.requests)} support requests`,
  `a second stream of ${f(m.streams.test.requests)} it was never chosen on`,
  `| threshold, chosen on the first stream | ${c.plain.tau.toFixed(2)} | ${c.digits.tau.toFixed(2)} | ${c.names.tau.toFixed(2)} |`,
  `| the bill | cuts ${p1(t.plain.billCut)} | cuts ${p1(t.digits.billCut)} | cuts ${p1(t.names.billCut)} |`,
  `| wrong answers | ${f(t.plain.wrong)} | ${f(t.digits.wrong)} | ${f(t.names.wrong)} |`,
  `| at the usual threshold of 0.80 | ${f(m.test.at080.plain.wrong)} wrong answers | ${f(m.test.at080.digits.wrong)} wrong answers | ${f(m.test.at080.names.wrong)} wrong answers |`,
  `the difference between ${p1(t.plain.billCut)} and ${p1(t.digits.billCut)} of the bill`,
  `drop from ${c.plain.tau.toFixed(2)} to ${c.digits.tau.toFixed(2)}`,
  `The ${f(t.digits.wrong)} wrong answers it does serve`,
  `is ${p1(m.test.ceiling.billCut)}, if every repeat`,
  `A third stream of ${f(m.streams.words.requests)} requests`,
  `| ${f(m.streams.words.requests)} questions about a product or a country | wrong answers |`,
  `| similarity only, at ${c.plain.tau.toFixed(2)} | ${f(w.plain.wrong)} |`,
  `| guard: numbers, at ${c.digits.tau.toFixed(2)} | **${f(w.digits.wrong)}** |`,
  `| guard: numbers and names, at ${c.names.tau.toFixed(2)} | ${f(w.names.wrong)} |`,
  `the shop's own ${f(m.catalog)} names`,
  `${f(w.names.wrong)} wrong answers remain`,
  `${f(m.intents)} questions asked in 3 to 6 ways each`,
  `$${m.assume.inPerM} in and $${m.assume.outPerM} out per million tokens`,
  // the rule of three: 3 / n is the 95% upper bound on a rate after zero events in n trials
  `below about ${(300 / m.streams.test.requests).toFixed(2)}% with 95 percent confidence`,
]
const quoted = (rows: { request: string; cached: string; score: number }[], ask: string, got: string, score?: string) =>
  rows.some((s) => s.request.toLowerCase().includes(ask) && s.cached.toLowerCase().includes(got) && (score === undefined || s.score.toFixed(3) === score))
const fails = [
  ...readmeClaims.filter((x) => !readme.includes(x)).map((x) => `README does not say: "${x}"`),
  ...(html.includes(headline.replace(/^An entity guard/, 'An entity guard')) ? [] : [`index.html does not carry the headline: "${headline}"`]),
]
if (!readme.includes('"where is my refund for order 1160" was answered with the stored reply to "where is my order 1160", at a similarity of 0.680') || !quoted(t.digits.samples, 'where is my refund for order 1160', 'where is my order 1160', '0.680'))
  fails.push('the refund example the README quotes is not one the measurement recorded, at that similarity')
if (!readme.includes('"how much is the pine desk" is answered with the stored price of the oak desk') || !quoted(w.digits.samples, 'how much is the pine desk', 'oak desk'))
  fails.push('the desk example the README quotes is not one the measurement recorded')
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]| -{1,2} `)
if (DASHES.test(readme.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, ''))) fails.push('README uses a dash as punctuation')
if (fails.length) { console.error(fails.map((x) => 'FAIL  ' + x).join('\n')); process.exit(1) }
console.log(`check:claims ok: ${readmeClaims.length} figures and 2 quoted wrong answers found in the README, the headline in index.html`)
