import { normalizeVoiceChannels } from './voiceGain';
import { isWeb } from './platform';

/**
 * Browser-safe Media & Audio Adapter for PlayBot Expo Web.
 *
 * Rules:
 * 1. NEVER access `window`, `navigator`, `AudioContext`, or `MediaRecorder` at module evaluation time.
 * 2. Feature-detect only lazily inside methods upon explicit user gestures.
 * 3. On native platforms or during static export (SSR), all methods safely no-op or return supported: false.
 */

let webAudioCtx: AudioContext | null = null;

export function isWebAudioSupported(): boolean {
  if (!isWeb || typeof window === 'undefined') return false;
  return typeof (window.AudioContext || (window as any).webkitAudioContext) !== 'undefined';
}

export function isWebMediaRecorderSupported(): boolean {
  if (!isWeb || typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof (window as any).MediaRecorder !== 'undefined'
  );
}

export function revokeWebAudioUrl(url?: string | null): void {
  if (!isWeb || typeof window === 'undefined' || !url) return;
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    try {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    } catch {}
  }
}

export function getWebAudioContext(): AudioContext | null {
  if (!isWebAudioSupported()) return null;
  try {
    if (!webAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      webAudioCtx = new AudioCtx();
    }
    if (webAudioCtx && webAudioCtx.state === 'suspended') {
      webAudioCtx.resume().catch(() => {});
    }
    return webAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Synthesizes a clean sine wave tone for Sound Match on web.
 */
export function playWebTone(frequency: number, durationSeconds = 1.2): { stop: () => void } {
  const ctx = getWebAudioContext();
  if (!ctx) return { stop: () => {} };

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Smooth envelope to avoid speaker clicks
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSeconds);

    return {
      stop: () => {
        try {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
        } catch {}
      },
    };
  } catch {
    return { stop: () => {} };
  }
}

/**
 * Synthesizes a crisp metronome tick for Drum Challenge on web.
 */
export function playWebTick(isAccent = false): void {
  const ctx = getWebAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isAccent ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, ctx.currentTime);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch {}
}

/**
 * Synthesizes a deep drum hit sound on user tap for Drum Challenge on web.
 */
export function playWebDrumHit(): void {
  const ctx = getWebAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch {}
}

/**
 * Converts an AudioBuffer to standard 16-bit PCM Mono/Stereo WAV Blob.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const wavSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(wavSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk
  writeString(0, 'RIFF');
  view.setUint32(4, wavSize - 8, true);
  writeString(8, 'WAVE');

  // fmt Subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample

  // data Subchunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave and write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = buffer.getChannelData(channel)[i];
      // Clamp sample to [-1, 1]
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Web Audio Recorder for Reverse Singing game.
 */
export class WebAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private activeSource: AudioBufferSourceNode | null = null;
  private createdUrls: Set<string> = new Set();

  public originalBuffer: AudioBuffer | null = null;
  public reversedBuffer: AudioBuffer | null = null;

  async start(): Promise<void> {
    if (!isWebMediaRecorderSupported()) {
      throw new Error('Microphone recording is not supported in this browser.');
    }

    this.chunks = [];
    this.originalBuffer = null;
    this.reversedBuffer = null;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const MR = (typeof window !== 'undefined' ? (window as any).MediaRecorder : (globalThis as any).MediaRecorder);
      const options = MR?.isTypeSupported?.('audio/webm')
        ? { mimeType: 'audio/webm' }
        : MR?.isTypeSupported?.('audio/mp4')
          ? { mimeType: 'audio/mp4' }
          : undefined;

      const recorder = new MR(this.stream, options);
      recorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      recorder.start(100);
      this.mediaRecorder = recorder;
    } catch (err: any) {
      this.cleanup();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission denied. Please allow microphone access in your browser settings.');
      }
      throw err;
    }
  }

  async stop(): Promise<{
    durationMs: number;
    originalWavUri: string;
    reversedWavUri: string;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.cleanup();
        reject(new Error('Recorder is not active.'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const rawBlob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
          const arrayBuffer = await rawBlob.arrayBuffer();

          const ctx = getWebAudioContext();
          if (!ctx) throw new Error('AudioContext unavailable.');

          // Decode audio data to AudioBuffer
          const decoded = await ctx.decodeAudioData(arrayBuffer);
          normalizeVoiceChannels(Array.from({ length: decoded.numberOfChannels }, (_, c) => decoded.getChannelData(c)), decoded.sampleRate);
          this.originalBuffer = decoded;

          // Create reversed clone
          const reversed = ctx.createBuffer(
            decoded.numberOfChannels,
            decoded.length,
            decoded.sampleRate
          );

          for (let c = 0; c < decoded.numberOfChannels; c++) {
            const srcData = decoded.getChannelData(c);
            const dstData = reversed.getChannelData(c);
            for (let i = 0; i < srcData.length; i++) {
              dstData[i] = srcData[srcData.length - 1 - i];
            }
          }
          this.reversedBuffer = reversed;

          const originalBlob = audioBufferToWavBlob(decoded);
          const reversedBlob = audioBufferToWavBlob(reversed);

          const originalWavUri = URL.createObjectURL(originalBlob);
          const reversedWavUri = URL.createObjectURL(reversedBlob);
          this.createdUrls.add(originalWavUri);
          this.createdUrls.add(reversedWavUri);

          const durationMs = Math.round(decoded.duration * 1000);

          this.cleanup();
          resolve({ durationMs, originalWavUri, reversedWavUri });
        } catch (e) {
          this.cleanup();
          reject(e);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  playBuffer(buffer: AudioBuffer | null, onEnded?: () => void): { stop: () => void } {
    this.stopPlayback();
    if (!buffer) return { stop: () => {} };

    const ctx = getWebAudioContext();
    if (!ctx) return { stop: () => {} };

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        this.activeSource = null;
        if (onEnded) onEnded();
      };
      this.activeSource = source;
      source.start();

      return {
        stop: () => this.stopPlayback(),
      };
    } catch {
      return { stop: () => {} };
    }
  }

  stopPlayback(): void {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {}
      this.activeSource = null;
    }
  }

  revokeUrl(url?: string | null): void {
    if (!url) return;
    revokeWebAudioUrl(url);
    this.createdUrls.delete(url);
  }

  revokeAllCreatedUrls(): void {
    for (const url of this.createdUrls) {
      revokeWebAudioUrl(url);
    }
    this.createdUrls.clear();
  }

  cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.stopPlayback();
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
