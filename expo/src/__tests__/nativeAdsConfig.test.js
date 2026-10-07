const path = require('node:path');
const { withPlugins, compileModsAsync } = require('@expo/config-plugins');
const app = require('../../app.json').expo;

test('AdMob prebuild selects a backend without reading the missing Gradle JSON extension', async () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const adsPlugin = app.plugins.find(p => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
  const config = withPlugins({ name: app.name, slug: app.slug, android: { package: app.android.package }, _internal: { projectRoot } }, [adsPlugin]);
  const generated = await compileModsAsync(config, {
    projectRoot, platforms: ['android'], introspect: true,
  });
  const mods = generated._internal.modResults.android;
  expect(mods.gradleProperties).toContainEqual({
    type: 'property', key: 'RNGMA_ANDROID_BACKEND', value: 'classic',
  });
  const metadata = mods.manifest.manifest.application[0]['meta-data'];
  expect(metadata).toEqual(expect.arrayContaining([
    expect.objectContaining({ $: expect.objectContaining({
      'android:name': 'com.google.android.gms.ads.APPLICATION_ID',
      'android:value': adsPlugin[1].androidAppId,
    }) }),
    expect.objectContaining({ $: expect.objectContaining({
      'android:name': 'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT',
      'android:value': 'true',
    }) }),
  ]));
});
