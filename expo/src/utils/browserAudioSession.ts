/** Opt in only where supported (notably Safari). Capture and playback use
 * different system output levels; release capture mode before replaying a take.
 * https://bugs.webkit.org/show_bug.cgi?id=236219#c10
 */
export function setBrowserAudioSession(type: 'playback' | 'play-and-record'): void {
  if (typeof navigator === 'undefined') return;
  try {
    const session = (navigator as Navigator & {
      audioSession?: { type: string };
    }).audioSession;
    if (session && session.type !== type) session.type = type;
  } catch {
    // An unsupported/read-only session must not block recording or playback.
  }
}
