const { test } = require('node:test');
const assert = require('node:assert/strict');
const { needsWeb } = require('./deployment-scope.cjs');

test('backend and rule-only batches never deploy the web artifact', () => {
  assert.equal(needsWeb(['functions/index.js', 'functions/package-lock.json', 'database.rules.json', 'RELEASE_LOG.md']), false);
});
test('mixed batches and web removals still rebuild web', () => {
  assert.equal(needsWeb(['functions/index.js', 'expo/src/old.ts']), true);
  assert.equal(needsWeb(['website/public/privacy.html']), true);
});
test('deployment configuration and unknown paths fail conservatively', () => {
  for (const path of ['firebase.json', 'sync-web-build.js', '.github/workflows/ci.yml', 'scripts/ci/web-config.cjs', 'new-runtime/config.json']) {
    assert.equal(needsWeb([path]), true, path);
  }
});
