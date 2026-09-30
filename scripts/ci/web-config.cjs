const fs = require('node:fs');
const config = JSON.parse(process.env.EXPO_PUBLIC_CONFIG || '{}');
const names = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID', 'FIREBASE_DATABASE_URL', 'GOOGLE_WEB_CLIENT_ID'].map(n => `EXPO_PUBLIC_${n}`);
for (const name of names) {
  if (typeof config[name] !== 'string' || !config[name] || /[\r\n]/.test(config[name])) throw new Error(`Missing/invalid public client configuration: ${name}`);
}
if (config.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== 'partyplay-8') throw new Error('Unexpected Firebase project');
// Allowlist public client configuration only. Private and RevenueCat keys cannot enter this export.
fs.writeFileSync('expo/.env.local', names.map(n => `${n}=${JSON.stringify(config[n])}`).join('\n') + '\n');
console.log('Public web client configuration installed; values omitted.');
