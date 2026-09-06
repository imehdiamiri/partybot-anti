# Eye Sight feedback and game start guides

- Eye Sight uses medium-weight system monospace digits, without blurred glow.
- Each submitted round retains its target, answer and correctness. Feedback shows
  attempts/correct/wrong counts, neutral original number, per-position green check
  or red cross on entered digits, and newest-first round history.
- A wrong first answer is now a played result, not incorrectly marked skipped.
- All 16 game descriptions are three numbered action steps with a vector icon.
- Removed the old once-ever overlay from the renderer. Normal single-device games
  mount only after guide acknowledgement, so their timers cannot start underneath.
- Eye Sight: difficulty -> guide -> player ready -> countdown. Replay repeats this.
- Pass & Guess: mode/question -> Start -> guide -> private player handoff.
- Guess the Seconds: target -> Start -> guide -> running timer.
- Other games: setup -> guide -> game-specific ready/role/action screen.
- Shared scoreboard replay defers its callback until the guide is acknowledged.
  It preserves the completed game until then; it does not reset progress early.
- Session renderer is keyed by session ID so a new game cannot inherit dismissed
  guide state. No AsyncStorage first-time flag suppresses new-game instructions.

Validation: TypeScript passed; 147 tests / 17 suites passed; web export succeeded.
New tests cover guide mount/replay gating, all-game content coverage, first-wrong
score, digit comparison, difficulty ordering and no countdown behind the guide.
Physical iOS/Android testing and two-device room testing are not claimed.

Pre-change recovery tag: checkpoint/before-eyesight-intros-2026-09-06.
Publishing results are recorded in RELEASE_LOG.md after service confirmation.
