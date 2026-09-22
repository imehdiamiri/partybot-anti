export const TOOL_KINDS = ['wheel', 'bottle', 'coin', 'dice', 'teams', 'hourglass'] as const;
export type ToolKind = typeof TOOL_KINDS[number];
export type ToolCue = 'tick' | 'end';

/** Full motion recordings play once. Only physical detents/countdown have ticks. */
export const TOOL_AUDIO_PROFILE: Record<ToolKind, { repeated: boolean; volume: number; endVolume: number; interval: number }> = {
  bottle: { repeated: false, volume: 0.38, endVolume: 0.22, interval: 120 },
  dice: { repeated: false, volume: 0.45, endVolume: 0.3, interval: 120 },
  coin: { repeated: false, volume: 0.33, endVolume: 0.25, interval: 120 },
  teams: { repeated: false, volume: 0.28, endVolume: 0.2, interval: 160 },
  wheel: { repeated: true, volume: 0.28, endVolume: 0.22, interval: 180 },
  hourglass: { repeated: true, volume: 0.25, endVolume: 0.38, interval: 400 },
};

export function toolTickVolume(progress: number) {
  return 0.85 - 0.25 * Math.max(0, Math.min(1, progress));
}
