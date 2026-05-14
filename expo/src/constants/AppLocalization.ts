/**
 * AppLocalization — matches iOS AppLocalization.swift
 * Centralized string registry for UI text. Currently English-only,
 * structured for future i18n expansion.
 */

export type AppCopyKey =
  | 'gamesTab'
  | 'lobbyTab'
  | 'friendsTab'
  | 'walletTab'
  | 'profileTitle'
  | 'done'
  | 'settingsTitle'
  | 'accountTitle'
  | 'accountSubtitle'
  | 'languageTitle'
  | 'languageSubtitle'
  | 'soundTitle'
  | 'vibrationTitle'
  | 'logout'
  | 'guestMode'
  | 'providerPrefix'
  | 'publicID'
  | 'username'
  | 'displayName'
  | 'email'
  | 'avatar'
  | 'saveChanges'
  | 'save'
  | 'cancel'
  | 'profileSaved'
  | 'languageEnglish'
  | 'signInTitle'
  | 'signInSubtitle'
  | 'continueAsGuest'
  | 'usernamePlaceholder'
  | 'passwordPlaceholder'
  | 'login'
  | 'createAccount'
  | 'continueWithGoogle'
  | 'loginLater'
  | 'skipLogin'
  | 'accountSection'
  | 'appLanguageSection'
  | 'preferencesSection'
  | 'settingsInsideProfile'
  | 'numericIDHint'
  | 'guestEditHint'
  | 'connectedEditHint'
  | 'selectAvatar'
  | 'usernameOnlyHint'
  | 'publicIDLockedHint';

const EN: Record<AppCopyKey, string> = {
  gamesTab: 'Games',
  lobbyTab: 'Lobby',
  friendsTab: 'Friends',
  walletTab: 'Wallet',
  profileTitle: 'Profile',
  done: 'Done',
  settingsTitle: 'Settings',
  accountTitle: 'Account',
  accountSubtitle: 'Edit your public profile and app preferences.',
  languageTitle: 'Language',
  languageSubtitle: 'Choose how the app is shown.',
  soundTitle: 'Sound',
  vibrationTitle: 'Vibration',
  logout: 'Log out',
  guestMode: 'Guest mode',
  providerPrefix: 'Logged in with',
  publicID: 'Public ID',
  username: 'Username',
  displayName: 'Name',
  email: 'Email',
  avatar: 'Avatar',
  saveChanges: 'Save Changes',
  save: 'Save',
  cancel: 'Cancel',
  profileSaved: 'Profile updated.',
  languageEnglish: 'App language',
  signInTitle: 'Party Games',
  signInSubtitle: 'Jump in fast and keep testing the app.',
  continueAsGuest: 'Continue as Guest',
  usernamePlaceholder: 'Username',
  passwordPlaceholder: 'Password',
  login: 'Login',
  createAccount: 'Create account',
  continueWithGoogle: 'Continue with Google',
  loginLater: 'Login later',
  skipLogin: 'Skip login',
  accountSection: 'Account',
  appLanguageSection: 'App language',
  preferencesSection: 'Preferences',
  settingsInsideProfile: 'Settings are now inside profile.',
  numericIDHint: 'Numeric ID can be changed if available.',
  guestEditHint: 'Guest mode stays active. Changes are local on this device.',
  connectedEditHint: 'Profile edits sync to your account.',
  selectAvatar: 'Select Avatar',
  usernameOnlyHint: 'Only username can be changed.',
  publicIDLockedHint: 'Public ID is fixed and cannot be changed.',
};

// Future: add FA (Farsi), etc.
type AppLanguage = 'en';

const TABLES: Record<AppLanguage, Record<AppCopyKey, string>> = {
  en: EN,
};

/**
 * Get a localized string for the given key.
 * @param key - The string key to look up
 * @param language - Target language (default: 'en')
 */
export function t(key: AppCopyKey, language: AppLanguage = 'en'): string {
  return TABLES[language]?.[key] ?? EN[key] ?? '';
}
