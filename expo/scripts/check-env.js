#!/usr/bin/env node
/**
 * Pre-build env safety guard.
 *
 * Fails the build if any AI / private secret has accidentally been promoted
 * to an EXPO_PUBLIC_* variable (which Expo bundles into the client JS).
 *
 * Run from CI / `bun run prebuild`:
 *   node ./scripts/check-env.js
 *
 * Exits with code 1 if a leak is detected so the build pipeline aborts.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FORBIDDEN_PUBLIC_KEYS = [
  'EXPO_PUBLIC_GEMINI_API_KEY',
  'EXPO_PUBLIC_OPENAI_API_KEY',
  'EXPO_PUBLIC_ANTHROPIC_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_SECRET',
  'EXPO_PUBLIC_FIREBASE_SERVICE_ACCOUNT',
  'EXPO_PUBLIC_FIREBASE_ADMIN_KEY',
  // Legacy backend secrets that should never come back into the client.
  'EXPO_PUBLIC_SUPABASE_SERVICE_KEY',
];

const FORBIDDEN_VALUE_PATTERNS = [
  // Loose-ish probe for a Google API key shape leaking into a public var.
  { name: 'Google API key', regex: /^AIza[0-9A-Za-z_-]{30,}$/ },
];

const errors = [];

function checkEnvText(label, text) {
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^"|"$/g, '');

    if (FORBIDDEN_PUBLIC_KEYS.includes(key)) {
      errors.push(`${label}: forbidden public key "${key}" — secrets must live in Cloud Function secrets, not the client bundle.`);
      continue;
    }

    if (key.startsWith('EXPO_PUBLIC_GEMINI')) {
      errors.push(`${label}: any EXPO_PUBLIC_GEMINI* variable is forbidden ("${key}"). Move it server-side.`);
    }

    // Firebase Web API keys are public-by-design (locked down via API
    // restrictions + RTDB/Firestore rules) so allow them through the
    // Google-API-key shape check.
    const isFirebaseWebKey = key === 'EXPO_PUBLIC_FIREBASE_API_KEY';
    if (key.startsWith('EXPO_PUBLIC_') && !isFirebaseWebKey) {
      for (const pat of FORBIDDEN_VALUE_PATTERNS) {
        if (pat.regex.test(value)) {
          errors.push(`${label}: ${key} value matches ${pat.name} pattern. Public env vars are bundled into the client.`);
        }
      }
    }
  }
}

function readIfExists(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

const cwd = process.cwd();
const candidates = [
  path.resolve(cwd, '.env'),
  path.resolve(cwd, '.env.local'),
  path.resolve(cwd, '.env.production'),
  path.resolve(cwd, 'expo/.env'),
];

for (const file of candidates) {
  const text = readIfExists(file);
  if (text != null) checkEnvText(path.relative(cwd, file) || file, text);
}

// Also scan process.env for the same patterns so EAS / CI envs are caught.
const processSnapshot = Object.entries(process.env)
  .map(([k, v]) => `${k}=${v ?? ''}`)
  .join('\n');
checkEnvText('process.env', processSnapshot);

if (errors.length > 0) {
  console.error('\n[check-env] Public env safety check FAILED:\n');
  for (const e of errors) console.error('  ✗ ' + e);
  console.error('\nFix the offending entries and re-run the build.\n');
  process.exit(1);
}

console.log('[check-env] OK — no AI secrets bundled into public envs.');
