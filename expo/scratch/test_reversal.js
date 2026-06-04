const fs = require('fs');

function testParserRefined(bytes) {
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const wave = bytes.length > 11 ? String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) : '';

  console.log(`Detected header: riff='${riff}', wave='${wave}'`);

  let dataOffset = 0;
  let dataSize = 0;
  let blockAlign = 2;
  let sampleRate = 44100;
  let numChannels = 1;
  let bitsPerSample = 16;

  if (riff === 'RIFF' && wave === 'WAVE') {
    let offset = 12;
    while (offset < bytes.length - 8) {
      const chunkId = String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]);
      const chunkSize = (bytes[offset+4] | (bytes[offset+5] << 8) | (bytes[offset+6] << 16) | (bytes[offset+7] << 24)) >>> 0;
      console.log(`WAV Chunk: '${chunkId}', Size: ${chunkSize}`);
      
      if (chunkId === 'fmt ') {
         numChannels = bytes[offset + 10] | (bytes[offset + 11] << 8);
         sampleRate = (bytes[offset + 12] | (bytes[offset + 13] << 8) | (bytes[offset + 14] << 16) | (bytes[offset + 15] << 24)) >>> 0;
         bitsPerSample = bytes[offset + 22] | (bytes[offset + 23] << 8);
         if (numChannels > 0 && bitsPerSample > 0) {
           blockAlign = (bitsPerSample / 8) * numChannels;
         }
      } else if (chunkId === 'data') {
         dataOffset = offset + 8;
         dataSize = chunkSize;
         break;
      }
      const advance = 8 + chunkSize + (chunkSize % 2 !== 0 ? 1 : 0);
      if (advance <= 0) break;
      offset += advance;
    }
  } else if (riff === 'caff') {
    let offset = 8;
    while (offset < bytes.length - 12) {
      const chunkId = String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]);
      const chunkSizeHi = ((bytes[offset+4] << 24) | (bytes[offset+5] << 16) | (bytes[offset+6] << 8) | bytes[offset+7]) >>> 0;
      const chunkSizeLo = ((bytes[offset+8] << 24) | (bytes[offset+9] << 16) | (bytes[offset+10] << 8) | bytes[offset+11]) >>> 0;
      
      const isInfinite = chunkSizeHi === 0xFFFFFFFF && chunkSizeLo === 0xFFFFFFFF;
      const chunkSize = isInfinite ? (bytes.length - offset - 12) : chunkSizeLo;
      console.log(`CAF Chunk: '${chunkId}', Size: ${chunkSize} (isInfinite: ${isInfinite})`);

      if (chunkId === 'desc' && chunkSize >= 32) {
         const descBase = offset + 12;
         const ch = ((bytes[descBase+24] << 24) | (bytes[descBase+25] << 16) | (bytes[descBase+26] << 8) | bytes[descBase+27]) >>> 0;
         const bits = ((bytes[descBase+28] << 24) | (bytes[descBase+29] << 16) | (bytes[descBase+30] << 8) | bytes[descBase+31]) >>> 0;
         if (ch > 0 && bits > 0) {
           numChannels = ch;
           bitsPerSample = bits;
           blockAlign = (bits / 8) * ch;
         }
      } else if (chunkId === 'data') {
         dataOffset = offset + 12 + 4; // 12 bytes chunk header + 4 bytes edit count
         if (isInfinite) {
            dataSize = bytes.length - dataOffset;
         } else {
            dataSize = chunkSize > 4 ? chunkSize - 4 : bytes.length - dataOffset;
         }
         break;
      }
      const advance = 12 + chunkSize;
      if (advance < 12) {
        console.log("Error: advance is less than 12, breaking to prevent infinite loop");
        break;
      }
      offset += advance;
    }
  }

  console.log(`Parsed details: dataOffset=${dataOffset}, dataSize=${dataSize}, blockAlign=${blockAlign}, channels=${numChannels}, bits=${bitsPerSample}`);
}

// 1. Create simulated CAF file
const simulatedCaf = new Uint8Array(200);
simulatedCaf.set([99, 97, 102, 102], 0); // 'caff'
simulatedCaf.set([0, 1, 0, 0], 4);
simulatedCaf.set([100, 101, 115, 99], 8); // 'desc'
simulatedCaf.set([0, 0, 0, 0, 0, 0, 0, 32], 12);
simulatedCaf.set([108, 112, 99, 109], 28); // 'lpcm'
simulatedCaf.set([0, 0, 0, 1], 44); // channels
simulatedCaf.set([0, 0, 0, 16], 48); // bits

simulatedCaf.set([100, 97, 116, 97], 52); // 'data'
simulatedCaf.set([255, 255, 255, 255, 255, 255, 255, 255], 56); // size: -1
simulatedCaf.set([0, 0, 0, 0], 64);
for(let i=68; i<200; i++) simulatedCaf[i] = i;

console.log("--- Test Refined with Simulated Infinite CAF ---");
testParserRefined(simulatedCaf);

// 2. Test normal size CAF
const simulatedCafNormal = new Uint8Array(200);
simulatedCafNormal.set(simulatedCaf.slice(0, 56));
simulatedCafNormal.set([0, 0, 0, 0, 0, 0, 0, 132], 56); // size 132
simulatedCafNormal.set(simulatedCaf.slice(64), 64);

console.log("\n--- Test Refined with Simulated Normal CAF ---");
testParserRefined(simulatedCafNormal);
