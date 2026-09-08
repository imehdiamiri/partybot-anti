// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', '.expo/**', 'android/**', 'ios/**'],
  },
  {
    files: ['src/__tests__/**/*.{js,ts,tsx}'],
    languageOptions: {
      globals: Object.fromEntries(['jest', 'test', 'it', 'expect', 'describe', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'].map(name => [name, 'readonly'])),
    },
  },
]);
