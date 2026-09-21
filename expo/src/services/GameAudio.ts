import {
  createAudioPlayer, setAudioModeAsync as setMode, requestRecordingPermissionsAsync,
  AudioModule, type AudioSource, type AudioPlayer, type AudioStatus, type AudioMode,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { pcm16ToWav } from '../utils/pcmWav';
import { normalizeVoiceWav } from '../utils/voiceGain';

// Small compatibility boundary for the existing game sessions. All native audio is
// now implemented by expo-audio; no expo-av module is loaded in Expo Go.
export type AVPlaybackSource = AudioSource;
type PlaybackStatus = { isLoaded: boolean; didJustFinish: boolean; positionMillis: number };
const statusOf = (s: AudioStatus): PlaybackStatus => ({
  isLoaded: s.isLoaded, didJustFinish: s.didJustFinish, positionMillis: s.currentTime * 1000,
});

export namespace Audio {
  export const requestPermissionsAsync = requestRecordingPermissionsAsync;
  export const PitchCorrectionQuality = { High: 'high' } as const;
  export async function setAudioModeAsync(options: {
    playsInSilentModeIOS?: boolean; staysActiveInBackground?: boolean;
    shouldDuckAndroid?: boolean; playThroughEarpieceAndroid?: boolean; allowsRecordingIOS?: boolean;
  }) {
    const mode: Partial<AudioMode> = {};
    if (options.playsInSilentModeIOS !== undefined) mode.playsInSilentMode = options.playsInSilentModeIOS;
    if (options.staysActiveInBackground !== undefined) mode.shouldPlayInBackground = options.staysActiveInBackground;
    if (options.shouldDuckAndroid !== undefined) mode.interruptionMode = options.shouldDuckAndroid ? 'duckOthers' : 'mixWithOthers';
    if (options.playThroughEarpieceAndroid !== undefined) mode.shouldRouteThroughEarpiece = options.playThroughEarpieceAndroid;
    if (options.allowsRecordingIOS !== undefined) mode.allowsRecording = options.allowsRecordingIOS;
    await setMode(mode);
  }

  export class Sound {
    private subscription?: { remove(): void };
    private released = false;
    private constructor(private player: AudioPlayer) {}

    static async createAsync(source: AudioSource, initial: { shouldPlay?: boolean; volume?: number } = {}) {
      const player = createAudioPlayer(source, { updateInterval: 50 });
      const sound = new Sound(player);
      try {
        if (!player.isLoaded) {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => { subscription.remove(); reject(new Error('Audio load timed out')); }, 15000);
            const subscription = player.addListener('playbackStatusUpdate', (status) => {
              if (!status.isLoaded && !status.error) return;
              clearTimeout(timer);
              subscription.remove();
              if (status.error) reject(new Error(status.error)); else resolve();
            });
            if (player.isLoaded) { clearTimeout(timer); subscription.remove(); resolve(); }
          });
        }
        player.volume = initial.volume ?? 1;
        if (initial.shouldPlay) player.play();
        return { sound };
      } catch (error) { await sound.unloadAsync(); throw error; }
    }
    setOnPlaybackStatusUpdate(callback: (status: PlaybackStatus) => void) {
      this.subscription?.remove();
      if (this.released) return;
      this.subscription = this.player.addListener('playbackStatusUpdate', status => callback(statusOf(status)));
    }
    async getStatusAsync() { return this.released ? { isLoaded: false, didJustFinish: false, positionMillis: 0 } : statusOf(this.player.currentStatus); }
    async playAsync() { if (!this.released) this.player.play(); }
    async stopAsync() { if (!this.released) { this.player.pause(); await this.player.seekTo(0); } }
    async setPositionAsync(ms: number) { if (!this.released) await this.player.seekTo(ms / 1000); }
    async setVolumeAsync(volume: number) { if (!this.released) this.player.volume = volume; }
    async setRateAsync(rate: number, correctPitch: boolean, quality: 'low' | 'medium' | 'high' = 'high') {
      if (this.released) return;
      this.player.shouldCorrectPitch = correctPitch;
      this.player.setPlaybackRate(rate, quality);
    }
    async unloadAsync() {
      if (this.released) return;
      this.released = true;
      this.subscription?.remove();
      try { this.player.pause(); } finally { this.player.remove(); }
    }
  }

  // Reverse Singing needs genuine PCM, not compressed audio renamed to .wav.
  // Capture bounded int16 buffers on BOTH platforms and persist a valid WAV.
  export class Recording {
    private stream = new AudioModule.AudioStream({ sampleRate: 44100, channels: 1, encoding: 'int16' });
    private chunks: Uint8Array[] = [];
    private sampleRate = 44100;
    private channels = 1;
    private byteCount = 0;
    private uri: string | null = null;
    private stopPromise?: Promise<void>;
    private subscription?: { remove(): void };
    private limitTimer?: ReturnType<typeof setTimeout>;
    static async createAsync(_options?: unknown) {
      const recording = new Recording();
      recording.subscription = recording.stream.addListener('audioStreamBuffer', buffer => {
        const cap = buffer.sampleRate * buffer.channels * 2 * 61;
        if (recording.byteCount + buffer.data.byteLength > cap) return;
        recording.sampleRate = buffer.sampleRate;
        recording.channels = buffer.channels;
        const chunk = new Uint8Array(buffer.data).slice();
        recording.chunks.push(chunk);
        recording.byteCount += chunk.byteLength;
      });
      try {
        await recording.stream.start();
        recording.limitTimer = setTimeout(() => { recording.stream.stop(); }, 61000);
        return { recording };
      } catch (error) { recording.subscription?.remove(); recording.stream.release(); throw error; }
    }
    stopAndUnloadAsync() {
      return this.stopPromise ??= this.finish();
    }
    private async finish() {
      clearTimeout(this.limitTimer);
      try {
        this.stream.stop();
        this.subscription?.remove();
        if (!this.byteCount) throw new Error('No microphone audio was captured');
        const wav = pcm16ToWav(this.chunks, this.sampleRate, this.channels);
        normalizeVoiceWav(wav);
        const file = new File(Paths.cache, `reverse-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
        file.write(wav);
        this.uri = file.uri;
      } finally { this.subscription?.remove(); this.stream.release(); this.chunks = []; }
    }
    getURI() { return this.uri; }
  }
}
