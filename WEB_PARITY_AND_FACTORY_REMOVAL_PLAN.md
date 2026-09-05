# PlayBot Web Parity & Factory Removal Plan

## Product decision

The Expo application is the canonical game client for iOS, Android, and web. The existing `website/` project remains the marketing/admin surface; do not reimplement the game catalogue there. Web game parity is delivered through Expo Web so the visual language, routes, components, and local-game logic remain shared with iOS/Android.

For the current release track, the product focus is offline/local play. Factory, AI game generation, and client access to the `generateCard` flow are removed. Multiplayer remains out of the web-parity release gate until the pending RTDB authorization task is completed.

## Release gates

| Gate | Status | Meaning |
|---|---|---|
| Factory/AI removal | Complete | No Factory tab, route, UI, client AI call, or unused AI backend surface remains. |
| Expo Web baseline | Complete | Static web export starts, routes, and renders the shared shell without native-only crashes (35 routes verified). |
| Local game parity | In Progress | Code inspected and unit-tested for shared algorithms; real browser smoke pass required before release assertion. |
| Visual parity | In Progress | Desktop and mobile-browser responsive layouts inspected; manual browser smoke verification required. |
| Multiplayer web release | Blocked | Complete RTDB room-membership authorization task before enabling/releasing multiplayer on web. |
| Store release | Separate | Physical-device StoreKit/Play Billing and external deep-link verification remain required. |

## Delivery phases

### Phase 1 — Remove Factory and AI generation
- Removed the Factory tab and route from Expo navigation.
- Removed `AIGeneratorPanel`, `LLMService`, and `generateCard` callable/backend code.
- Removed related tests, environment references, and documentation without deleting shared game logic.
- Verified with automated tests in `gameLogic.test.ts`.

### Phase 2 — Web baseline and compatibility inventory
- Evaluated all 16 games and tool screens on web.
- Standardized offline-safe authentication (`authWebOffline.ts`, `LocalAuthUser`).
- Created browser audio synthesis and recording adapters (`browserMediaAdapter.ts`).
- Made local/offline play the default on web without requiring native purchases or auth.

### Phase 3 — Shared web runtime shell
- Ensured Expo Web app boots with zero native-module crashes.
- Replaced un-guarded native dependencies with safe fallbacks.
- Verified 35 static routes during `npx expo export -p web`.

### Phase 4 — Local game parity in batches
- Code-inspected all 16 predefined games in 1-Phone local mode and added focused automated coverage for selected shared algorithms/adapters.
- Identified expected mouse/touch, timer, skip-context, and scoreboard paths; real browser interaction remains pending the grouped smoke checklist below.
- Extracted and unit-tested browser media adaptations (Web Audio API oscillator & recorder); browser audio and microphone behavior remains manual-smoke required.

### Phase 5 — Web quality/release pass
- Added focused regression unit tests for all web adapters and game logic.
- Ran TypeScript checks, Jest unit tests, and static web export.
- Executing browser smoke verification checklist across all 16 games.

## 16-Game Release-Readiness Matrix (1-Phone Web)

| Game ID | Name | Input Type | Web Audio / Media | Evidence Level | Verification Status |
|---|---|---|---|---|---|
| `reverse_singing` | Reverse Singing | Mic + Click | `WebAudioRecorder` (Blob URL tracked & revoked) | `CODE_INSPECTED`, `AUTOMATED` (adapter/blob tests), `MANUAL_REQUIRED` | In Progress (Microphone Prompt & Recording Smoke Required) |
| `guess_the_seconds` | Guess the Seconds | Tap / Click | N/A (Pure timer delta) | `CODE_INSPECTED`, `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `imposter` | Imposter | Touch / TextInput | N/A (Turn pass cards) | `CODE_INSPECTED`, `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `memory_grid` | Memory Grid | Click / Tap | N/A (3D flip tiles) | `CODE_INSPECTED`, `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `ten_tangle` | Ten Tangle | Slider / Tap | N/A (Scenario scale) | `CODE_INSPECTED`, `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `memory_path` | Memory Path | Grid Click / Tap | N/A (DFS maze solver) | `CODE_INSPECTED`, `AUTOMATED` (DFS algorithm test), `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `pass_guess` | Pass & Guess | Keyboard / Click | N/A (Space/Enter shortcuts) | `CODE_INSPECTED`, `AUTOMATED` (web keyboard prevention), `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `tap_in_order` | Tap in Order | Rapid Click / Tap | N/A (Sequential order) | `CODE_INSPECTED`, `AUTOMATED` (preview formula test), `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `color_trap` | Color Trap | Rapid Click / Tap | N/A (Spawn circles) | `CODE_INSPECTED`, `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `draw_rush` | Draw & Rush | Pan / Mouse Draw | N/A (SVG path canvas) | `CODE_INSPECTED`, `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `spin_bottle` | Truth & Dare | Tap to Spin | N/A (Reanimated bottle) | `CODE_INSPECTED`, `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `reaction_time` | Reaction Time | Precision Click / Tap | N/A (Perf timer delta) | `CODE_INSPECTED`, `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `eye_sight` | Eye Sight | Numpad / Keyboard | N/A (Flash digits) | `CODE_INSPECTED`, `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `drum_challenge` | Drum Challenge | Rhythm Click / Tap | Web Audio API (`playWebTick`, `playWebDrumHit`) | `CODE_INSPECTED`, `AUTOMATED` (Web Audio synth tests), `MANUAL_REQUIRED` | In Progress (Browser Audio Smoke Required) |
| `color_match` | Color Match | HSV Sliders | N/A (HSV cylinder math) | `CODE_INSPECTED`, `AUTOMATED` (HSV math test), `MANUAL_REQUIRED` | In Progress (Browser Smoke Required) |
| `sound_match` | Sound Match | Slider / Click | Web Audio API (`playWebTone` sine synth) | `CODE_INSPECTED`, `AUTOMATED` (Web Audio tone test), `MANUAL_REQUIRED` | In Progress (Browser Audio Smoke Required) |

## Operator Browser Smoke Checklist (1-Phone Web)

To validate local gameplay in a desktop or mobile browser (`npx expo start --web`):

### 1. Standard Tap / Click Games
- [ ] **`guess_the_seconds`**: Launch `/game/guess_the_seconds/setup` -> start session -> set target time -> tap to start stopwatch -> tap to stop -> verify difference and scoreboard.
- [ ] **`imposter`**: Launch `/game/imposter/setup` -> start session -> pass phone cards to reveal roles -> discussion timer runs -> vote suspect -> verify imposter reveal.
- [ ] **`memory_grid`**: Launch `/game/memory_grid/setup` -> flip tiles -> verify match animation and timer -> complete grid -> verify win results.
- [ ] **`ten_tangle`**: Launch `/game/ten_tangle/setup` -> read scenario -> act -> guesser selects score on slider -> verify reveal.
- [ ] **`memory_path`**: Launch `/game/memory_path/setup` -> click grid tiles -> verify wrong step reset and correct step advancement -> reach goal -> scoreboard.
- [ ] **`spin_bottle`**: Launch `/game/spin_bottle/setup` -> tap to spin -> verify smooth bottle rotation -> choose Truth/Dare -> view prompt and reroll.
- [ ] **`color_match`**: Launch `/game/color_match/setup` -> memorize target color -> adjust Hue/Sat/Val sliders -> submit guess -> verify similarity score.

### 2. Keyboard & Text Input Games
- [ ] **`pass_guess`**: Launch `/game/pass_guess/setup` -> enter answers with keyboard -> test `Space`/`Enter` navigation -> guess submissions -> verify scoreboard.
- [ ] **`eye_sight`**: Launch `/game/eye_sight/setup` -> observe flashing number -> type digits via physical keyboard and on-screen keypad -> verify level progression.

### 3. Real-Time Reflex & Timer Games
- [ ] **`reaction_time`**: Launch `/game/reaction_time/setup` -> wait for green screen -> click immediately -> verify reaction time in ms -> test early click (foul detection).
- [ ] **`tap_in_order`**: Launch `/game/tap_in_order/setup` -> observe preview countdown -> click numbers 1..N in order -> verify timer and results.
- [ ] **`color_trap`**: Launch `/game/color_trap/setup` -> tap appearing circles matching target rule -> verify score increments and 3-strikes game over.

### 4. Canvas & Pointer Drawing
- [ ] **`draw_rush`**: Launch `/game/draw_rush/setup` -> draw with mouse/pointer drag -> verify SVG brush stroke rendering and color picker -> reveal and guess.

### 5. Web Audio Synthesizer
- [ ] **`sound_match`**: Launch `/game/sound_match/setup` -> click Play Target (hear Web Audio oscillator tone) -> adjust slider and click Preview -> submit -> verify cents score.
- [ ] **`drum_challenge`**: Launch `/game/drum_challenge/setup` -> hear metronome tick audio -> click drum on beat -> hear drum bass hit -> verify precision ms difference.

### 6. MediaRecorder & Microphone Capture
- [ ] **`reverse_singing` (Permission Granted)**: Launch `/game/reverse_singing/setup` -> allow microphone prompt -> record Player 1 audio clip -> listen to reversed playback -> record Player 2 imitation -> listen to reversed comparison -> score round.
- [ ] **`reverse_singing` (Permission Denied / Cancelled)**: Launch session -> deny microphone access in browser -> verify graceful error alert ("Microphone permission denied. Please allow microphone access...") without app crash.

## Web-Local Dependency & Offline Boundary Matrix

### Definition of Offline / Local Play
Offline/local play refers to local 1-Phone gameplay **after the initial web bundle and static assets (HTML/JS/CSS/fonts/images) have loaded in the browser**.
- **Cold Start & PWA Scope**: This release track does not implement Service Worker / PWA offline manifest caching; initial page load requires network access to fetch the application bundle from the web host.
- **Runtime Decoupling**: Once loaded, all 1-Phone games, tools, and local profiles operate completely decoupled from backends, RTDB, Cloud Functions, and native device SDKs.

### Subsystem Dependency Inventory

| Component / Subsystem | Web-Local Behavior | Network / Native Dependencies | Evidence Level | Release Implication |
|---|---|---|---|---|
| **App Boot (`app/_layout.tsx`)** | Mounts theme, loads Google Fonts, initializes stores with local guest defaults. `Observability.install()` and `Audio.setAudioModeAsync()` guarded with `if (!isWeb)`. | Initial font/bundle fetch. Zero RTDB or Firebase Auth connections. | `CODE_INSPECTED`, `AUTOMATED` | Clean web boot with zero native crashes. |
| **Authentication (`useAuthStore.ts`)** | Initialized as `guest_local` (`isAnonymous: true`). Sign-in/Sign-up functions store username locally. Google/Apple logins display informative mobile-only message. | Zero Firebase Auth network calls (`signInWithEmailAndPassword`, `signInWithCredential`, `onAuthStateChanged` strictly bypassed on web). | `CODE_INSPECTED`, `AUTOMATED` (`authWebOffline.test.ts`) | Fully decoupled local auth. |
| **Economy & Stars (`useEconomyStore.ts`)** | Attached as `guest_local` with `isPremium: true` and 10 stars. Daily reward claims locally without cloud functions. Entitlement sync returns null. | Zero RTDB listeners (`ref(rtdb, 'users/...')`) or Cloud Function calls (`claimDailyReward`, `syncRevenueCat`). | `CODE_INSPECTED`, `AUTOMATED` (`authWebOffline.test.ts`) | All games unlocked for local play without purchase requirements. |
| **Paywall & IAP (`usePaywallStore.ts`)** | `hasApiKey()` evaluates `false` on web. Store remains dormant with empty packages and `isConfigured: false`. | Zero calls to native `react-native-purchases` SDK. | `CODE_INSPECTED`, `AUTOMATED` (`authWebOffline.test.ts`) | Storefront gracefully disabled on web. |
| **Sound Effects (`AudioManager.ts`)** | `init()`, `preload()`, `play()`, `playOneShot()`, `unloadAll()` return early on web (`if (isWeb) return;`). | Zero `expo-av` invocations on web. | `CODE_INSPECTED`, `AUTOMATED` (`authWebOffline.test.ts`) | Zero native audio crashes or unhandled promises on web. |
| **Web Audio Synthesis (`browserMediaAdapter.ts`)** | Uses standard browser `AudioContext` and `OscillatorNode` for tone generation in Sound Match and Drum Challenge. | Standard W3C Web Audio API (supported by Chrome, Safari, Firefox, Edge). | `CODE_INSPECTED`, `AUTOMATED` (`browserMediaAdapter.test.ts`) | Pure client-side synthesis. |
| **Audio Recording (`WebAudioRecorder`)** | Uses browser `MediaRecorder` and `AudioContext.decodeAudioData` with client-side Float32Array reversal for Reverse Singing. Blob URLs are tracked and revoked on replacement/unmount. | Standard W3C `navigator.mediaDevices.getUserMedia` & `MediaRecorder`. | `CODE_INSPECTED`, `AUTOMATED` (`browserMediaAdapter.test.ts`), `MANUAL_REQUIRED` (mic permission dialog) | In-browser mic capture with error alerts for permission denial. |
| **Game Session Store (`useGameStore.ts`)** | Generates session ID via `Math.random()` and players via `makeLocalPlayer()`. Manages turns and rounds in memory. | 100% in-memory Zustand state. | `CODE_INSPECTED`, `AUTOMATED` (`gameLogic.test.ts`) | Zero server dependency for 1-Phone mode. |
| **16 Local Games (`expo/src/components/games/*`)** | All 16 games execute pure React/Reanimated local logic with local timers (`setInterval`/`performance.now()`), SVG drawing, and local scoreboard computation. | Pure browser DOM / React Native Web primitives. | `CODE_INSPECTED`, `MANUAL_REQUIRED` (browser smoke checklist) | Offline parity for 1-Phone mode. |
| **Party Tools (`app/(tabs)/tools.tsx` & tools routes)** | Dice, Coin, Wheel, Bottle, Hourglass operate via local random math and Reanimated animation. | Pure local computation. | `CODE_INSPECTED` | Offline tools functional. |
| **Multiplayer (`useMultiplayerStore.ts`)** | Multiplayer modes blocked/disabled on web pending RTDB authorization completion. | N/A on web. | `CODE_INSPECTED` | Gated until Phase 5 RTDB authorization. |

## Web Bundle & Payload Health Baseline

### Build Metrics (Clean Export: `npx expo export -p web`)
- **JavaScript Entry Bundle**: `6.92 MB` (unminified development / static web export bundle; 3,092 modules).
- **Static Routes**: 35 static HTML routes emitted into `dist/`.
- **Compiler Warnings**: `1` (Non-blocking deprecation notice emitted by `expo-av` under Expo SDK 54: `[expo-av]: Expo AV has been deprecated and will be removed in SDK 54...`).

### Top Emitted Asset Payloads (Measured Before & After Optimization)
| Asset Name | Category | Original PNG (dist) | Optimized WebP (dist) | Measured Savings | Status |
|---|---|---|---|---|---|
| `drum-challenge` | Hero Banner | 3,228.27 KB | 96.73 KB | **-3,131.54 KB (-97.0%)** | Optimized (WebP) |
| `coin-heads` | Tool Graphic | 2,079.64 KB | 268.50 KB | **-1,811.14 KB (-87.1%)** | Optimized (WebP) |
| `coin-tails` | Tool Graphic | 2,054.41 KB | 380.52 KB | **-1,673.89 KB (-81.5%)** | Optimized (WebP) |
| `guess-the-seconds` | Hero Banner | 2,033.12 KB | 96.82 KB | **-1,936.30 KB (-95.2%)** | Optimized (WebP) |
| `draw-rush` | Hero Banner | 1,982.55 KB | 96.72 KB | **-1,885.83 KB (-95.1%)** | Optimized (WebP) |
| `reverse-singing` | Hero Banner | 1,895.60 KB | 71.30 KB | **-1,824.30 KB (-96.2%)** | Optimized (WebP) |
| `spin-bottle` | Hero Banner | 1,875.16 KB | 72.00 KB | **-1,803.16 KB (-96.2%)** | Optimized (WebP) |
| `color-trap` | Hero Banner | 1,749.96 KB | 71.37 KB | **-1,678.59 KB (-95.9%)** | Optimized (WebP) |
| **Batch 1 Subtotal** | | **16,898.71 KB** | **1,153.96 KB** | **-15,744.75 KB (-93.2%)** | **15.74 MB Saved** |
| `ten-tangle` | Hero Banner | 1,718.24 KB | 63.54 KB | **-1,654.70 KB (-96.3%)** | Optimized (WebP) |
| `hourglass` | Tool Graphic | 1,710.77 KB | 235.66 KB | **-1,475.11 KB (-86.2%)** | Optimized (WebP) |
| `pass-guess` | Hero Banner | 1,695.57 KB | 48.42 KB | **-1,647.15 KB (-97.1%)** | Optimized (WebP) |
| `imposter` | Hero Banner | 1,665.55 KB | 50.78 KB | **-1,614.77 KB (-96.9%)** | Optimized (WebP) |
| `eye-sight` | Hero Banner | 1,610.54 KB | 48.74 KB | **-1,561.80 KB (-97.0%)** | Optimized (WebP) |
| `reaction-time` | Hero Banner | 1,600.69 KB | 57.22 KB | **-1,543.47 KB (-96.4%)** | Optimized (WebP) |
| `sound-match` | Hero Banner | 1,257.33 KB | 72.11 KB | **-1,185.22 KB (-94.3%)** | Optimized (WebP) |
| `color-match` | Hero Banner | 1,096.45 KB | 45.08 KB | **-1,051.37 KB (-95.9%)** | Optimized (WebP) |
| `bottle` | Tool Graphic | 961.50 KB | 101.89 KB | **-859.61 KB (-89.4%)** | Optimized (WebP) |
| `memory-path` | Hero Banner | 650.70 KB | 94.24 KB | **-556.46 KB (-85.5%)** | Optimized (WebP) |
| `memory-grid` | Hero Banner | 516.68 KB | 44.89 KB | **-471.79 KB (-91.3%)** | Optimized (WebP) |
| `tap-in-order` | Hero Banner | 461.93 KB | 36.93 KB | **-425.00 KB (-92.0%)** | Optimized (WebP) |
| **Batch 2 Subtotal** | | **13,945.95 KB** | **899.50 KB** | **-13,046.45 KB (-93.6%)** | **12.74 MB Saved** |
| **Grand Total (20 hero/tool assets)** | | **30,844.66 KB** | **2,053.46 KB** | **-28,791.20 KB (-93.3%)** | **~28.12 MB Saved** |
| `MaterialCommunityIcons.ttf` | Icon Font | 1,277.01 KB | 1,277.01 KB | — | Unchanged (Vector Font) |

### Native Module Bundle Isolation & Deprecation Assessment
1. **`expo-av`**:
   - **Runtime Invocation**: Runtime execution is strictly guarded by code logic and automated regression tests on the web path (`_layout.tsx`, `AudioManager.ts`, `sharedSound.ts`, `DrumChallengeSession.tsx`, `SoundMatchSession.tsx`, and `ReverseSingingSession.tsx`). Zero native audio calls occur during web gameplay.
   - **Static Bundle Inclusion**: Statically included by Metro in the web bundle to preserve shared native iOS/Android audio playback capabilities.
   - **Deprecation Policy in Expo SDK 54**: The project is built on Expo SDK 54 (`"expo": "~54.0.37"`). While `expo-av` emits an SDK-54 deprecation notice during compilation, it remains functional and stable for native audio. Migration to `expo-audio` is scoped as a separate dedicated native refactor to avoid introducing audio lifecycle regressions on iOS/Android.
2. **`react-native-purchases` (RevenueCat)**:
   - **Runtime Invocation**: Bypassed via `hasApiKey()` evaluation (`false` on web). Store remains dormant with zero network/native calls.
3. **`expo-apple-authentication` / `expo-crypto`**:
   - **Runtime Invocation**: Guarded behind local guest auth; zero native module exceptions.

## Non-goals for this track

- No pricing, RevenueCat product, store listing, or purchase-flow changes.
- No EAS build, deployment, production credential, Firebase schema, or rules loosening.
- No rewrite of the Expo game app into the existing Next.js website.
