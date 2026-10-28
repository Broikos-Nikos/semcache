/**
 * The cache. A request is embedded and compared with everything stored; the best
 * match at or above the threshold is a hit and its stored answer is served, and
 * anything else is a miss that the caller answers and stores.
 *
 * The guard is the one rule this project argues for, and the one it measures
 * failing: if the request and the stored one name different entities, it is not
 * a hit, however alike the sentences are. What counts as an entity is the
 * extractor passed in (`entities.ts`), and the guard is exactly as good as that.
 */
import { cosine, embed, type Vec } from './embed'
import type { Entities } from './entities'

export type Entry<T> = { text: string; vec: Vec; ents: string; value: T }
/** `nearest` is the closest stored request whatever the guard decided, for showing a reader what it was compared with. */
export type Lookup<T> = { hit: boolean; score: number; entry: Entry<T> | null; vetoed: boolean; nearest: Entry<T> | null; nearestScore: number }

export class SemanticCache<T> {
  readonly entries: Entry<T>[] = []
  /**
   * `guard` is null for similarity only. `similarity` defaults to the cosine of the two embeddings; the
   * measurement passes the same cosines precomputed once per stream, so every threshold replays the decision
   * below without recomputing them.
   */
  constructor(readonly threshold: number, readonly guard: Entities | null, readonly similarity: (e: Entry<T>, vec: Vec) => number = (e, vec) => cosine(vec, e.vec)) {}

  lookup(text: string, vec: Vec = embed(text)): Lookup<T> {
    const ents = this.guard ? this.guard(text) : ''
    let best: Entry<T> | null = null, score = -1, vetoed = false, nearest: Entry<T> | null = null, nearestScore = -1
    for (const e of this.entries) {
      const s = this.similarity(e, vec)
      if (s > nearestScore) { nearest = e; nearestScore = s }
      if (s <= score) continue
      if (this.guard && e.ents !== ents) { if (s >= this.threshold) vetoed = true; continue }
      best = e
      score = s
    }
    return { hit: !!best && score >= this.threshold, score, entry: best, vetoed, nearest, nearestScore }
  }

  insert(text: string, value: T, vec: Vec = embed(text)): void {
    this.entries.push({ text, vec, ents: this.guard ? this.guard(text) : '', value })
  }
}
