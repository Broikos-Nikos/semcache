/**
 * What makes two alike requests different questions.
 *
 * A semantic cache serves a stored answer when a new request is close enough to
 * an old one, and "where is order 1042" is as close to "where is order 1043" as
 * two sentences get. The guard in `cache.ts` compares what this file extracts
 * from both, and refuses the hit when it differs.
 *
 * The first version knew one kind of entity, a run of digits, because the only
 * thing the measured stream ever named was an order number. That is the whole
 * reason it looked safe: ask about the red kettle after the blue kettle and the
 * digits are the same (none), so the guard waves the wrong answer through. The
 * second extractor adds the names the shop already has, its products and the
 * countries it ships to. It only knows the names it was given.
 */

/** A function from a request to the things in it that change the answer, as one comparable string. */
export type Entities = (text: string) => string

/** Every run of digits: the order numbers, amounts and ids. */
export const digits: Entities = (text) => (text.match(/\d+/g) ?? []).join(',')

/** Digits, plus every name from a list that appears as whole words, in a stable order. */
export function digitsAndNames(names: string[]): Entities {
  const patterns = names.map((n) => ({ n, re: new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`) }))
  return (text) => {
    const t = text.toLowerCase()
    const found = patterns.filter((p) => p.re.test(t)).map((p) => p.n).sort()
    return `${digits(text)}|${found.join(',')}`
  }
}
