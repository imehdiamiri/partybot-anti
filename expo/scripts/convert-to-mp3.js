const { execSync } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpegPath = ffmpegInstaller.path;

console.log('Converting whitney...');
execSync(`"${ffmpegPath}" -y -i "assets/sounds/whitney_challenge.wav" -c:a libmp3lame -q:a 2 "assets/sounds/whitney_challenge.mp3"`, { stdio: 'inherit' });

console.log('Converting phil...');
execSync(`"${ffmpegPath}" -y -i "assets/sounds/phil_challenge.wav" -c:a libmp3lame -q:a 2 "assets/sounds/phil_challenge.mp3"`, { stdio: 'inherit' });

console.log('Done.');
