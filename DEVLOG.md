# 🛠️ PlayVirals DevLog

## 🚀 Pre-Launch / Production Checklist

The following items are temporary developer bypasses that **MUST BE REMOVED** before publishing to the App Store / Google Play:

- [ ] **Onboarding Bypass:** Remove `useSettingsStore.getState().setHasCompletedOnboarding(false);` in `expo/app/_layout.tsx`. Currently, it's forcing the onboarding screen to show on every app load for testing the new UI.
- [ ] **Premium Games Lock:** Remove the temporary `const isPremium = true;` bypass in `expo/app/(tabs)/game/[id].tsx`. The app needs to correctly check RevenueCat/EconomyStore so free users hit the paywall.

---

### v2.4.0 - Cross-Game Player Count Sync & Default Rounds = 1
* **Date:** June 27, 2026
* **Changes:**
  * **Cross-Game Player Sync:** Added `lastGlobalPlayerCount` and `lastGlobalPlayerNames` fields to `useSettingsStore`. Now every time a game session starts, the player count and names are saved globally. When a user opens any game's setup screen, the last player count/names used across all games are pre-filled as the default.
  * **Priority logic:** If the specific game was played before, its own saved names are used. Otherwise, falls back to the global last session names from any other game.
  * **Bounds clamping:** Restored player count is always clamped within each game's `minPlayers` / `maxPlayers` range.
  * **Default Round Count:** Changed the default round count from 3 to 1 across all games.
* **Modified Files:**
  * [useSettingsStore.ts](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/store/useSettingsStore.ts)
  * [setup.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/app/game/[id]/setup.tsx)
  * [DEVLOG.md](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/DEVLOG.md)

### v2.3.0 - Pass & Guess: Guessing Overhaul & "Who Said It?" Mode
* **Date:** June 27, 2026
* **Changes:**
  * **Guessing Phase Overhaul:** Completely removed the voter-by-voter phone passing phase during guessing. Replaced it with a host-controlled guessing view where a single person holds the phone, views all answers at once, and assigns each answer to the player they think wrote it.
  * **New "Who Said It?" Mode:** Added a play mode toggle on the intro screen to choose between "Classic Q&A" and "Who Said It?". In "Who Said It?" mode, players can write any statement about themselves freely instead of answering a predefined question.
  * **Scoring Rules:** Adjusted scoring to reward players +100 points when the host incorrectly guesses their statement/answer (i.e. they fooled the group!).
* **Modified Files:**
  * [PassGuessSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/PassGuessSession.tsx)
  * [DEVLOG.md](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/DEVLOG.md)

### v2.2.0 - Perfect Shave Game Removal
* **Date:** June 26, 2026
* **Changes:**
  * **Game Removal:** Completely removed the "Perfect Shave" game (`perfect_shave`) from the application. Deleted all associated gameplay components and asset images. Cleaned up setup configurations, game renderer switch-case logic, and library definitions to ensure full type safety and compilation.
* **Deleted Files:**
  * [PerfectShaveSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/PerfectShaveSession.tsx)
  * [perfect-shave.png](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/assets/images/heroes/perfect-shave.png)
  * [perfect-shave-head.png](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/assets/images/perfect-shave-head.png)
* **Modified Files:**
  * [setup.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/app/game/[id]/setup.tsx)
  * [GameSessionRenderer.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/GameSessionRenderer.tsx)
  * [AppModels.ts](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/models/AppModels.ts)
  * [DEVLOG.md](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/DEVLOG.md)

### v2.1.0 - Cards Deck & Tools Safe-Area Bottom Spacing Optimization
* **Date:** June 24, 2026
* **Changes:**
  * **Safe-Area Bottom Spacing:** Standardized bottom padding and margins of all action buttons and action bars inside Cards Deck Swiper and all Tools screens (`coin`, `dice`, `hourglass`, `teams`, `bottle`) by utilizing `useSafeAreaInsets` to prevent them from sticking to the physical bottom edge/home indicator on bezel-less notch devices.
* **Modified Files:**
  * [CardsDeckRenderer.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/tools/CardsDeckRenderer.tsx)
  * [coin.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/app/(tools)/coin.tsx)
  * [dice.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/app/(tools)/dice.tsx)
  * [hourglass.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/app/(tools)/hourglass.tsx)
  * [teams.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/app/(tools)/teams.tsx)
  * [bottle.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/app/(tools)/bottle.tsx)
  * [DEVLOG.md](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/DEVLOG.md)

### v2.0.0 - Button Typography Unification, Result Animations & Audio Tiers
* **Date:** June 24, 2026
* **Changes:**
  * **Typography Unification:** Replaced `fontFamily: 'Viral-Black'` with a clean, default system bold font on all gameplay and result screens' buttons to unify the look.
  * **Perfect score bug fixes:** Ensured exact matches (rounded to integer frequencies in Sound Match, and identical H/S/B colors in Color Match) return a perfect `10.00/10` score.
  * **Result Animations & Tiered Sound Effects:** Added score feedback animated badges (using Reanimated scale-up spring pop and horizontal shake animations) on Sound Match and Color Match result screens, triggered alongside score-appropriate audio:
    * `10/10`: `wheelWin` sound + Success haptic + spring pop
    * `9+`: `success` sound + Success haptic + scale pop
    * `7+`: `match` sound + Medium haptic + scale pop
    * `<5`: `wrong` sound + Warning haptic + shake
    * default: `tileFlip` sound + Selection haptic + scale pop
* **Modified Files:**
  * [ResultsScoreboard.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/ResultsScoreboard.tsx)
  * [SharedGameComponents.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/SharedGameComponents.tsx)
  * [SoundMatchSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/SoundMatchSession.tsx)
  * [ColorMatchSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/ColorMatchSession.tsx)
  * [ColorTrapSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/ColorTrapSession.tsx)
  * [DrawRushSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/DrawRushSession.tsx)
  * [DrumChallengeSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/DrumChallengeSession.tsx)
  * [EyeSightSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/EyeSightSession.tsx)
  * [ImposterSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/ImposterSession.tsx)
  * [MemoryGridSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/MemoryGridSession.tsx)
  * [MemoryPathSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/MemoryPathSession.tsx)
  * [ReactionTimeSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/ReactionTimeSession.tsx)
  * [SpinBottleSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/SpinBottleSession.tsx)
  * [TapInOrderSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/TapInOrderSession.tsx)
  * [TenTangleSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/TenTangleSession.tsx)
  * [PassGuessSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/PassGuessSession.tsx)
  * [DEVLOG.md](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/DEVLOG.md)

### v1.9.0 - Color Match Swatch Adjustments & Onboarding Show-Once Fix
* **Date:** June 24, 2026
* **Commit:** `4420887`
* **Changes:**
  * **Onboarding Show-Once:** Fixed redirection logic in RootLayout (`app/_layout.tsx`) to check `hasCompletedOnboarding` from the settings store. Now the onboarding screens only show up once per user instead of on every fresh app launch.
  * **Color Match Swatch Updates:**
    * Removed the target swatch (question mark circle) from the recreate phase screen.
    * Enlarged the player guess swatch to a prominent `250x250` circular display on the recreate screen.
    * Enlarged the target and guess swatches to `190x190` on the roundResult screen, with an adjusted overlap spacing of `-60` for premium layout harmony.
  * **White Submit Button:** Styled the "Submit Match" button background to premium solid white with `#121212` text color.
* **Modified Files:**
  * [_layout.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/app/_layout.tsx)
  * [ColorMatchSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/ColorMatchSession.tsx)
  * [DEVLOG.md](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/DEVLOG.md)

### v1.8.0 - Sound Match Precise Adjustments & Touch Bugfix
* **Date:** June 24, 2026
* **Commit:** `5111a6e`
* **Changes:**
  * **Taller Slider:** Increased vertical slider height `SLIDER_HEIGHT` to `Math.min(SCREEN_HEIGHT * 0.52, 430)` to allow more precise drag adjustments.
  * **Fine-Tuning Arrows:** Added chevron up/down buttons above and below the slider to allow adjustments step-by-step by 1 Hz. Tapping these buttons plays the adjusted tone.
  * **Absolute pageY Touch Logic:** Replaced the target-relative `locationY` drag logic with screen-absolute `pageY` relative offset calculation on Touch Grant. This completely resolves the pointer duplication, blinking, and jumping bugs when dragging.
  * **Circle Play Interaction:** Made the frequency display circle clickable in the recreate phase to play the currently selected guess frequency.
  * **Updated DEVLOG:** Documented full version history and versioning tracking.
* **Modified Files:**
  * [SoundMatchSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/SoundMatchSession.tsx)
  * [DEVLOG.md](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/DEVLOG.md)

### v1.7.0 - Premium UI Redesign (Color & Sound Match)
* **Date:** June 24, 2026
* **Commit:** `08c88de`
* **Changes:**
  * **Color Match Sliders:** Upgraded slider inputs with descriptive icons (`paintpalette.fill`, `drop.fill`, `sun.max.fill`) and a Figma/Sketch-style inner preview dot inside the slider thumbs that dynamically shows the current guess color.
  * **Sound Match Visualizer:** Added a symmetrical pulsing audio wave visualizer inside the memorize phase, and a dynamic color wave visualizer in the recreate phase.
  * **Gradient Accents:** Applied linear gradients on the "Ready", "Submit", and "Continue" buttons.
* **Modified Files:**
  * [ColorMatchSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/ColorMatchSession.tsx)
  * [SoundMatchSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/SoundMatchSession.tsx)

### v1.6.0 - Sound Match Recreate Phase Polish
* **Date:** June 24, 2026
* **Commit:** `f708e3e`
* **Changes:**
  * Removed the target replay button during the recreate phase of the Sound Match game so players cannot listen to the target tone while adjusting their frequency guess.
* **Modified Files:**
  * [SoundMatchSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/SoundMatchSession.tsx)

### v1.5.0 - Sound Match Vertical Slider & Live Audio
* **Date:** June 23, 2026
* **Commit:** `21434aa`
* **Changes:**
  * Replaced the horizontal slider with a vertical, full-height synthesizer-style frequency slider.
  * Implemented responsive debounced auto-play on drag release (plays frequency immediately when finger is lifted).
* **Modified Files:**
  * [SoundMatchSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/SoundMatchSession.tsx)

### v1.4.0 - Color Match Swatch Size Adjustments
* **Date:** June 23, 2026
* **Commit:** `f467950`
* **Changes:**
  * Increased memorize color swatch size to `280x280` for better visibility.
  * Made swatches overlap with a offset in recreate and result screens (`160x160` size).
* **Modified Files:**
  * [ColorMatchSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/ColorMatchSession.tsx)

### v1.3.0 - Sound Match Game Added
* **Date:** June 23, 2026
* **Commit:** `eda2908`
* **Changes:**
  * Created the Sound Match game matching the dialled.gg style, generating sine waves via custom platform-safe base64 WAV buffers and comparing frequencies logarithmically.
* **Modified Files:**
  * [SoundMatchSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/SoundMatchSession.tsx)

### v1.2.0 - Color Match Game Added
* **Date:** June 23, 2026
* **Commit:** `e3c991d`
* **Changes:**
  * Created the Color Match game using HSB hue, saturation, and brightness controls and calculating closeness score using cylindrical HSV coordinates.
* **Modified Files:**
  * [ColorMatchSession.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/ColorMatchSession.tsx)

### v1.1.0 - Shuffle Button in Player Setup
* **Date:** June 23, 2026
* **Commit:** `2024f83`
* **Changes:**
  * Added a "Shuffle" button to the player setup screen to randomly shuffle the turn order.
* **Modified Files:**
  * [UnifiedSetupComponents.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/src/components/games/UnifiedSetupComponents.tsx)

### v1.0.0 - Fixes, Skip Context & Initial Commit
* **Date:** June 23, 2026
* **Commits:** `d5b4700` down to `6b55c65`
* **Changes:**
  * Implemented platform-wide game turn skipping context `GameSkipContext`.
  * Fixed player setup deletion bugs and empty turns.
  * Added cards swipe controls, custom card creation modal, and talk cards expansion.
