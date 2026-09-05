import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import { synthesizeToolCue, TOOL_SAMPLE_RATE, toolTickVolume, type ToolKind, type ToolCue } from './ToolSoundDesign';

const assets = {
  wheel: [require('@/assets/sounds/tools/wheel-tick.wav'), require('@/assets/sounds/tools/wheel-end.wav')],
  bottle: [require('@/assets/sounds/tools/bottle-tick.wav'), require('@/assets/sounds/tools/bottle-end.wav')],
  coin: [require('@/assets/sounds/tools/coin-tick.wav'), require('@/assets/sounds/tools/coin-end.wav')],
  dice: [require('@/assets/sounds/tools/dice-tick.wav'), require('@/assets/sounds/tools/dice-end.wav')],
  teams: [require('@/assets/sounds/tools/teams-tick.wav'), require('@/assets/sounds/tools/teams-end.wav')],
  hourglass: [require('@/assets/sounds/tools/hourglass-tick.wav'), require('@/assets/sounds/tools/hourglass-end.wav')],
};
let context: AudioContext | undefined;

/** One screen owns its effects and deferred work. No autonomous sound loop. */
export class ToolAudio {
  private players: AudioPlayer[] = [];
  private nodes = new Set<AudioBufferSourceNode>();
  private buffers = new Map<ToolCue, AudioBuffer>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private enabled = false;
  private active = false;
  private startedAt = 0;
  private duration = 1;
  private lastTick = -Infinity;
  private slot = 0;
  private generation = 0;
  private unsubscribe?: () => void;
  constructor(private kind: ToolKind) {}

  prepare() {
    this.enabled = true;
    this.unsubscribe?.();
    this.unsubscribe = useSettingsStore.subscribe(state => {
      if (!state.isSoundEnabled) this.stopSounds();
    });
    if (Platform.OS !== 'web' && !this.players.length) {
      try {
        // Three voices allow short per-detent tails without restarting another voice.
        this.players = [0, 0, 0, 1].map(index => createAudioPlayer(assets[this.kind][index]));
      } catch { this.players.forEach(player => player.remove()); this.players = []; }
    }
  }

  begin(durationMs = 1000) {
    this.stopSounds();
    this.active = true;
    this.duration = Math.max(1, durationMs);
    this.startedAt = Date.now();
    this.lastTick = -Infinity;
    this.cue('tick', 0.3); // Synchronous user gesture also unlocks mobile-browser audio.
  }

  tick() {
    if (!this.active || Date.now() - this.lastTick < 35) return;
    this.lastTick = Date.now();
    this.cue('tick', toolTickVolume((Date.now() - this.startedAt) / this.duration));
  }

  finish() {
    if (!this.active) return;
    this.active = false;
    this.stopSounds();
    this.cue('end', 0.55);
  }

  cue(cue: ToolCue = 'tick', volume = 0.3) {
    if (!this.enabled || !useSettingsStore.getState().isSoundEnabled) return;
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || document.hidden) return;
      try {
        const AudioCtor = window.AudioContext ?? (window as any).webkitAudioContext;
        if (!AudioCtor) return;
        context ??= new AudioCtor();
        const ctx = context!;
        // Must be called during the initiating gesture, not after awaiting a fetch.
        void ctx.resume().catch(() => {});
        let buffer = this.buffers.get(cue);
        if (!buffer) {
          const pcm = synthesizeToolCue(this.kind, cue);
          buffer = ctx.createBuffer(1, pcm.length, TOOL_SAMPLE_RATE);
          buffer.getChannelData(0).set(pcm);
          this.buffers.set(cue, buffer);
        }
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffer;
        gain.gain.value = volume;
        source.connect(gain).connect(ctx.destination);
        this.nodes.add(source);
        source.onended = () => { this.nodes.delete(source); source.disconnect(); gain.disconnect(); };
        source.start();
      } catch { /* Audio support must never block a tool. */ }
    } else {
      const player = this.players[cue === 'end' ? 3 : this.slot++ % 3];
      if (!player?.isLoaded) return;
      const generation = this.generation;
      player.volume = volume;
      void player.seekTo(0).then(() => {
        if (this.enabled && generation === this.generation && useSettingsStore.getState().isSoundEnabled) player.play();
      }).catch(() => {});
    }
  }

  later(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.enabled) callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  stopSounds() {
    this.generation++;
    this.nodes.forEach(source => { try { source.stop(); } catch {} });
    this.nodes.clear();
    this.players.forEach(player => { try { player.pause(); } catch {} });
  }

  cancel() { this.active = false; this.stopSounds(); }
  dispose() {
    this.enabled = false;
    this.cancel();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.unsubscribe?.();
    this.players.forEach(player => { try { player.remove(); } catch {} });
    this.players = [];
  }
}
