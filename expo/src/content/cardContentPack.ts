import type { CardCategory, CardSubtype } from '../models/CardModels';

export interface CardContentPack {
  id: string;
  category: `${CardCategory}`;
  subtype: `${CardSubtype}`;
  prompts: string[];
}

/** Authored, offline content. IDs are append-only; never reorder published lines. */
export const pack = (id: string, category: CardContentPack['category'],
  subtype: CardContentPack['subtype'], lines: string): CardContentPack => ({
  id, category, subtype,
  prompts: lines.trim().split('\n').map(line => line.trim()).filter(Boolean),
});

