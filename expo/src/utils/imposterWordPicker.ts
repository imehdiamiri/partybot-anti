import { ALL_IMPOSTER_WORDS, imposterWords } from '../content/imposterWords';

interface History { counts: Record<string, number>; last: string }
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> }
export const IMPOSTER_HISTORY_KEY = 'imposter-word-history-v1';

/** Choose uniformly from the least-used words in the selected pool.
 * Counts are shared across topics, so "All topics" does not forget themed rounds.
 * Equal counts start a new random cycle; avoid repeating at a cycle boundary.
 */
export function selectImposterWord(pool: readonly string[], history: History, random = Math.random): string {
  if (!pool.length) throw new Error('Imposter requires a non-empty word bank');
  const min = Math.min(...pool.map(word => history.counts[word] ?? 0));
  let candidates = pool.filter(word => (history.counts[word] ?? 0) === min);
  if (candidates.length > 1) candidates = candidates.filter(word => word !== history.last);
  return candidates[Math.floor(random() * candidates.length)];
}

function parseHistory(raw: string | null): History {
  const clean: History = { counts: {}, last: '' };
  try {
    const data = JSON.parse(raw || '{}');
    if (data?.version !== 1) return clean;
    const known = new Set(ALL_IMPOSTER_WORDS);
    if (typeof data.last === 'string' && known.has(data.last)) clean.last = data.last;
    if (data.counts && typeof data.counts === 'object' && !Array.isArray(data.counts)) {
      for (const word of known) {
        const count = data.counts[word];
        if (Number.isSafeInteger(count) && count >= 0 && count < Number.MAX_SAFE_INTEGER - 1) clean.counts[word] = count;
      }
    }
  } catch { /* Old/corrupt storage must never prevent offline play. */ }
  return clean;
}

export class ImposterWordPicker {
  private history: History = { counts: {}, last: '' };
  private loaded?: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private storage: Storage, private random = Math.random) {}

  draw(category = 'random'): Promise<string> {
    const job = this.queue.then(async () => {
      this.loaded ??= this.storage.getItem(IMPOSTER_HISTORY_KEY)
        .then(raw => { this.history = parseHistory(raw); })
        .catch(() => { /* In-memory rotation remains available if storage is blocked. */ });
      await this.loaded;
      const word = selectImposterWord(imposterWords(category), this.history, this.random);
      this.history.counts[word] = (this.history.counts[word] ?? 0) + 1;
      this.history.last = word;
      try {
        await this.storage.setItem(IMPOSTER_HISTORY_KEY, JSON.stringify({ version: 1, ...this.history }));
      } catch { /* Private browsing/full storage: keep playing without losing this session's history. */ }
      return word;
    });
    this.queue = job.catch(() => undefined);
    return job;
  }
}

