export interface EyeSightAttempt { round: number; target: string; answer: string; correct: boolean; }
export function compareEyeSightDigits(target: string, answer: string) {
  return Array.from({ length: Math.max(target.length, answer.length) }, (_, index) => ({
    expected: target[index] ?? '—',
    entered: answer[index] ?? '—',
    correct: target[index] !== undefined && target[index] === answer[index],
  }));
}
