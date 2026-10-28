/**
 * A text embedder with no model in it: signed, hashed character and word
 * n-grams, L2 normalised, as a sparse vector. Deterministic, a few lines, and
 * runs in a browser tab.
 *
 * It is deliberately not a neural embedder. What this project measures is the
 * cache around the embedder: the threshold, the wrong answers it serves, and
 * the guard that removes the commonest kind. Swap `embed` for a real model and
 * the rest is unchanged, but the numbers would move, and the README says so.
 */

export type Vec = { idx: Int32Array; val: Float32Array }

const DIM = 2048

function fnv(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

/** What a request is made of: padded character 3 to 5-grams of each word, the words, and the word pairs. */
export function features(text: string): Map<string, number> {
  const words = text.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  const f = new Map<string, number>()
  const bump = (k: string, w: number) => f.set(k, (f.get(k) ?? 0) + w)
  for (const w of words) {
    const p = `^${w}$`
    for (let n = 3; n <= 5; n++) for (let i = 0; i + n <= p.length; i++) bump('c' + p.slice(i, i + n), 1)
    bump('w' + w, 2)
  }
  for (let i = 0; i + 1 < words.length; i++) bump(`b${words[i]} ${words[i + 1]}`, 2)
  return f
}

export function embed(text: string): Vec {
  const acc = new Map<number, number>()
  for (const [k, w] of features(text)) {
    const h = fnv(k)
    const slot = h % DIM
    const sign = (h >>> 16) & 1 ? 1 : -1
    acc.set(slot, (acc.get(slot) ?? 0) + sign * (1 + Math.log(w)))
  }
  const idx = [...acc.keys()].sort((a, b) => a - b)
  const val = idx.map((i) => acc.get(i)!)
  const norm = Math.sqrt(val.reduce((s, x) => s + x * x, 0)) || 1
  return { idx: Int32Array.from(idx), val: Float32Array.from(val.map((x) => x / norm)) }
}

export function cosine(a: Vec, b: Vec): number {
  let i = 0, j = 0, s = 0
  while (i < a.idx.length && j < b.idx.length) {
    if (a.idx[i] === b.idx[j]) s += a.val[i++] * b.val[j++]
    else if (a.idx[i] < b.idx[j]) i++
    else j++
  }
  return s
}

