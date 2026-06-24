# 🛠️ PlayVirals DevLog

## 🚀 Pre-Launch / Production Checklist

The following items are temporary developer bypasses that **MUST BE REMOVED** before publishing to the App Store / Google Play:

- [ ] **Onboarding Bypass:** Remove `useSettingsStore.getState().setHasCompletedOnboarding(false);` in `expo/app/_layout.tsx`. Currently, it's forcing the onboarding screen to show on every app load for testing the new UI.
- [ ] **Premium Games Lock:** Remove the temporary `const isPremium = true;` bypass in `expo/app/(tabs)/game/[id].tsx`. The app needs to correctly check RevenueCat/EconomyStore so free users hit the paywall.

---

## 📜 Version History & Changelog

This log tracks all changes, feature additions, and fixes applied to the PlayVirals application, allowing easy rollbacks and traceability.

### v1.8.0 - Sound Match Precise Adjustments & Touch Bugfix
* **Date:** June 24, 2026
* **Commit:** (Pending commit)
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
