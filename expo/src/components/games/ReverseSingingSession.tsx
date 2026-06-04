import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Alert, AppState, AppStateStatus } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PhaseTransition } from './PhaseTransition';
import { LiquidGlass } from '@/src/components/LiquidGlass';

// Platform-safe imports
let Audio: any = null;
let FileSystem: any = null;
let FileSystemEncoding: any = { Base64: 'base64', UTF8: 'utf8' };
let Sharing: any = null;

if (Platform.OS !== 'web') {
  try {
    const av = require('expo-av');
    Audio = av.Audio;
  } catch {}
  try {
    // SDK 54+: legacy API path for readAsStringAsync/writeAsStringAsync/getInfoAsync
    const fs = require('expo-file-system/legacy');
    FileSystem = fs;
    if (fs.EncodingType) {
      FileSystemEncoding = fs.EncodingType;
    }
  } catch {
    try {
      const fs = require('expo-file-system');
      FileSystem = fs;
      if (fs.EncodingType) {
        FileSystemEncoding = fs.EncodingType;
      }
    } catch {}
  }
  try { Sharing = require('expo-sharing'); } catch {}
}

interface Props {
  session: GameSession;
}

const MAX_RECORD_SECONDS = 60;
const WAVEFORM_BARS = [0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.3, 0.6, 0.5];

// ─── Audio Reversal (Pure JS, no WebView) ─────────────────

/**
 * Reverses audio data from a recorded file and outputs a WAV.
 * Supports WAV (RIFF/WAVE), CAF (iOS), and raw PCM fallback.
 * Uses native Hermes atob/btoa for performance.
 */
async function reverseAudioFile(inputUri: string): Promise<{ uri: string | null; error?: string }> {
  if (!FileSystem) return { uri: null, error: 'FileSystem not available' };

  try {
    // 1. Read file as base64
    const b64 = await FileSystem.readAsStringAsync(inputUri, {
      encoding: FileSystemEncoding.Base64,
    });
    if (!b64 || b64.length < 100) return { uri: null, error: `File too small (${b64?.length || 0} chars)` };

    // 2. Decode base64 → bytes
    const raw = atob(b64);
    const len = raw.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = raw.charCodeAt(i);

    // 3. Detect format and locate PCM data
    const magic = len > 4 ? String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) : '';
    const wavId = len > 12 ? String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) : '';

    let dataStart = 0;
    let dataLen = 0;
    let sampleRate = 44100;
    let channels = 1;
    let bitDepth = 16;
    let format = 'raw';

    if (magic === 'RIFF' && wavId === 'WAVE') {
      // ── WAV ──
      format = 'wav';
      let off = 12;
      while (off < len - 8) {
        const id = String.fromCharCode(bytes[off], bytes[off+1], bytes[off+2], bytes[off+3]);
        const sz = (bytes[off+4] | (bytes[off+5] << 8) | (bytes[off+6] << 16) | (bytes[off+7] << 24)) >>> 0;
        if (id === 'fmt ' && sz >= 16) {
          channels = bytes[off+10] | (bytes[off+11] << 8);
          sampleRate = (bytes[off+12] | (bytes[off+13] << 8) | (bytes[off+14] << 16) | (bytes[off+15] << 24)) >>> 0;
          bitDepth = bytes[off+22] | (bytes[off+23] << 8);
        } else if (id === 'data') {
          dataStart = off + 8;
          dataLen = Math.min(sz, len - dataStart);
          break;
        }
        off += 8 + sz + (sz % 2);
        if (off <= 12) break;
      }
    } else if (magic === 'caff') {
      // ── CAF (iOS) ──
      format = 'caf';
      let off = 8;
      while (off < len - 12) {
        const id = String.fromCharCode(bytes[off], bytes[off+1], bytes[off+2], bytes[off+3]);
        const szHi = ((bytes[off+4] << 24) | (bytes[off+5] << 16) | (bytes[off+6] << 8) | bytes[off+7]) >>> 0;
        const szLo = ((bytes[off+8] << 24) | (bytes[off+9] << 16) | (bytes[off+10] << 8) | bytes[off+11]) >>> 0;
        const isInf = szHi === 0xFFFFFFFF && szLo === 0xFFFFFFFF;
        const chunkLen = isInf ? (len - off - 12) : szLo;

        if (id === 'desc' && chunkLen >= 32) {
          const d = off + 12;
          // CAF Audio Description: sampleRate(f64) formatID(4) formatFlags(4) bytesPerPacket(4) framesPerPacket(4) channelsPerFrame(4) bitsPerChannel(4)
          try {
            const buf = new ArrayBuffer(8);
            const dv = new DataView(buf);
            for (let i = 0; i < 8; i++) dv.setUint8(i, bytes[d + i]);
            sampleRate = Math.round(dv.getFloat64(0, false));
          } catch {}
          // channelsPerFrame at offset 24, bitsPerChannel at offset 28
          channels = ((bytes[d+24] << 24) | (bytes[d+25] << 16) | (bytes[d+26] << 8) | bytes[d+27]) >>> 0;
          bitDepth = ((bytes[d+28] << 24) | (bytes[d+29] << 16) | (bytes[d+30] << 8) | bytes[d+31]) >>> 0;
        } else if (id === 'data') {
          dataStart = off + 12 + 4; // +4 for editCount
          dataLen = isInf ? (len - dataStart) : Math.max(0, chunkLen - 4);
          dataLen = Math.min(dataLen, len - dataStart);
          break;
        }
        off += 12 + chunkLen;
        if (chunkLen <= 0 && !isInf) break;
      }
    }

    // Raw PCM fallback: if we couldn't find data in any known format,
    // just skip the first 44 bytes (likely a header) and treat rest as PCM
    if (dataLen <= 0) {
      format = 'raw-fallback';
      dataStart = Math.min(44, len);
      dataLen = len - dataStart;
      sampleRate = 44100;
      channels = 1;
      bitDepth = 16;
    }

    // 4. Sanity
    if (channels <= 0) channels = 1;
    if (bitDepth <= 0) bitDepth = 16;
    if (sampleRate <= 0) sampleRate = 44100;
    const blockAlign = channels * (bitDepth / 8);
    if (blockAlign <= 0 || dataLen <= 0 || dataStart >= len) {
      return { uri: null, error: `Bad audio: fmt=${format} magic=${magic} dataStart=${dataStart} dataLen=${dataLen} len=${len}` };
    }
    dataLen = Math.min(dataLen, len - dataStart);

    const rawSize = Math.floor(dataLen / blockAlign) * blockAlign;
    const numSamples = Math.floor(rawSize / blockAlign);
    if (numSamples <= 0) {
      return { uri: null, error: `No samples: fmt=${format} rawSize=${rawSize} blockAlign=${blockAlign}` };
    }

    // 5. Build reversed WAV
    const outLen = 44 + rawSize;
    const out = new Uint8Array(outLen);

    // WAV header
    const s = (o: number, str: string) => { for (let i = 0; i < str.length; i++) out[o+i] = str.charCodeAt(i); };
    const u16 = (o: number, v: number) => { out[o] = v & 0xFF; out[o+1] = (v >> 8) & 0xFF; };
    const u32 = (o: number, v: number) => { out[o] = v & 0xFF; out[o+1] = (v >> 8) & 0xFF; out[o+2] = (v >> 16) & 0xFF; out[o+3] = (v >> 24) & 0xFF; };

    s(0, 'RIFF');
    u32(4, 36 + rawSize);
    s(8, 'WAVE');
    s(12, 'fmt ');
    u32(16, 16);
    u16(20, 1); // PCM
    u16(22, channels);
    u32(24, sampleRate);
    u32(28, sampleRate * blockAlign);
    u16(32, blockAlign);
    u16(34, bitDepth);
    s(36, 'data');
    u32(40, rawSize);

    // Reverse samples
    for (let i = 0; i < numSamples; i++) {
      const src = dataStart + i * blockAlign;
      const dst = 44 + (numSamples - 1 - i) * blockAlign;
      for (let b = 0; b < blockAlign; b++) {
        out[dst + b] = bytes[src + b];
      }
    }

    // 6. Encode to base64 (chunked — CHUNK must be multiple of 3 to avoid padding in middle!)
    let outB64 = '';
    const CHUNK = 24576; // 3 × 8192 — ensures no '=' padding between chunks
    for (let i = 0; i < outLen; i += CHUNK) {
      let bin = '';
      const end = Math.min(i + CHUNK, outLen);
      for (let j = i; j < end; j++) bin += String.fromCharCode(out[j]);
      outB64 += btoa(bin);
    }

    // 7. Write output
    const outputUri = inputUri.replace(/\.[^.]+$/, '_reversed.wav');
    await FileSystem.writeAsStringAsync(outputUri, outB64, {
      encoding: FileSystemEncoding.Base64,
    });

    // 8. Verify
    const info = await FileSystem.getInfoAsync(outputUri);
    if (!info.exists) return { uri: null, error: 'Output file not found after write' };
    return { uri: outputUri };

  } catch (err: any) {
    return { uri: null, error: err?.message || String(err) };
  }
}


// ─── Component ───────────────────────────────────────────

export function ReverseSingingSession({ session }: Props) {
  const p1Name = session.players[0]?.displayName || 'Player 1';
  const p2Name = session.players[1]?.displayName || 'Player 2';

  // Player 1 State
  const [p1Recording, setP1Recording] = useState<any>(null);
  const [p1Uri, setP1Uri] = useState<string | null>(null);
  const [p1ReversedUri, setP1ReversedUri] = useState<string | null>(null);
  const [p1Duration, setP1Duration] = useState(0);
  const [p1Reversing, setP1Reversing] = useState(false);

  // Player 2 State
  const [p2Recording, setP2Recording] = useState<any>(null);
  const [p2Uri, setP2Uri] = useState<string | null>(null);
  const [p2ReversedUri, setP2ReversedUri] = useState<string | null>(null);
  const [p2Duration, setP2Duration] = useState(0);
  const [p2Reversing, setP2Reversing] = useState(false);

  const [sound, setSound] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const p1RecRef = useRef<any>(null);
  const p2RecRef = useRef<any>(null);

  // ── Request mic permission ──
  useEffect(() => {
    if (!Audio) return;
    (async () => {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Microphone Access Needed', 'Please enable microphone access in Settings.');
      }
    })();
  }, []);

  // ── Recording timer ──
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (p1Recording) {
      interval = setInterval(() => {
        setP1Duration(prev => {
          if (prev >= MAX_RECORD_SECONDS) { stopRecording(1); return prev; }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [p1Recording]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (p2Recording) {
      interval = setInterval(() => {
        setP2Duration(prev => {
          if (prev >= MAX_RECORD_SECONDS) { stopRecording(2); return prev; }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [p2Recording]);

  // ── Sound cleanup ──
  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  // ── Stop recording on background ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') {
        if (p1RecRef.current) stopRecording(1);
        if (p2RecRef.current) stopRecording(2);
      }
    });
    return () => sub.remove();
  }, []);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (p1RecRef.current) try { p1RecRef.current.stopAndUnloadAsync(); } catch {}
      if (p2RecRef.current) try { p2RecRef.current.stopAndUnloadAsync(); } catch {}
      if (sound) try { sound.unloadAsync(); } catch {}
    };
  }, []);

  // ── Recording ──
  async function startRecording(player: 1 | 2) {
    if (!Audio) {
      Alert.alert('Audio Error', 'Audio module is not available.');
      return;
    }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const recordingOptions = {
        isMeteringEnabled: false,
        android: {
          extension: '.wav',
          outputFormat: 6,    // DEFAULT → let expo-av choose
          audioEncoder: 3,    // DEFAULT
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: 'lpcm',
          audioQuality: 127,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 705600,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);

      if (player === 1) {
        setP1Recording(recording);
        p1RecRef.current = recording;
        setP1Uri(null);
        setP1ReversedUri(null);
        setP1Duration(0);
        setP2Uri(null);
        setP2ReversedUri(null);
        setP2Duration(0);
      } else {
        setP2Recording(recording);
        p2RecRef.current = recording;
        setP2Uri(null);
        setP2ReversedUri(null);
        setP2Duration(0);
      }
    } catch (err: any) {
      Alert.alert('Audio Error', 'Could not start recording. Please try again.');
    }
  }

  async function stopRecording(player: 1 | 2) {
    try {
      const rec = player === 1 ? p1RecRef.current : p2RecRef.current;
      if (!rec) return;

      await rec.stopAndUnloadAsync();
      await new Promise(resolve => setTimeout(resolve, 400));

      const uri = rec.getURI();

      if (player === 1) {
        setP1Uri(uri);
        setP1Recording(null);
        p1RecRef.current = null;
      } else {
        setP2Uri(uri);
        setP2Recording(null);
        p2RecRef.current = null;
      }

      // Switch to playback mode BEFORE reversal
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });

      // Reverse the audio
      if (uri) {
        if (player === 1) setP1Reversing(true);
        else setP2Reversing(true);

        try {
          const result = await reverseAudioFile(uri);
          if (player === 1) setP1ReversedUri(result.uri);
          else setP2ReversedUri(result.uri);

          if (!result.uri) {
            Alert.alert('Reverse Failed', result.error || 'Unknown error');
          }
        } catch (e: any) {
          if (player === 1) setP1ReversedUri(null);
          else setP2ReversedUri(null);
          Alert.alert('Reverse Error', `${e?.message || 'Unknown error'}`);
        }

        if (player === 1) setP1Reversing(false);
        else setP2Reversing(false);
      }
    } catch (err: any) {
      console.error('[ReverseSinging] stopRecording error:', err?.message);
    }
  }

  // ── Playback ──
  async function playSound(uri: string | null, rate: number = 1.0) {
    if (!uri || !Audio) return;
    try {
      if (sound) { try { await sound.unloadAsync(); } catch {} setSound(null); }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { volume: 1.0 }
      );

      // Set rate AFTER loading — expo-av on some devices ignores rate in initial status
      if (rate !== 1.0) {
        await newSound.setRateAsync(rate, true, Audio.PitchCorrectionQuality?.High ?? 1);
      }

      setSound(newSound);
      setIsPlaying(true);
      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) setIsPlaying(false);
      });
      await newSound.playAsync();
    } catch (err: any) {
      setIsPlaying(false);
      Alert.alert('Playback Error', 'Could not play audio.');
    }
  }

  // ── Sharing ──
  async function handleShare(uri: string | null) {
    if (!uri || !Sharing) { Alert.alert('Share', 'No audio to share yet.'); return; }
    const available = await Sharing.isAvailableAsync();
    if (!available) { Alert.alert('Sharing not available'); return; }
    await Sharing.shareAsync(uri, { mimeType: 'audio/wav', dialogTitle: 'Share Recording' });
  }

  function showShareOptions() {
    const options: { label: string; uri: string | null }[] = [];
    if (p2Uri) options.push({ label: 'Share Player 2 Raw Mimic', uri: p2Uri });
    if (p2ReversedUri) options.push({ label: 'Share Result (Reversed Mimic)', uri: p2ReversedUri });
    else if (p1ReversedUri) options.push({ label: 'Share Reversed Player 1', uri: p1ReversedUri });

    if (options.length === 0) { Alert.alert('Nothing to share yet'); return; }
    if (options.length === 1) { handleShare(options[0].uri); return; }

    Alert.alert('Share', 'Choose what to share', [
      ...options.map(opt => ({ text: opt.label, onPress: () => handleShare(opt.uri) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  // ─── Render ───
  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      {/* Player 1 Card */}
      <LiquidGlass radius={24} style={[styles.card, styles.cardActive]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>{p1Name}</Text>
            <Text style={styles.cardSubtitle}>record anything you want</Text>
          </View>
          <View style={[styles.statusPill, p1Recording ? styles.statusRecording : p1Uri ? styles.statusDone : styles.statusActive]}>
            <Text style={styles.statusText}>{p1Recording ? 'Recording' : p1Uri ? 'Done' : 'Ready'}</Text>
          </View>
        </View>

        {p1Uri && (
          <View style={styles.waveformContainer}>
            <View style={styles.waveformBars}>
              {WAVEFORM_BARS.map((val, i) => (
                <View key={i} style={[styles.waveformBar, { height: Math.max(5, val * 24) }]} />
              ))}
            </View>
            <Text style={styles.durationText}>{p1Duration}.0s</Text>
          </View>
        )}

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <Pressable 
              style={[styles.squareBtn, { backgroundColor: p1Recording ? '#8E1C16' : Colors.red }]}
              onPress={() => p1Recording ? stopRecording(1) : startRecording(1)}
            >
              <IconSymbol name={p1Recording ? "stop.fill" : "record.circle.fill"} size={28} color="white" />
              <Text style={styles.btnText}>{p1Recording ? `${p1Duration}s / ${MAX_RECORD_SECONDS}s` : "Record"}</Text>
            </Pressable>

            <Pressable 
              style={[styles.circleBtn, !p1Uri && styles.disabled]}
              onPress={() => playSound(p1Uri)}
              disabled={!p1Uri}
            >
              <IconSymbol name="play.fill" size={24} color="white" />
            </Pressable>
          </View>

          <View style={styles.gridRow}>
            <Pressable 
              style={[styles.squareBtn, { backgroundColor: '#007AFF' }, (!p1ReversedUri && !p1Reversing) && styles.disabled]}
              onPress={() => playSound(p1ReversedUri)}
              disabled={!p1ReversedUri}
            >
              <IconSymbol name="backward.fill" size={28} color="white" />
              <Text style={styles.btnText}>{p1Reversing ? 'Reversing…' : 'Play Reverse'}</Text>
            </Pressable>

            <Pressable 
              style={[styles.circleBtn, !p1ReversedUri && styles.disabled]}
              onPress={() => playSound(p1ReversedUri, 0.5)}
              disabled={!p1ReversedUri}
            >
              <IconSymbol name="tortoise.fill" size={24} color="white" />
            </Pressable>
          </View>
        </View>
      </LiquidGlass>

      {/* Player 2 Card */}
      <LiquidGlass radius={24} style={[styles.card, styles.cardActive]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>{p2Name}</Text>
            <Text style={styles.cardSubtitle}>try to copy reversed</Text>
          </View>
          <View style={[styles.statusPill, p2Recording ? styles.statusRecording : p2Uri ? styles.statusDone : styles.statusActive]}>
            <Text style={styles.statusText}>{p2Recording ? 'Recording' : p2Uri ? 'Done' : 'Ready'}</Text>
          </View>
        </View>

        {p2Uri && (
          <View style={styles.waveformContainer}>
            <View style={styles.waveformBars}>
              {WAVEFORM_BARS.slice().reverse().map((val, i) => (
                <View key={i} style={[styles.waveformBar, { height: Math.max(5, val * 24), backgroundColor: '#AF52DE' }]} />
              ))}
            </View>
            <Text style={styles.durationText}>{p2Duration}.0s</Text>
          </View>
        )}

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <Pressable 
              style={[styles.squareBtn, { backgroundColor: p2Recording ? '#8E1C16' : Colors.red }]}
              onPress={() => p2Recording ? stopRecording(2) : startRecording(2)}
            >
              <IconSymbol name={p2Recording ? "stop.fill" : "record.circle.fill"} size={28} color="white" />
              <Text style={styles.btnText}>{p2Recording ? `${p2Duration}s / ${MAX_RECORD_SECONDS}s` : "Record Mimic"}</Text>
            </Pressable>

            <Pressable 
              style={[styles.circleBtn, !p2Uri && styles.disabled]}
              onPress={() => playSound(p2Uri)}
              disabled={!p2Uri}
            >
              <IconSymbol name="play.fill" size={24} color="white" />
            </Pressable>
          </View>

          <View style={styles.gridRow}>
            <Pressable 
              style={[styles.squareBtn, { backgroundColor: Colors.green }, (!p2ReversedUri && !p2Reversing) && styles.disabled]}
              onPress={() => playSound(p2ReversedUri)}
              disabled={!p2ReversedUri}
            >
              <IconSymbol name="sparkles" size={28} color="white" />
              <Text style={styles.btnText}>{p2Reversing ? 'Reversing…' : 'Result'}</Text>
            </Pressable>

            <Pressable 
              style={[styles.circleBtn, (!p2Uri && !p2ReversedUri) && styles.disabled]}
              onPress={showShareOptions}
              disabled={!p2Uri && !p2ReversedUri}
            >
              <IconSymbol name="square.and.arrow.up" size={24} color="white" />
            </Pressable>
          </View>
        </View>
      </LiquidGlass>

      {/* History Card */}
      <LiquidGlass radius={24} style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>History</Text>
            <Text style={styles.cardSubtitle}>Last 20 only</Text>
          </View>
          <Pressable style={styles.openBtn}>
            <Text style={styles.openBtnText}>Open</Text>
          </Pressable>
        </View>

        {p2Uri ? (
          <View style={styles.historyRow}>
            <View style={styles.historyDate}>
              <Text style={styles.historyDateText}>Just now</Text>
            </View>
            <View style={styles.historyActions}>
              <Pressable style={[styles.historyCircleBtn, { backgroundColor: '#FF2D55' }]} onPress={() => playSound(p2Uri)}>
                <IconSymbol name="mic.fill" size={16} color="white" />
              </Pressable>
              <Pressable style={[styles.historyCircleBtn, { backgroundColor: '#007AFF' }]} onPress={() => playSound(p2ReversedUri)}>
                <IconSymbol name="sparkles" size={16} color="white" />
              </Pressable>
              <Pressable style={styles.historyCircleBtn} onPress={showShareOptions}>
                <IconSymbol name="ellipsis" size={16} color="white" />
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyHistory}>No history yet.</Text>
        )}
      </LiquidGlass>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 20,
  },
  cardActive: {
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardTitle: {
    color: 'white',
    fontSize: 32,
    fontFamily: 'Viral-Black',
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  statusRecording: {
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
  },
  statusDone: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusText: {
    color: 'white',
    fontSize: 11,
    fontFamily: 'Viral-Black',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  waveformBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  waveformBar: {
    width: 3,
    backgroundColor: Colors.green,
    borderRadius: 2,
  },
  durationText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  grid: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  squareBtn: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 100,
  },
  btnText: {
    color: 'white',
    fontSize: 15,
    fontFamily: 'Viral-Black',
    marginTop: 12,
  },
  circleBtn: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.3,
  },
  openBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  openBtnText: {
    color: 'white',
    fontWeight: '600',
  },
  emptyHistory: {
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingVertical: 20,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 16,
  },
  historyDate: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  historyDateText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  historyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  historyCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
