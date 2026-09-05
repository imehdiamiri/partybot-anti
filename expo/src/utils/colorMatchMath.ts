/**
 * Color Match Math & Conversion Utilities
 * Shared between ColorMatchSession component and unit tests.
 */

export function hsvToHsl(h: number, s: number, v: number): string {
  const sDec = s / 100;
  const vDec = v / 100;

  const l = vDec * (1 - sDec / 2);
  let sHsl = 0;
  if (l > 0 && l < 1) {
    sHsl = (vDec - l) / Math.min(l, 1 - l);
  }

  const hInt = Math.round(h);
  const sInt = Math.round(sHsl * 100);
  const lInt = Math.round(l * 100);

  return `hsl(${hInt}, ${sInt}%, ${lInt}%)`;
}

/**
 * Compute proximity score (0 to 10) in HSV cylindrical coordinates
 */
export function calculateColorMatchScore(
  target: { h: number; s: number; b: number },
  guess: { h: number; s: number; b: number }
): number {
  if (target.h === guess.h && target.s === guess.s && target.b === guess.b) {
    return 10.0;
  }
  const h1 = target.h * (Math.PI / 180);
  const s1 = target.s / 100;
  const v1 = target.b / 100;

  const h2 = guess.h * (Math.PI / 180);
  const s2 = guess.s / 100;
  const v2 = guess.b / 100;

  // Convert to cylindrical coordinates:
  // x = S * V * cos(H), y = S * V * sin(H), z = V
  const x1 = s1 * v1 * Math.cos(h1);
  const y1 = s1 * v1 * Math.sin(h1);
  const z1 = v1;

  const x2 = s2 * v2 * Math.cos(h2);
  const y2 = s2 * v2 * Math.sin(h2);
  const z2 = v2;

  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = z1 - z2;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Maximum possible distance in this space is 2.0 (e.g. Red vs Cyan)
  const normDist = Math.min(1.0, dist / 2.0);

  // Similarity score out of 10
  const rawScore = 10 * (1 - normDist);
  return Math.max(0, Math.round(rawScore * 100) / 100); // 2 decimal places
}
