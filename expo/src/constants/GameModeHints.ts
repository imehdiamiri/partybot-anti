import { GAME_HINTS } from './GameHints';

const MODE_HINTS: Record<string, Record<string, { title: string; tip: string }>> = {
  pass_guess: {
    classic: { title: 'Pass & Guess · Classic Q&A', tip: 'Read the shared question and write your answer privately. | Pass the phone so everyone can answer the same question. | Match each anonymous answer to its author. Correct matches earn points.' },
    whoSaidIt: { title: 'Pass & Guess · Who Said It?', tip: 'Privately write a fact, memory or story about yourself — there is no shared question. | Everyone adds a statement, then passes the phone. | Read the anonymous statements and guess who wrote each one.' },
  },
  imposter: {
    discussion: { title: 'Imposter · Discussion', tip: 'Read your secret role privately, then pass the phone. | Discuss the word together before the discussion timer ends. The Imposter tries to blend in. | Each player votes for a suspect. Reveal the votes and the Imposter.' },
    clue: { title: 'Imposter · Clue Mode', tip: 'Read your secret role privately. | In the displayed order, each player enters a clue without revealing the word. The Imposter must improvise. | After the clues, each player votes for the suspected Imposter.' },
  },
  memory_path: {
    timeRace: { title: 'Memory Path · Time Race', tip: 'Find the hidden route from Start to End. | Wrong steps return you to Start; remember the safe tiles and try again. | Finish as quickly as possible. Your completion time determines your result.' },
    turnBased: { title: 'Memory Path · Turn Based', tip: 'Discover the hidden route from Start to End. | A wrong step resets your position and uses one of your remaining tries. | Remember the path and finish before your tries run out; then pass the phone.' },
  },
  drum_challenge: {
    whitney: { title: 'Drum Challenge · Music Drop', tip: 'Listen to the music build-up. | Tap the drum once at the exact moment the drum hit should land. | Your result shows how early or late you tapped. Smaller error is better.' },
    metronome: { title: 'Drum Challenge · Metronome', tip: 'Listen to the selected rhythm and memorize the beat. | When the clicks stop, keep the same rhythm in your head. | Tap once on the next expected downbeat. Your timing error determines your result.' },
  },
  draw_rush: {
    preset: { title: 'Draw & Rush · Prompt', tip: 'Read the provided drawing prompt privately. | Draw the prompt before the timer ends; the other players guess aloud. | Mark whether they guessed correctly and pass to the next artist.' },
    freeDraw: { title: 'Draw & Rush · Free Draw', tip: 'Choose what you want to draw — no preset prompt is provided. | Draw it while the others guess aloud before time runs out. | Mark the result, then pass the phone to the next artist.' },
  },
};

export function getGameHint(gameId: string, config: Record<string, any> = {}, mode?: string) {
  const base = GAME_HINTS[gameId];
  const selected = mode ?? ({
    imposter: config.gameStyle ?? 'discussion', memory_path: config.gameMode ?? 'timeRace',
    drum_challenge: config.drumMode ?? 'whitney', draw_rush: config.conceptMode ?? 'preset',
    pass_guess: 'classic',
  } as Record<string, string>)[gameId];
  return { ...base, ...MODE_HINTS[gameId]?.[selected] };
}
