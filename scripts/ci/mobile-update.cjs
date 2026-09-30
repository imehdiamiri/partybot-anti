const fs = require('node:fs');
const { spawnSync, execFileSync } = require('node:child_process');
const track = process.env.UPDATE_TRACK;
if (!['expo-go-sdk57', 'native-preview'].includes(track)) throw new Error('Unknown update track');
const expoGo = track === 'expo-go-sdk57';
process.env.APP_VARIANT = expoGo ? 'expo-go' : 'preview';
const channel = expoGo ? 'expo-go-sdk57' : 'preview';
function eas(args) {
  const result = spawnSync('eas', args, { cwd: 'expo', env: process.env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`EAS ${args[0]} failed; verify the Expo account, channel and credentials.`);
  return JSON.parse(result.stdout);
}
const channelResult = eas(['channel:view', channel, '--json', '--non-interactive']);
const mapping = channelResult.currentPage || channelResult;
if (mapping.isPaused) throw new Error('Channel is paused; do not publish automatically');
const branches = mapping.updateBranches || [];
if (!branches.some(b => b.name === channel)) throw new Error(`Channel ${channel} is not mapped to the expected branch`);
const config = JSON.parse(fs.readFileSync('expo/app.json', 'utf8')).expo;
if (expoGo) {
  const pkg = JSON.parse(fs.readFileSync('expo/package.json', 'utf8'));
  if (!/^[~^]?57\./.test(pkg.dependencies.expo)) throw new Error('Expo Go track only supports SDK 57');
} else {
  for (const platform of ['android', 'ios']) {
    const builds = eas(['build:list', '--platform', platform, '--build-profile', 'preview', '--status', 'finished', '--limit', '1', '--json', '--non-interactive']);
    const build = builds[0];
    if (!build || build.appVersion !== config.version || !build.gitCommitHash) throw new Error(`No verified ${platform} preview build matches ${config.version}`);
    if (build.runtimeVersion && build.runtimeVersion !== config.version) throw new Error('Build runtime mismatch');
    execFileSync('git', ['cat-file', '-e', `${build.gitCommitHash}^{commit}`]);
    const changed = execFileSync('git', ['diff', '--name-only', build.gitCommitHash, process.env.GITHUB_SHA, '--',
      'expo/package.json', 'expo/package-lock.json', 'expo/app.json', 'expo/app.config.js', 'expo/eas.json', 'expo/plugins', 'expo/ios', 'expo/android'], { encoding: 'utf8' });
    if (changed.trim()) throw new Error(`Native configuration changed since ${platform} build; create a compatible binary before OTA.`);
  }
}
if (process.env.PUBLISH_UPDATE !== 'true') {
  console.log(`Compatibility inspected for ${track}; no update published.`);
} else {
  // Recheck immediately before publishing after any dependency/build inspections.
  execFileSync(process.execPath, ['scripts/ci/current-main.cjs'], { env: process.env, stdio: 'inherit' });
  const result = eas(['update', '--branch', channel, '--environment', 'preview', '--platform', 'all', '--message', `CI ${process.env.GITHUB_SHA}`, '--non-interactive', '--json']);
  const entries = Array.isArray(result) ? result : [result];
  const receipt = entries.map(x => ({ id: x.id, group: x.group, platform: x.platform, runtimeVersion: x.runtimeVersion }));
  const text = `EAS confirmed update on ${channel}:\n\n\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\`\n`;
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
}
