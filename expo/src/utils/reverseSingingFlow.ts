/** Recording order is enforced in the handler, not only by disabled buttons. */
export function canStartReverseTake(player: 1 | 2, sourceLocked: boolean, reversedSourceReady: boolean, busy: boolean) {
  if (busy) return false;
  return player === 1 ? !sourceLocked : sourceLocked && reversedSourceReady;
}
