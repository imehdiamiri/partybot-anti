import type { PartyCard } from '../models/CardModels';
import { ACT_EXPANSION } from './cardsAct';
import { CHALLENGE_EXPANSION } from './cardsChallenges';
import { PENALTY_EXPANSION } from './cardsPenalty';
import { COUPLE_EXPANSION } from './cardsCouple';
import { TALK_DISCOVERY } from './cardsTalkDiscovery';
import { TALK_REFLECTION } from './cardsTalkReflection';
import { TALK_DEBATE } from './cardsTalkDebate';
import { MLT_EXPANSION } from './cardsMostLikelyTo';

export const CARD_CONTENT_PACKS = [
  ...ACT_EXPANSION, ...CHALLENGE_EXPANSION, ...PENALTY_EXPANSION, ...COUPLE_EXPANSION,
  ...TALK_DISCOVERY, ...TALK_REFLECTION, ...TALK_DEBATE, ...MLT_EXPANSION,
];

export const EXPANSION_CARDS: PartyCard[] = CARD_CONTENT_PACKS.flatMap(pack =>
  pack.prompts.map((text, index) => ({
    id: `content-20260905-${pack.id}-${index + 1}`,
    category: pack.category as PartyCard['category'],
    subtype: pack.subtype as PartyCard['subtype'],
    text,
    isSpicy: false,
  }))
);

