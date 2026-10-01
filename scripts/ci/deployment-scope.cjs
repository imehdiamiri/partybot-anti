const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function needsWeb(files) {
  // Unknown paths conservatively rebuild web. Backend and rules changes do not
  // change the static client artifact; they have separate deployment targets.
  return files.some(file => !(
    file.startsWith('functions/') ||
    ['database.rules.json', 'firestore.rules', 'firebase.security.json'].includes(file) ||
    file.endsWith('.md') || file.startsWith('docs/')
  ));
}

if (require.main === module) {
  let web = true;
  if (process.env.GITHUB_EVENT_NAME === 'push') {
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const before = event.before;
    const after = process.env.GITHUB_SHA;
    if (/^[a-f0-9]{40}$/.test(before || '') && !/^0+$/.test(before) && /^[a-f0-9]{40}$/.test(after || '')) {
      // --no-renames includes both names so a move out of web cannot evade it.
      const paths = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', before, after], { encoding: 'utf8' });
      web = needsWeb(paths.split('\0').filter(Boolean));
    }
  }
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `web=${web}\n`);
  console.log(web ? 'Web build eligible.' : 'Backend/rules/docs only: web build and deployment skipped.');
}

module.exports = { needsWeb };
