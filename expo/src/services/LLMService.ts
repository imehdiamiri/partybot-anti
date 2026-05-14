/**
 * LLMService — AI card generation via secure Firebase Cloud Function proxy.
 *
 * IMPORTANT: The Gemini API key is no longer shipped in the client bundle.
 * All AI requests go through the `generateCard` Cloud Function, which:
 *   - holds the API key as a secret
 *   - enforces per-user rate limiting and the FREE_DAILY_LIMIT
 *   - applies content moderation server-side
 *
 * Deploy the function from `functions/` with:
 *   firebase deploy --only functions:generateCard
 *
 * In dev, if the function is unavailable (not deployed / offline), we fall
 * back to a deterministic mock so the UI flow can still be exercised.
 */

import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { functions } from '../lib/firebase';

interface GenerateCardRequest {
  system: string;
  user: string;
}

interface GenerateCardResponse {
  text: string;
}

/** Strip markdown code fences from LLM output. */
export function stripCodeFences(text: string): string {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

/**
 * Always-true now (the proxy is the source of truth). Kept for call-site
 * compatibility — the Cloud Function decides whether the key is configured.
 */
export function isLLMConfigured(): boolean {
  return true;
}

/**
 * Complete a card-generation prompt via the secure Cloud Function.
 * Falls back to a mock response when the function is unreachable so dev
 * builds without deployed functions still produce visible output.
 */
export async function complete(system: string, user: string): Promise<string> {
  try {
    const fn = httpsCallable<GenerateCardRequest, GenerateCardResponse>(
      functions,
      'generateCard'
    );
    const result: HttpsCallableResult<GenerateCardResponse> = await fn({ system, user });
    if (!result.data?.text) throw new Error('Empty response from generateCard');
    return result.data.text;
  } catch (e: any) {
    if (__DEV__) {
      console.warn('LLMService: generateCard unavailable, using mock.', e?.message);
      return mockCompletion(user);
    }
    throw e;
  }
}

/** Deterministic fallback so the dev UX still works without deployed functions. */
function mockCompletion(userPrompt: string): Promise<string> {
  const mockCards: Record<string, string> = {
    act: '{"text":"Pretend you are a confused tourist asking for directions in sign language"}',
    talk: '{"text":"What is the most spontaneous thing you have ever done on a whim"}',
    challenges: '{"text":"Speak only in questions for the next two minutes without breaking"}',
    penalty: '{"text":"Do your most dramatic slow motion walk across the entire room"}',
    couple: '{"text":"What is the one thing you wish you could tell each other more often"}',
  };

  const lower = userPrompt.toLowerCase();
  let category: keyof typeof mockCards = 'talk';
  if (lower.includes('act')) category = 'act';
  else if (lower.includes('challenge')) category = 'challenges';
  else if (lower.includes('penalty')) category = 'penalty';
  else if (lower.includes('couple')) category = 'couple';

  return new Promise((resolve) => setTimeout(() => resolve(mockCards[category]), 600));
}
