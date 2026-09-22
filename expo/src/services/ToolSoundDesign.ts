export const TOOL_KINDS = ['wheel', 'bottle', 'coin', 'dice', 'teams', 'hourglass'] as const;
export type ToolKind = typeof TOOL_KINDS[number];
export type ToolCue = 'tick' | 'end';

export function toolTickVolume(progress: number) {
  return 0.62 - 0.28 * Math.max(0, Math.min(1, progress));
}
