const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const videoUrl = 'https://www.youtube.com/watch?v=3JWTaaS7LdU';
const outputFile = path.join(__dirname, 'assets', 'sounds', 'whitney_challenge.wav');

// The drum hit in the official video happens around 3:10
// We want to capture the buildup starting around 3:00 to 3:15
const startTime = '00:03:00';
const duration = 15; // 15 seconds

console.log('Downloading and trimming audio from YouTube...');

const stream = ytdl(videoUrl, {
  quality: 'highestaudio',
  filter: 'audioonly',
});

ffmpeg(stream)
  .setStartTime(startTime)
  .setDuration(duration)
  .output(outputFile)
  .on('end', () => {
    console.log('Audio downloaded and trimmed successfully to:', outputFile);
  })
  .on('error', (err) => {
    console.error('Error downloading audio:', err);
  })
  .run();
