import { Audio, AVPlaybackSource } from 'expo-av';
import { useSettingsStore } from '@/src/store/useSettingsStore';

/**
 * AudioManager — Centralized sound effects service.
 * Preloads and caches Audio.Sound objects for instant playback.
 * Respects the sound toggle from useSettingsStore.
 *
 * Usage:
 *   await AudioManager.init();          // call once at app start
 *   AudioManager.play('tileFlip');      // fire-and-forget
 */

// Sound effect definitions with programmatic generation fallback
// Since we don't have actual .mp3 files, we use expo-av's tone generation approach.
// When actual audio files are added to /assets/sounds/, swap the require() calls below.

type SoundId =
  | 'tileFlip'
  | 'match'
  | 'wrong'
  | 'countdown'
  | 'countdownFinal'
  | 'success'
  | 'fail'
  | 'bottleSpin'
  | 'buttonTap'
  | 'phaseChange'
  | 'scoreUp'
  | 'gameOver'
  | 'wheelSpin'
  | 'wheelWin';

interface CachedSound {
  sound: Audio.Sound;
  loaded: boolean;
}

class _AudioManager {
  private cache: Map<string, CachedSound> = new Map();
  private initialized = false;

  /** Initialize audio session — call once */
  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      this.initialized = true;
    } catch (e) {
      console.warn('AudioManager: Failed to initialize', e);
    }
  }

  /** Preload a sound from a module source */
  async preload(id: SoundId, source: AVPlaybackSource): Promise<void> {
    if (this.cache.has(id)) return;
    try {
      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: false });
      this.cache.set(id, { sound, loaded: true });
    } catch (e) {
      console.warn(`AudioManager: Failed to preload '${id}'`, e);
    }
  }

  /** Play a preloaded sound (fire-and-forget) */
  async play(id: SoundId, volume: number = 1.0): Promise<void> {
    if (!useSettingsStore.getState().isSoundEnabled) return;

    const cached = this.cache.get(id);
    if (!cached?.loaded) return;

    try {
      await cached.sound.setPositionAsync(0);
      await cached.sound.setVolumeAsync(volume);
      await cached.sound.playAsync();
    } catch (e) {
      // Sound might have been unloaded, try to recover
      console.warn(`AudioManager: Play failed for '${id}'`, e);
    }
  }

  /** Play a one-shot sound without preloading (for rare sounds) */
  async playOneShot(source: AVPlaybackSource, volume: number = 1.0): Promise<void> {
    if (!useSettingsStore.getState().isSoundEnabled) return;

    try {
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        volume,
      });
      // Auto-unload when done
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (e) {
      console.warn('AudioManager: OneShot failed', e);
    }
  }

  /** Unload all cached sounds */
  async unloadAll(): Promise<void> {
    for (const [id, cached] of this.cache) {
      try {
        await cached.sound.unloadAsync();
      } catch (e) {
        // ignore
      }
    }
    this.cache.clear();
  }

  /** Check if a sound is preloaded */
  isLoaded(id: SoundId): boolean {
    return this.cache.get(id)?.loaded ?? false;
  }
}

export const AudioManager = new _AudioManager();
export type { SoundId };
