import { useGameActivity } from './GameActivity';
import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Alert, AppState, AppStateStatus } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrowserRecordingPlayback } from '@/src/utils/browserRecordingPlayback';
import { LiquidGlass } from '@/src/components/LiquidGlass';
import { isWeb } from '@/src/utils/platform';
import { WebAudioRecorder, isWebMediaRecorderSupported, revokeWebAudioUrl } from '@/src/utils/browserMediaAdapter';
import { canStartReverseTake } from '@/src/utils/reverseSingingFlow';

// Platform-safe imports
let Audio: any = null;
let FileSystem: any = null;
let FileSystemEncoding: any = { Base64: 'base64', UTF8: 'utf8' };
let Sharing: any = null;

if (Platform.OS !== 'web') {
  try {
    const av = require('@/src/services/GameAudio');
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
  const [captureBusy, setCaptureBusy] = useState(false);
  const captureOperation = useRef(false);
  const mounted = useRef(true);
  const playbackGeneration = useRef(0);
  const [micError, setMicError] = useState<string | null>(null);

  const soundRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const p1RecRef = useRef<any>(null);
  const p2RecRef = useRef<any>(null);
  const webRecorderRef = useRef<WebAudioRecorder | null>(null);
  const webPlaybackRef = useRef<BrowserRecordingPlayback | null>(null);
  if (!webPlaybackRef.current) webPlaybackRef.current = new BrowserRecordingPlayback();
  const trackedUrlsRef = useRef<Set<string>>(new Set());

  const registerTrackedUrl = (url?: string | null) => {
    if (url && url.startsWith('blob:')) {
      trackedUrlsRef.current.add(url);
    }
  };

  const revokeTrackedUrl = (url?: string | null) => {
    if (url && url.startsWith('blob:')) {
      webPlaybackRef.current?.forget(url);
      revokeWebAudioUrl(url);
      trackedUrlsRef.current.delete(url);
    }
  };

  const revokeAllTrackedUrls = () => {
    webPlaybackRef.current?.clear();
    for (const url of trackedUrlsRef.current) {
      revokeWebAudioUrl(url);
    }
    trackedUrlsRef.current.clear();
  };

  const p1Locked = !!p1Uri;
  const p2Ready = !!p1ReversedUri && !p1Recording && !p1Reversing;
  useGameActivity(p2Uri ? `${p1Name} & ${p2Name}` : p1Locked ? p2Name : p1Name, p2Uri ? 'result' : 'playing');
  const recordingNow = !!p1Recording || !!p2Recording;
  const controlsBusy = captureBusy || recordingNow || p1Reversing || p2Reversing;
  // Persistent source lock applies ONLY to Record. Already-created audio remains
  // playable while another take is being reversed, but not while the mic is live.
  const playbackBlocked = recordingNow || (captureBusy && !p1Reversing && !p2Reversing);

  async function stopPlayback() {
    playbackGeneration.current++;
    webPlaybackRef.current?.stop();
    const previous = soundRef.current;
    soundRef.current = null;
    if (previous) { try { await previous.unloadAsync(); } catch {} }
    setIsPlaying(false);
  }

  async function retryRound() {
    if (captureOperation.current || recordingNow || p1Reversing || p2Reversing) return;
    captureOperation.current = true;
    setCaptureBusy(true);
    try {
      await stopPlayback();
      revokeAllTrackedUrls();
      webRecorderRef.current?.revokeAllCreatedUrls();
      setP1Uri(null); setP1ReversedUri(null); setP1Duration(0);
      setP2Uri(null); setP2ReversedUri(null); setP2Duration(0);
      setP1Recording(null); setP2Recording(null);
      setMicError(null);
    } finally { captureOperation.current = false; setCaptureBusy(false); }
  }

  // ── Request mic permission ──
  useEffect(() => {
    if (isWeb) return;
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

  // ── Stop recording on background ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') {
        void stopPlayback();
        if (p1RecRef.current || (isWeb && p1Recording)) stopRecording(1);
        if (p2RecRef.current || (isWeb && p2Recording)) stopRecording(2);
      }
    });
    return () => sub.remove();
  }, [p1Recording, p2Recording]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      playbackGeneration.current++;
      if (p1RecRef.current) try { p1RecRef.current.stopAndUnloadAsync(); } catch {}
      if (p2RecRef.current) try { p2RecRef.current.stopAndUnloadAsync(); } catch {}
      if (soundRef.current) { void soundRef.current.unloadAsync().catch(() => {}); soundRef.current = null; }
      if (webRecorderRef.current) {
        try {
          webRecorderRef.current.cleanup();
          webRecorderRef.current.revokeAllCreatedUrls();
        } catch {}
        webRecorderRef.current = null;
      }
      webPlaybackRef.current?.clear();
      revokeAllTrackedUrls();
    };
  }, []);

  // ── Recording ──
  async function startRecording(player: 1 | 2) {
    if (!canStartReverseTake(player, p1Locked, p2Ready, captureOperation.current || recordingNow || p1Reversing || p2Reversing)) return;
    captureOperation.current = true;
    setCaptureBusy(true);
    try {
    await stopPlayback();
    if (isWeb) {
      if (!isWebMediaRecorderSupported()) {
        setMicError('Microphone recording is not supported in this browser. Please use Chrome, Safari, Firefox, or Edge.');
        return;
      }
      try {
        setMicError(null);
        if (!webRecorderRef.current) {
          webRecorderRef.current = new WebAudioRecorder();
        }
        await webRecorderRef.current.start();
        if (!mounted.current) { webRecorderRef.current?.cleanup(); return; }
        if (player === 1) {
          if (p1Uri) revokeTrackedUrl(p1Uri);
          if (p1ReversedUri) revokeTrackedUrl(p1ReversedUri);
          if (p2Uri) revokeTrackedUrl(p2Uri);
          if (p2ReversedUri) revokeTrackedUrl(p2ReversedUri);

          setP1Recording({} as any);
          setP1Uri(null);
          setP1ReversedUri(null);
          setP1Duration(0);
          setP2Uri(null);
          setP2ReversedUri(null);
          setP2Duration(0);
        } else {
          if (p2Uri) revokeTrackedUrl(p2Uri);
          if (p2ReversedUri) revokeTrackedUrl(p2ReversedUri);

          setP2Recording({} as any);
          setP2Uri(null);
          setP2ReversedUri(null);
          setP2Duration(0);
        }
      } catch (err: any) {
        setMicError(err?.message || 'Could not start recording. Please allow microphone access in your browser.');
      }
      return;
    }

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
          // GameAudio records real PCM WAV on both platforms; no compressed encoder.
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
      if (!mounted.current) { await recording.stopAndUnloadAsync(); return; }

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
    } finally {
      captureOperation.current = false;
      if (mounted.current) setCaptureBusy(false);
    }
  }

  async function stopRecording(player: 1 | 2) {
    if (captureOperation.current) return;
    captureOperation.current = true;
    setCaptureBusy(true);
    try {
    if (isWeb) {
      if (!webRecorderRef.current) return;
      if (player === 1) { setP1Reversing(true); setP1Recording(null); }
      else { setP2Reversing(true); setP2Recording(null); }

      try {
        const res = await webRecorderRef.current.stop();
        if (!mounted.current) { revokeWebAudioUrl(res.originalWavUri); revokeWebAudioUrl(res.reversedWavUri); return; }
        webPlaybackRef.current?.remember(res.originalWavUri, webRecorderRef.current.originalBuffer);
        webPlaybackRef.current?.remember(res.reversedWavUri, webRecorderRef.current.reversedBuffer);
        registerTrackedUrl(res.originalWavUri);
        registerTrackedUrl(res.reversedWavUri);

        const durSec = Math.max(1, Math.round(res.durationMs / 1000));
        if (player === 1) {
          setP1Uri(res.originalWavUri);
          setP1ReversedUri(res.reversedWavUri);
          setP1Duration(durSec);
          setP1Recording(null);
        } else {
          setP2Uri(res.originalWavUri);
          setP2ReversedUri(res.reversedWavUri);
          setP2Duration(durSec);
          setP2Recording(null);
        }
      } catch (err: any) {
        setMicError(err?.message || 'Failed to process audio. Please record again.');
      } finally {
        if (player === 1) setP1Reversing(false);
        else setP2Reversing(false);
      }
      return;
    }

    try {
      const rec = player === 1 ? p1RecRef.current : p2RecRef.current;
      if (!rec) return;

      await rec.stopAndUnloadAsync();

      const uri = rec.getURI();
      if (!mounted.current) return;

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
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, playThroughEarpieceAndroid: false });

      // Reverse the audio
      if (uri) {
        if (player === 1) setP1Reversing(true);
        else setP2Reversing(true);

        try {
          const result = await reverseAudioFile(uri);
          if (!mounted.current) return;
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
      setMicError(err?.message || 'Could not finish the recording. Please try again.');
    }
    } finally {
      captureOperation.current = false;
      if (mounted.current) {
        setCaptureBusy(false);
        if (player === 1) { setP1Recording(null); setP1Reversing(false); p1RecRef.current = null; }
        else { setP2Recording(null); setP2Reversing(false); p2RecRef.current = null; }
      }
    }
  }

  // ── Playback ──
  async function playSound(uri: string | null, rate: number = 1.0) {
    if (!uri || playbackBlocked) return;
    setMicError(null);
    const generation = ++playbackGeneration.current;

    if (isWeb) {
      try {
        const started = await webPlaybackRef.current!.play(uri, rate, () => {
          if (mounted.current && generation === playbackGeneration.current) setIsPlaying(false);
        });
        if (mounted.current && generation === playbackGeneration.current) setIsPlaying(started);
      } catch (error: any) {
        if (mounted.current && generation === playbackGeneration.current) {
          setIsPlaying(false);
          setMicError(error?.message || 'Could not play this recording. Tap Play to try again.');
        }
      }
      return;
    }

    if (!Audio) { setMicError('Audio playback is unavailable. Please reopen the game.'); return; }
    try {
      const previous = soundRef.current;
      soundRef.current = null;
      if (previous) { try { await previous.unloadAsync(); } catch {} }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, playThroughEarpieceAndroid: false });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { volume: 1.0 }
      );

      if (generation !== playbackGeneration.current || !mounted.current) { await newSound.unloadAsync(); return; }
      // Set rate after loading; discard playback overtaken by Retry or recording.
      if (rate !== 1.0) {
        await newSound.setRateAsync(rate, true, Audio.PitchCorrectionQuality?.High ?? 1);
      }
      if (generation !== playbackGeneration.current || !mounted.current) { await newSound.unloadAsync(); return; }
      soundRef.current = newSound;
      setIsPlaying(true);
      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish && generation === playbackGeneration.current && mounted.current) setIsPlaying(false);
      });
      await newSound.playAsync();
    } catch (err: any) {
      if (generation === playbackGeneration.current && mounted.current) {
        setIsPlaying(false);
        setMicError(err?.message || 'Could not play this recording. Tap Play to try again.');
      }
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
    <ScrollView testID="reverse-singing-content" contentContainerStyle={styles.container}>
      {micError && (
        <View testID="reverse-singing-mic-error" style={styles.errorBanner}>
          <IconSymbol name="exclamationmark.triangle.fill" size={20} color={Colors.yellow} />
          <Text style={styles.errorBannerText}>{micError}</Text>
          <Pressable testID="reverse-singing-dismiss-error" accessibilityRole="button" onPress={() => setMicError(null)}>
            <IconSymbol name="xmark" size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>
      )}

      {/* Player 1 Card */}
      <LiquidGlass radius={20} style={[styles.card, !p1Locked ? styles.cardActive : styles.cardLocked]}>
        <View style={styles.cardHeader}>
          <View style={styles.playerHeading}>
            <Text style={styles.cardTitle} numberOfLines={1}>{p1Name}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>Record anything you want</Text>
          </View>
          <View style={[styles.statusPill, p1Recording ? styles.statusRecording : p1Uri ? styles.statusDone : styles.statusActive]}>
            <Text style={styles.statusText}>{p1Recording ? 'Recording' : p1Uri ? 'Saved' : 'Ready'}</Text>
          </View>
        </View>

        {p1Uri && (
          <View style={styles.waveformContainer}>
            <View style={styles.waveformBars}>
              {WAVEFORM_BARS.map((val, i) => (
                <View key={i} style={[styles.waveformBar, { height: Math.max(3, val * 12) }]} />
              ))}
            </View>
            <Text style={styles.durationText}>{p1Duration}.0s</Text>
          </View>
        )}

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <Pressable 
              testID="reverse-singing-p1-record"
              accessibilityRole="button"
              disabled={captureBusy || p1Locked || !!p2Recording || p1Reversing || p2Reversing}
              style={[styles.squareBtn, { backgroundColor: p1Recording ? '#8E1C16' : Colors.red }, (p1Locked || captureBusy) && styles.disabled]}
              onPress={() => p1Recording ? stopRecording(1) : startRecording(1)}
            >
              <IconSymbol name={p1Recording ? "stop.fill" : p1Locked ? "lock.fill" : "record.circle.fill"} size={28} color="white" />
              <Text style={styles.btnText}>{p1Recording ? `Stop (${p1Name}) · ${p1Duration}s` : p1Locked ? `Recorded (${p1Name})` : `Record (${p1Name})`}</Text>
            </Pressable>

            {p1Locked && (
              <Pressable testID="reverse-singing-retry" accessibilityRole="button"
                accessibilityLabel="Retry round: clear both recordings"
                disabled={controlsBusy} onPress={retryRound}
                style={[styles.retryButton, controlsBusy && styles.disabled]}>
                <IconSymbol name="arrow.counterclockwise" size={24} color="#FFFFFF" />
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            )}

            <Pressable 
              testID="reverse-singing-p1-play"
              accessibilityRole="button"
              style={[styles.circleBtn, !p1Uri && styles.disabled]}
              onPress={() => playSound(p1Uri)}
              disabled={!p1Uri || playbackBlocked}
            >
              <IconSymbol name="play.fill" size={32} color="white" />
            </Pressable>
          </View>

          <View style={styles.gridRow}>
            <Pressable 
              testID="reverse-singing-p1-play-reverse"
              accessibilityRole="button"
              style={[styles.squareBtn, { backgroundColor: '#007AFF' }, (!p1ReversedUri && !p1Reversing) && styles.disabled]}
              onPress={() => playSound(p1ReversedUri)}
              disabled={!p1ReversedUri || playbackBlocked}
            >
              <IconSymbol name="backward.fill" size={28} color="white" />
              <Text style={styles.btnText}>{p1Reversing ? 'Reversing…' : 'Play Reverse'}</Text>
            </Pressable>

            <Pressable 
              testID="reverse-singing-p1-play-slow"
              accessibilityRole="button"
              style={[styles.circleBtn, !p1ReversedUri && styles.disabled]}
              onPress={() => playSound(p1ReversedUri, 0.5)}
              disabled={!p1ReversedUri || playbackBlocked}
            >
              <IconSymbol name="tortoise.fill" size={32} color="white" />
            </Pressable>
          </View>
        </View>
      </LiquidGlass>

      {/* Player 2 Card */}
      <LiquidGlass radius={24} style={[styles.card, styles.cardActive]}>
        <View style={styles.cardHeader}>
          <View style={styles.playerHeading}>
            <Text style={styles.cardTitle} numberOfLines={1}>{p2Name}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>Copy the reversed sound</Text>
          </View>
          <View style={[styles.statusPill, p2Recording ? styles.statusRecording : p2Uri ? styles.statusDone : styles.statusActive]}>
            <Text style={styles.statusText}>{p2Recording ? 'Recording' : p2Uri ? 'Done' : p2Ready ? 'Your turn' : 'Waiting'}</Text>
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
              testID="reverse-singing-p2-record"
              accessibilityRole="button"
              disabled={!p2Ready || captureBusy || !!p1Recording || p2Reversing}
              style={[styles.squareBtn, { backgroundColor: p2Recording ? '#8E1C16' : Colors.red }, (!p2Ready || captureBusy) && styles.disabled]}
              onPress={() => p2Recording ? stopRecording(2) : startRecording(2)}
            >
              <IconSymbol name={p2Recording ? "stop.fill" : "record.circle.fill"} size={28} color="white" />
              <Text style={styles.btnText}>{p2Recording ? `Stop (${p2Name}) · ${p2Duration}s` : `Record Mimic (${p2Name})`}</Text>
            </Pressable>

            <Pressable 
              testID="reverse-singing-p2-play"
              accessibilityRole="button"
              style={[styles.circleBtn, !p2Uri && styles.disabled]}
              onPress={() => playSound(p2Uri)}
              disabled={!p2Uri || playbackBlocked}
            >
              <IconSymbol name="play.fill" size={32} color="white" />
            </Pressable>
          </View>

          <View style={styles.gridRow}>
            <Pressable 
              testID="reverse-singing-p2-result"
              accessibilityRole="button"
              style={[styles.squareBtn, { backgroundColor: Colors.green }, (!p2ReversedUri && !p2Reversing) && styles.disabled]}
              onPress={() => playSound(p2ReversedUri)}
              disabled={!p2ReversedUri || playbackBlocked}
            >
              <IconSymbol name="sparkles" size={28} color="white" />
              <Text style={styles.btnText}>{p2Reversing ? 'Reversing…' : 'Result'}</Text>
            </Pressable>

            <Pressable 
              testID="reverse-singing-p2-share"
              accessibilityRole="button"
              style={[styles.circleBtn, (!p2Uri && !p2ReversedUri) && styles.disabled]}
              onPress={showShareOptions}
              disabled={(!p2Uri && !p2ReversedUri) || playbackBlocked}
            >
              <IconSymbol name="square.and.arrow.up" size={32} color="white" />
            </Pressable>
          </View>
        </View>
      </LiquidGlass>

      {isPlaying && <Text accessibilityLiveRegion="polite" style={styles.roundHint}>Playing audio…</Text>}
      {p2Uri && <Text style={styles.roundHint}>Both takes are ready. Play Result to compare, or Retry for a new round.</Text>}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    gap: 10,
    paddingBottom: 12,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.35)',
    borderRadius: 16,
    padding: 14,
    width: '100%',
  },
  errorBannerText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  card: {
    padding: 12,
  },
  cardLocked: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  playerHeading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  retryButton: { width: 56, minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)' },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  roundHint: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center' },
  cardActive: {
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cardTitle: {
    color: 'white',
    fontSize: 16,
    maxWidth: 100,
    flexShrink: 1,
    fontFamily: 'Viral-Black',
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    flexShrink: 1,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
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
    padding: 5,
    borderRadius: 8,
    marginBottom: 8,
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
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  squareBtn: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minWidth: 0,
    minHeight: 100,
  },
  btnText: {
    color: 'white',
    fontSize: 15,
    lineHeight: 19,
    flexShrink: 1,
    fontFamily: 'Viral-Black',
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
