const { execSync } = require('child_process');
const path = require('path');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpegPath = ffmpegInstaller.path;

const whitneySrc = 'whitney.webm';
const whitneyDest = 'assets/sounds/whitney_challenge.wav';

// Retrim whitney with fade
console.log('Trimming Whitney...');
execSync(`"${ffmpegPath}" -y -i "${whitneySrc}" -ss 00:02:58.700 -t 15 -af "afade=t=in:ss=0:d=1,afade=t=out:st=14:d=1" "${whitneyDest}"`, { stdio: 'inherit' });

// Download Phil Collins
console.log('Downloading Phil Collins...');
execSync(`.\\yt-dlp.exe -f "bestaudio" -o "phil.%(ext)s" https://www.youtube.com/watch?v=YkADj0TPrJA`, { stdio: 'inherit' });

// Trim Phil Collins (hit around 3:16)
// Let's start at 3:05, hit is around 3:15.500 (10.5s in)
const philSrc = 'phil.webm'; // yt-dlp usually downloads webm for bestaudio
const philDest = 'assets/sounds/phil_challenge.wav';
console.log('Trimming Phil Collins...');
try {
  execSync(`"${ffmpegPath}" -y -i "${philSrc}" -ss 00:03:05.000 -t 15 -af "afade=t=in:ss=0:d=1,afade=t=out:st=14:d=1" "${philDest}"`, { stdio: 'inherit' });
} catch (e) {
  // If it downloaded as m4a
  execSync(`"${ffmpegPath}" -y -i "phil.m4a" -ss 00:03:05.000 -t 15 -af "afade=t=in:ss=0:d=1,afade=t=out:st=14:d=1" "${philDest}"`, { stdio: 'inherit' });
}

// Generate Metronome
// 120 BPM = 2 beats per second. 1 beat = 0.5s.
// We want 16 beats (8 seconds) of ticks, then 4 seconds of silence, and we'll play for 14 seconds total.
// To do this, we can generate a 1-second file with a tick, loop it 16 times, and then append silence.
// ffmpeg has aebsynth or we can use Node buffer!
console.log('Done audio gen');
