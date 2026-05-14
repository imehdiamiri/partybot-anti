import { Colors } from '@/src/theme/Colors';
/**
 * Game-specific first-time hints — shown once per game on first play.
 * Matches iOS firstTimeHint() usage across all game views.
 */
export const GAME_HINTS: Record<string, { icon: string; title: string; tip: string; accent: string }> = {
  reverse_singing: {
    icon: 'waveform.circle.fill',
    title: 'How Reverse Singing Works',
    tip: 'Record yourself singing, then listen to it reversed! The other player tries to mimic it.',
    accent: '#FF2D55',
  },
  guess_the_seconds: {
    icon: 'timer',
    title: 'Guess the Seconds',
    tip: 'A random number of seconds will appear. Close your eyes and tap when you think that many seconds have passed!',
    accent: Colors.orange,
  },
  imposter: {
    icon: 'theatermasks.fill',
    title: 'How to Play Imposter',
    tip: 'Everyone gets a secret word — except the Imposter! Discuss clues, then vote on who you think is faking it.',
    accent: '#AF52DE',
  },
  pass_guess: {
    icon: 'bubble.left.and.bubble.right.fill',
    title: 'Pass & Guess',
    tip: 'One player writes a prompt, then passes the phone. The other player tries to guess what was written!',
    accent: '#007AFF',
  },
  memory_grid: {
    icon: 'square.grid.3x3.fill',
    title: 'Memory Grid',
    tip: 'Flip tiles to find matching pairs. Try to memorize positions and finish as fast as possible!',
    accent: '#5AC8FA',
  },
  memory_path: {
    icon: 'map.fill',
    title: 'Memory Path',
    tip: 'A path will flash briefly — memorize it! Then trace the same path from start to end. Don\'t take wrong steps!',
    accent: '#00C7BE',
  },
  tap_in_order: {
    icon: 'hand.tap.fill',
    title: 'Tap In Order',
    tip: 'Numbers will appear on the grid briefly. Memorize their positions, then tap them in order from 1 upwards!',
    accent: Colors.orange,
  },
  ten_tangle: {
    icon: 'number.circle.fill',
    title: 'How Ten Tangle Works',
    tip: 'Each player gets a secret number (1–10). The guesser watches everyone act out a scenario and tries to guess each number!',
    accent: Colors.yellow,
  },
  color_trap: {
    icon: 'paintpalette.fill',
    title: 'Color Trap Rules',
    tip: 'Colored tiles fall down — tap all of them EXCEPT the forbidden color! 3 mistakes and you\'re eliminated.',
    accent: Colors.red,
  },
  spin_bottle: {
    icon: 'arrow.trianglehead.2.counterclockwise.rotate.90',
    title: 'Truth & Dare',
    tip: 'Spin the bottle to pick a player, then choose Truth or Dare. You get 2 rerolls if you don\'t like the prompt!',
    accent: '#FF2D55',
  },
  reaction_time: {
    icon: 'bolt.fill',
    title: 'How Reaction Time Works',
    tip: 'Wait for the screen to turn GREEN, then tap as fast as you can. Tap during RED and it\'s a foul!',
    accent: Colors.green,
  },
  eye_sight: {
    icon: 'eye.fill',
    title: 'How Eye Sight Works',
    tip: 'A number flashes for a split second. Memorize it and type it back exactly. Each correct round gets harder — one wrong answer ends your turn!',
    accent: '#5AC8FA',
  },
  draw_rush: {
    icon: 'pencil.tip.crop.circle',
    title: 'Draw & Rush',
    tip: 'Each player takes turns drawing a word in 60 seconds. Others guess what it is. The drawer judges the answers!',
    accent: '#007AFF',
  },
  drum_challenge: {
    icon: 'music.note',
    title: 'How Drum Challenge Works',
    tip: 'A music clip plays with a dramatic build-up. After a long pause, a drum beat drops — tap at the EXACT moment! Your accuracy is measured in milliseconds.',
    accent: '#FF2E93',
  },
};
