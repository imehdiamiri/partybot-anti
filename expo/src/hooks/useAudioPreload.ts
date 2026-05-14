/**
 * useAudioPreload — Hook to initialize AudioManager and preload game sounds.
 * Call once in the root layout.
 *
 * When actual .wav/.mp3 files are added to /assets/sounds/,
 * uncomment the preload calls below and remove the placeholder comment.
 */
import { useEffect } from 'react';
import { AudioManager } from '@/src/services/AudioManager';

export function useAudioPreload() {
  useEffect(() => {
    const init = async () => {
      await AudioManager.init();

      // ═══ Preload sounds ═══
      await AudioManager.preload('tileFlip', require('@/assets/sounds/tile_flip.wav'));
      await AudioManager.preload('match', require('@/assets/sounds/match.wav'));
      await AudioManager.preload('wrong', require('@/assets/sounds/wrong.wav'));
      await AudioManager.preload('countdown', require('@/assets/sounds/countdown.wav'));
      await AudioManager.preload('countdownFinal', require('@/assets/sounds/countdown_final.wav'));
      await AudioManager.preload('success', require('@/assets/sounds/success.wav'));
      await AudioManager.preload('fail', require('@/assets/sounds/fail.wav'));
      await AudioManager.preload('bottleSpin', require('@/assets/sounds/bottle_spin.wav'));
      await AudioManager.preload('buttonTap', require('@/assets/sounds/button_tap.wav'));
      await AudioManager.preload('phaseChange', require('@/assets/sounds/phase_change.wav'));
      await AudioManager.preload('scoreUp', require('@/assets/sounds/score_up.wav'));
      await AudioManager.preload('gameOver', require('@/assets/sounds/game_over.wav'));
      await AudioManager.preload('wheelSpin', require('@/assets/sounds/wheel_spin.wav'));
      await AudioManager.preload('wheelWin', require('@/assets/sounds/wheel_win.wav'));
    };

    init();

    return () => {
      AudioManager.unloadAll();
    };
  }, []);
}
