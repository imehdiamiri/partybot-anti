import { shuffled } from './shuffle';

interface Identified { id: string }
interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}

/** A fresh fair shuffle, excluding the previous opener when alternatives exist. */
export function shuffleCardDeck<T extends Identified>(cards: readonly T[], previous = '', random = Math.random): T[] {
  const result = shuffled(cards, random);
  if (result.length > 1 && result[0].id === previous) {
    const index = 1 + Math.floor(random() * (result.length - 1));
    [result[0], result[index]] = [result[index], result[0]];
  }
  return result;
}

/** Persist only the last opener, not private custom-card text. Serialize rapid opens. */
export class CardDeckPicker {
  private last = new Map<string, string>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: Storage, private random = Math.random) {}

  open<T extends Identified>(key: string, cards: readonly T[], avoid?: string): Promise<T[]> {
    const task = this.queue.then(async () => {
      const storageKey = `cards-opener-v1:${key}`;
      let previous = this.last.get(key) || '';
      if (!this.last.has(key)) {
        try { previous = await this.storage.getItem(storageKey) || ''; } catch { /* Storage is optional. */ }
      }
      const result = shuffleCardDeck(cards, avoid || previous, this.random);
      if (result[0]) {
        this.last.set(key, result[0].id);
        try { await this.storage.setItem(storageKey, result[0].id); } catch { /* Retain in-memory history. */ }
      }
      return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
