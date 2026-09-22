import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { useSettingsStore } from '../store/useSettingsStore';
import { toolTickVolume, type ToolKind, type ToolCue } from './ToolSoundDesign';

const assets = {
  wheel: [require('@/assets/sounds/tools/wheel-tick.wav'), require('@/assets/sounds/tools/wheel-end.wav')],
  bottle: [require('@/assets/sounds/tools/bottle-tick.wav'), require('@/assets/sounds/tools/bottle-end.wav')],
  coin: [require('@/assets/sounds/tools/coin-tick.wav'), require('@/assets/sounds/tools/coin-end.wav')],
  dice: [require('@/assets/sounds/tools/dice-tick.wav'), require('@/assets/sounds/tools/dice-end.wav')],
  teams: [require('@/assets/sounds/tools/teams-tick.wav'), require('@/assets/sounds/tools/teams-end.wav')],
  hourglass: [require('@/assets/sounds/tools/hourglass-tick.wav'), require('@/assets/sounds/tools/hourglass-end.wav')],
};
let context: AudioContext | undefined;

/** One screen owns its recorded effects, motion-bound loops and deferred work. */
export class ToolAudio {
  private players: AudioPlayer[] = [];
  private nodes = new Set<AudioBufferSourceNode>();
  private gains = new Map<AudioBufferSourceNode, GainNode>();
  private buffers = new Map<ToolCue, AudioBuffer>();
  private loads = new Map<ToolCue, Promise<AudioBuffer>>();
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
    if (Platform.OS === 'web') {
      for (const cue of ['tick', 'end'] as const) void this.loadBuffer(cue).catch(() => {});
    } else if (!this.players.length) {
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
    this.cue('tick', 0.62); // Synchronous user gesture also unlocks mobile-browser audio.
  }

  tick() {
    if (!this.active || Date.now() - this.lastTick < 35) return;
    this.lastTick = Date.now();
    if (this.kind === 'bottle') {
      // Continuous glass friction follows the slowing bottle instead of repeated beeps.
      const progress = Math.min(1, (Date.now() - this.startedAt) / this.duration);
      const rate = 1.15 - 0.5 * progress;
      this.nodes.forEach(node => { node.playbackRate.value = rate; const gain = this.gains.get(node); if (gain) gain.gain.value = toolTickVolume(progress); });
      const player = this.players[0];
      if (player) { player.setPlaybackRate(rate); player.volume = toolTickVolume(progress); }
      return;
    }
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
        const generation = this.generation;
        const play = (buffer: AudioBuffer) => {
          if (!this.enabled || generation !== this.generation || document.hidden || !useSettingsStore.getState().isSoundEnabled) return;
          const source = ctx.createBufferSource();
          const gain = ctx.createGain();
          source.buffer = buffer;
          source.loop = this.kind === 'bottle' && cue === 'tick' && this.active;
          gain.gain.value = volume;
          source.connect(gain).connect(ctx.destination);
          this.nodes.add(source);
          this.gains.set(source, gain);
          source.onended = () => { this.nodes.delete(source); this.gains.delete(source); source.disconnect(); gain.disconnect(); };
          source.start();
        };
        const buffer = this.buffers.get(cue);
        if (buffer) play(buffer);
        else void this.loadBuffer(cue).then(play).catch(() => {});
      } catch { /* Audio support must never block a tool. */ }
    } else {
      const player = this.players[cue === 'end' ? 3 : this.kind === 'bottle' ? 0 : this.slot++ % 3];
      if (!player?.isLoaded) return;
      const generation = this.generation;
      player.loop = this.kind === 'bottle' && cue === 'tick' && this.active;
      if (this.kind === 'bottle') player.shouldCorrectPitch = false;
      player.volume = volume;
      void player.seekTo(0).then(() => {
        if (this.enabled && generation === this.generation && useSettingsStore.getState().isSoundEnabled) player.play();
      }).catch(() => {});
    }
  }

  private loadBuffer(cue: ToolCue): Promise<AudioBuffer> {
    const existing = this.loads.get(cue);
    if (existing) return existing;
    const promise = (async () => {
      const AudioCtor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AudioCtor) throw new Error('Web Audio unavailable');
      context ??= new AudioCtor();
      const asset = Asset.fromModule(assets[this.kind][cue === 'end' ? 1 : 0]);
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('Tool sound unavailable');
      const buffer = await context!.decodeAudioData(await response.arrayBuffer());
      if (this.enabled) this.buffers.set(cue, buffer);
      return buffer;
    })();
    this.loads.set(cue, promise);
    void promise.catch(() => this.loads.delete(cue));
    return promise;
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
    this.nodes.forEach(source => { try { source.stop(); source.disconnect(); } catch {} });
    this.gains.forEach(gain => gain.disconnect());
    this.gains.clear();
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
    this.buffers.clear();
    this.loads.clear();
  }
}
