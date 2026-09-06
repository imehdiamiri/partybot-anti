import { Colors } from '@/src/theme/Colors';
/**
 * Short action steps for every game. The separator creates numbered guide rows.
 */
export const GAME_HINTS: Record<string, { icon: string; title: string; tip: string; accent: string }> = {
  reverse_singing: {
    icon: 'waveform.circle.fill',
    title: 'How Reverse Singing Works',
    tip: 'Player 1: record a short song or phrase. | Play it reversed. Player 2 records a mimic of that sound. | Play the mimic reversed to hear the result. Retry resets both takes.',
    accent: '#FF2D55',
  },
  guess_the_seconds: {
    icon: 'timer',
    title: 'Guess the Seconds',
    tip: 'Choose a target number of seconds. | Tap Start, then count in your head without a clock. | Tap Stop when time feels right. Closest to the target wins.',
    accent: Colors.orange,
  },
  imposter: {
    icon: 'theatermasks.fill',
    title: 'How to Play Imposter',
    tip: 'Read your secret role without showing anyone. | Give clues about the word; the Imposter tries to blend in. | Discuss and vote for the player you suspect.',
    accent: '#AF52DE',
  },
  pass_guess: {
    icon: 'bubble.left.and.bubble.right.fill',
    title: 'Pass & Guess',
    tip: 'Choose a mode and question. | Each player privately enters an answer, then passes the phone. | Match the anonymous answers to their authors. Correct guesses earn points.',
    accent: '#007AFF',
  },
  memory_grid: {
    icon: 'square.grid.3x3.fill',
    title: 'Memory Grid',
    tip: 'Tap two tiles to reveal their pictures. | Remember their positions and find every matching pair. | Complete the board as quickly as you can.',
    accent: '#5AC8FA',
  },
  memory_path: {
    icon: 'map.fill',
    title: 'Memory Path',
    tip: 'Find the hidden path from Start to End. | Tap the next tile; a wrong step sends you back to Start. | Remember your discoveries and finish quickly. Turn-based mode limits your tries.',
    accent: '#00C7BE',
  },
  tap_in_order: {
    icon: 'hand.tap.fill',
    title: 'Tap In Order',
    tip: 'Look at the numbered tiles and remember their positions. | Tap them in ascending order: 1, 2, 3… | Complete the sequence as quickly and accurately as you can.',
    accent: Colors.orange,
  },
  ten_tangle: {
    icon: 'number.circle.fill',
    title: 'How Ten Tangle Works',
    tip: 'Read your secret number from 1 to 10. | Act out the scenario with intensity matching your number. | The guesser tries to identify everyone’s number.',
    accent: Colors.yellow,
  },
  color_trap: {
    icon: 'paintpalette.fill',
    title: 'Color Trap Rules',
    tip: 'Remember the forbidden color shown before your turn. | Tap the other colored circles before they disappear. | Avoid the forbidden color. Misses and wrong taps reduce your score.',
    accent: Colors.red,
  },
  color_match: {
    icon: 'paintpalette.fill',
    title: 'Color Match',
    tip: 'Study the target color. | Recreate it from memory with the color controls. | Submit your match. The closest color earns the best score.',
    accent: Colors.green,
  },
  sound_match: {
    icon: 'music.note',
    title: 'Sound Match',
    tip: 'Play and memorize the target tone. | Adjust the pitch slider and listen to your tone. | Submit when it sounds like the target. Closest pitch wins.',
    accent: '#FF2D55',
  },
  spin_bottle: {
    icon: 'arrow.trianglehead.2.counterclockwise.rotate.90',
    title: 'Truth & Dare',
    tip: 'Spin the bottle to select a player. | Choose Truth or Dare and read the prompt. | Complete it, or use an available reroll, then spin again.',
    accent: '#FF2D55',
  },
  reaction_time: {
    icon: 'bolt.fill',
    title: 'How Reaction Time Works',
    tip: 'Get ready and wait while the screen is red. | Tap as soon as it turns green. | Don’t tap early! The quickest valid reaction wins.',
    accent: Colors.green,
  },
  eye_sight: {
    icon: 'eye.fill',
    title: 'How Eye Sight Works',
    tip: 'Watch the number flash and memorize every digit. | Type the same number, then press the checkmark. | Correct answers unlock harder rounds. One wrong answer ends your turn.',
    accent: '#5AC8FA',
  },
  draw_rush: {
    icon: 'pencil.tip.crop.circle',
    title: 'Draw & Rush',
    tip: 'Read your drawing prompt privately. | Draw it before time runs out while the others guess aloud. | Mark whether they guessed correctly, then pass the phone.',
    accent: '#007AFF',
  },
  drum_challenge: {
    icon: 'music.note',
    title: 'How Drum Challenge Works',
    tip: 'Listen to the music and follow the build-up. | Anticipate the drum hit and tap at that exact moment. | Smaller timing errors earn a better result.',
    accent: '#FF2E93',
  },
};
