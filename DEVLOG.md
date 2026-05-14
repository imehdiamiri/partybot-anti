# 🛠️ PlayVirals DevLog

## 🚀 Pre-Launch / Production Checklist

The following items are temporary developer bypasses that **MUST BE REMOVED** before publishing to the App Store / Google Play:

- [ ] **Onboarding Bypass:** Remove `useSettingsStore.getState().setHasCompletedOnboarding(false);` in `expo/app/_layout.tsx`. Currently, it's forcing the onboarding screen to show on every app load for testing the new UI.
- [ ] **Premium Games Lock:** Remove the temporary `const isPremium = true;` bypass in `expo/app/(tabs)/game/[id].tsx`. The app needs to correctly check RevenueCat/EconomyStore so free users hit the paywall.
