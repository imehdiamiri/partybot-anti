# PlayVirals (PartyBot) - Developer & Integration Guide

Welcome, Developer! This document outlines the technical architecture, technology stack, backend connections, environment configurations, and pre-launch guidelines for the PlayVirals (PartyBot) mobile application. 

---

## 🛠️ Technology Stack & Architecture

PlayVirals is a hybrid party game platform where players can play multi-player games either on a single device (Pass & Play) or synced across multiple devices.

### 1. Frontend Client
- **Framework:** React Native via **Expo (SDK 54)**.
- **Routing:** **Expo Router** (file-based navigation stack).
- **State Management:** **Zustand** stores (`useGameStore`, `useMultiplayerStore`, `useSettingsStore`, `usePaywallStore`).
- **UI & Theme:** Custom design system built with a glowing, premium dark theme (`#0D0D14` background), customized with transparent/blur overlays (`LiquidGlass` glassmorphism).
- **Animations:** **React Native Reanimated (3.x)** for micro-interactions, page transitions, and smooth scaling loops.

### 2. Backend & Synchronization
- **Authentication:** Firebase Auth (anonymous guests & standard credentials).
- **Realtime Networking:** Custom React Hook `useGameSync` connects the client to **Firebase Realtime Database** to broadcast room actions, turns, and scores.
- **Serverless Cloud Functions:** Firebase Cloud Functions (TypeScript) handles:
  - Game logic creation & LLM generation via **Gemini Pro API**.
  - Authoritative room matchmaking and lobby registration.

### 3. Monetization & Paywall
- **Billing SDK:** **RevenueCat (react-native-purchases)**.
- **Local Economy:** `usePaywallStore` manages local purchase flows and entitlement syncs.

---

## ⚙️ Environment Configuration & `.env`

To develop or build the application, create a `.env` file inside the `expo/` directory with the following variables:

```ini
# Firebase Config (Copy from Firebase Console -> Apps -> Web App Settings)
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=partybot-app.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=partybot-app
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=partybot-app.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
EXPO_PUBLIC_FIREBASE_APP_ID=1:12345:web:abcd
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://partybot-app-default-rtdb.firebaseio.com/

# Google Sign-In Client ID (Authentication -> Sign-in method -> Google)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456-abcdef.apps.googleusercontent.com

# RevenueCat API Keys (Public keys only)
# IMPORTANT: DO NOT use secret API keys (sk_...) in client env; it will throw backend errors.
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_abc123xyz
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_abc123xyz
```

---

## 🚀 Firebase Setup & Cloud Functions

### 1. Database Rules
The Realtime Database is used for rooms. Configure database rules to permit read/write access to `/rooms/$roomCode` with validation check on player existence:
```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": "true",
        ".write": "true"
      }
    }
  }
}
```

### 2. Deploying Functions
Cloud Functions reside under the `/functions` directory.
1. Navigate to the project root.
2. Log in and deploy:
   ```bash
   firebase login
   firebase deploy --only functions
   ```

### 3. Gemini AI Configuration (Secret)
The Gemini API key is stored securely in Firebase Secrets and is never exposed to the client. Configure it on the Firebase project before deployment:
```bash
firebase functions:secrets:set GEMINI_API_KEY
```

---

## 🛠️ Build Constraints & Dev Setup

### 1. JDK Version (Crucial for Android compilation)
Gradle build tasks in Expo require **JDK 21**. Newer versions (like Java 26) cause major compilation failures (`Unsupported class file major version 70`).
- Always run the Android build command prepending JDK 21 to the environment:
  ```powershell
  $env:JAVA_HOME = "D:\Android Studio\jbr"; $env:Path = "$env:JAVA_HOME\bin;$env:Path"; npm run android
  ```

### 2. Android SDK Path (`local.properties`)
Android builds look at `expo/android/local.properties`. Ensure the path uses forward slashes to prevent escape character parsing errors:
```properties
sdk.dir=C:/Users/Mehdi/AppData/Local/Android/Sdk
```

### 3. Expo Autolinking Exclusion
`expo-location` was excluded from autolinking in `expo/package.json` to prevent build crashes related to outdated transitives under `@teovilla/react-native-web-maps`:
```json
"expo": {
  "autolinking": {
    "exclude": ["expo-location"]
  }
}
```

---

## 🏁 Pre-Launch Checklist

Before creating a production bundle (release build), revert these temporary developer bypasses:

- [ ] **Onboarding Bypass:** In [_layout.tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/app/_layout.tsx), remove:
  ```typescript
  useSettingsStore.getState().setHasCompletedOnboarding(false);
  ```
  *(This is currently forcing the onboarding walkthrough on every reload).*
- [ ] **Premium Games Unlock:** In [game/[id].tsx](file:///d:/VC%20PROJECT/PlayVirals/PlayBot%20Antigravity/expo/app/(tabs)/game/[id].tsx), remove:
  ```typescript
  const isPremium = true;
  ```
  *(This bypasses RevenueCat check for testing; restore the actual entitlement subscription check).*
- [ ] **Public Keys Check:** Confirm the RevenueCat keys in `.env` are public keys (`goog_...` and `appl_...`) and not secret keys (`sk_...`).

---

## 💻 Developer Command Reference

Run these commands inside the `expo/` directory:

| Command | Description |
| :--- | :--- |
| `npm run android` | Starts Metro, compiles the dev build, and runs on Android emulator (uses JDK 21). |
| `npm run ios` | Starts Metro and runs on iOS simulator. |
| `npm start` | Launches the Metro development bundler server. |
| `npm run typecheck` | Validates TypeScript configuration and types. |
| `npx expo start --clear` | Clears Metro cache (useful if hot reloads stop updating). |
