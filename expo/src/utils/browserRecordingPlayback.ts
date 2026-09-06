import { getWebAudioContext } from './browserMediaAdapter';

/** Recording playback uses the PCM buffers already decoded at Stop.
 * It does not depend on a detached HTMLAudioElement accepting a blob URL.
 * Keep each take separately: starting the mimic must not replace the source.
 */
export class BrowserRecordingPlayback {
  private buffers = new Map<string, AudioBuffer>();
  private source: AudioBufferSourceNode | null = null;
  private generation = 0;
  constructor(private getContext: () => AudioContext | null = getWebAudioContext) {}

  remember(uri: string, buffer: AudioBuffer | null) {
    if (buffer) this.buffers.set(uri, buffer);
  }
  forget(uri: string) { this.buffers.delete(uri); }

  async play(uri: string, rate = 1, onEnded?: () => void): Promise<boolean> {
    this.stop();
    const generation = this.generation;
    const ctx = this.getContext();
    if (!ctx) throw new Error('Audio playback is not available in this browser.');
    // Called directly from the Play gesture, before any fetch/decode await (Safari).
    if (ctx.state === 'suspended') await ctx.resume();
    if (generation !== this.generation) return false;
    let buffer = this.buffers.get(uri);
    if (!buffer) {
      const response = await fetch(uri);
      if (!response.ok) throw new Error('The recording could not be loaded. Please try recording again.');
      buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      if (generation !== this.generation) return false;
      this.buffers.set(uri, buffer);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(ctx.destination);
    source.onended = () => {
      if (this.source !== source) return;
      source.disconnect();
      this.source = null;
      onEnded?.();
    };
    this.source = source;
    try { source.start(); }
    catch (error) { this.stop(); throw error; }
    return true;
  }
  stop() {
    this.generation++;
    if (this.source) {
      this.source.onended = null;
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
    }
  }
  clear() { this.stop(); this.buffers.clear(); }
}
