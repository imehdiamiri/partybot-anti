import { Audio, AVPlaybackSource } from './GameAudio';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { isWeb } from '@/src/utils/platform';
import { getWebAudioContext } from '@/src/utils/browserMediaAdapter';
import { synthesizeGameCue, GAME_SAMPLE_RATE } from './GameSoundDesign';

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
  private webBuffers = new Map<string, AudioBuffer>();
  private webNodes = new Set<AudioBufferSourceNode>();
  private lastCue = new Map<string, number>();
  private unsubscribe?: () => void;
  private visibilityHandler = () => { if (document.hidden) this.stopEffects(); };
  private stopEffects() {
    this.webNodes.forEach(node => { try { node.stop(); } catch {} });
    this.webNodes.clear();
    this.cache.forEach(({ sound }) => { void sound.stopAsync().catch(() => {}); });
  }

  /** Initialize audio session — call once */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubscribe = useSettingsStore.subscribe(state => {
      if (!state.isSoundEnabled) this.stopEffects();
    });
    if (isWeb) {
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibilityHandler);
      return;
    }
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      this.initialized = true;
    } catch (e) {
      console.warn('AudioManager: Failed to initialize', e);
    }
  }

  /** Preload a sound from a module source */
  async preload(id: SoundId, source: AVPlaybackSource): Promise<void> {
    if (isWeb || this.cache.has(id)) return;
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
    const now = Date.now();
    if (now - (this.lastCue.get(id) ?? -Infinity) < 45) return;
    this.lastCue.set(id, now);
    if (isWeb) {
      if (typeof document === 'undefined' || document.hidden) return;
      try {
        const ctx = getWebAudioContext();
        if (!ctx) return;
        let buffer = this.webBuffers.get(id);
        if (!buffer) {
          const pcm = synthesizeGameCue(id);
          buffer = ctx.createBuffer(1, pcm.length, GAME_SAMPLE_RATE);
          buffer.getChannelData(0).set(pcm);
          this.webBuffers.set(id, buffer);
        }
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffer;
        gain.gain.value = Math.max(0, Math.min(1, volume)) * 0.35;
        source.connect(gain).connect(ctx.destination);
        this.webNodes.add(source);
        source.onended = () => { this.webNodes.delete(source); source.disconnect(); gain.disconnect(); };
        source.start();
      } catch { /* Effects never block gameplay. */ }
      return;
    }

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
    if (isWeb || !useSettingsStore.getState().isSoundEnabled) return;

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
    this.unsubscribe?.();
    this.initialized = false;
    if (isWeb && typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.stopEffects();
    if (isWeb) {
      this.webNodes.forEach(node => { try { node.stop(); } catch {} });
      this.webNodes.clear();
      this.webBuffers.clear();
      return;
    }
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
