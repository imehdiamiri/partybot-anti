jest.mock('../utils/platform', () => ({
  isWeb: true,
  isWebLocalMode: true,
  isIOS: false,
  isAndroid: false,
}));

import {
  isWebAudioSupported,
  isWebMediaRecorderSupported,
  getWebAudioContext,
  playWebTone,
  playWebTick,
  playWebDrumHit,
  audioBufferToWavBlob,
  revokeWebAudioUrl,
  WebAudioRecorder,
} from '../utils/browserMediaAdapter';

describe('Browser Media Adapter', () => {
  let mockAudioContext: any;
  let mockOscillator: any;
  let mockGain: any;

  beforeEach(() => {
    mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
      connect: jest.fn(),
      disconnect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };

    mockGain = {
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
      connect: jest.fn(),
      disconnect: jest.fn(),
    };

    mockAudioContext = {
      state: 'running',
      currentTime: 10,
      createOscillator: jest.fn(() => mockOscillator),
      createGain: jest.fn(() => mockGain),
      createBuffer: jest.fn((channels, length, sampleRate) => {
        const buffers = Array.from({ length: channels }, () => new Float32Array(length));
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData: (c: number) => buffers[c],
        };
      }),
      createBufferSource: jest.fn(() => ({
        buffer: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        onended: null,
      })),
      decodeAudioData: jest.fn(async (arrayBuffer) => {
        const sampleRate = 44100;
        const length = 44100;
        const channel1 = new Float32Array(length);
        for (let i = 0; i < length; i++) channel1[i] = ((i / length) * 2 - 1) * 0.1;
        return {
          numberOfChannels: 1,
          length,
          sampleRate,
          duration: 1.0,
          getChannelData: () => channel1,
        };
      }),
      destination: {},
      resume: jest.fn().mockResolvedValue(undefined),
    };

    (global as any).window = {
      AudioContext: jest.fn(() => mockAudioContext),
    };

    let urlCounter = 0;
    (global as any).URL = {
      createObjectURL: jest.fn(() => `blob:http://localhost/test-audio-blob-${++urlCounter}`),
      revokeObjectURL: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('isWebAudioSupported detects AudioContext', () => {
    expect(isWebAudioSupported()).toBe(true);
  });

  test('playWebTone configures oscillator frequency and gain envelope', () => {
    const tone = playWebTone(440, 1.0);
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(440, 10);
    expect(mockOscillator.start).toHaveBeenCalledWith(10);
    expect(mockOscillator.stop).toHaveBeenCalledWith(11);

    // Stop early
    tone.stop();
    expect(mockOscillator.stop).toHaveBeenCalled();
    expect(mockOscillator.disconnect).toHaveBeenCalled();
  });

  test('playWebTick plays normal and accented clicks', () => {
    playWebTick(false);
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(800, 10);

    playWebTick(true);
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1200, 10);
  });

  test('playWebDrumHit plays low-frequency drum pitch drop', () => {
    playWebDrumHit();
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(160, 10);
    expect(mockOscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(40, 10 + 0.12);
  });

  test('audioBufferToWavBlob creates valid RIFF/WAVE header and PCM data', () => {
    const sampleRate = 44100;
    const length = 100;
    const buffer = mockAudioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = 0.5;

    const wavBlob = audioBufferToWavBlob(buffer as any);
    expect(wavBlob).toBeDefined();
    expect(wavBlob.type).toBe('audio/wav');
    // 44 header bytes + 100 samples * 2 bytes = 244 bytes
    expect(wavBlob.size).toBe(244);
  });

  test('revokeWebAudioUrl safely calls URL.revokeObjectURL for blob URLs only', () => {
    revokeWebAudioUrl('blob:http://localhost/audio-1');
    expect((global as any).URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/audio-1');

    revokeWebAudioUrl('https://example.com/sound.mp3');
    // Non-blob URLs should not be passed to revokeObjectURL
    expect((global as any).URL.revokeObjectURL).toHaveBeenCalledTimes(1);

    revokeWebAudioUrl(null);
    expect((global as any).URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  test('WebAudioRecorder start and stop creates reversed audio buffer and manages URLs', async () => {
    const mockStream = {
      getTracks: jest.fn(() => [{ stop: jest.fn() }]),
    };

    (global as any).navigator = {
      mediaDevices: {
        getUserMedia: jest.fn().mockResolvedValue(mockStream),
      },
    };

    // Polyfill Blob.prototype.arrayBuffer if needed
    if (!Blob.prototype.arrayBuffer) {
      Blob.prototype.arrayBuffer = async function () {
        return new ArrayBuffer(8);
      };
    }

    class MockMediaRecorder {
      static isTypeSupported = jest.fn(() => true);
      state = 'inactive';
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      start = jest.fn(() => {
        this.state = 'recording';
      });
      stop = jest.fn(() => {
        this.state = 'inactive';
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(['audio-data'], { type: 'audio/webm' }) });
        }
        if (this.onstop) this.onstop();
      });
    }

    (global as any).window.MediaRecorder = MockMediaRecorder;

    const recorder = new WebAudioRecorder();
    await recorder.start();
    expect((global as any).navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false } });

    const result = await recorder.stop();
    expect(result.durationMs).toBe(1000);
    expect(recorder.originalBuffer).toBeDefined();
    expect(recorder.reversedBuffer).toBeDefined();
    expect(result.originalWavUri).toContain('blob:');
    expect(result.reversedWavUri).toContain('blob:');

    // Quiet capture is normalized before producing both original and reversed WAVs.
    expect(Math.abs(recorder.originalBuffer!.getChannelData(0)[0])).toBeGreaterThan(0.3);
    // Verify reverse math: first sample becomes last
    const orig = recorder.originalBuffer!.getChannelData(0);
    const rev = recorder.reversedBuffer!.getChannelData(0);
    expect(rev[0]).toBeCloseTo(orig[orig.length - 1]);
    expect(rev[rev.length - 1]).toBeCloseTo(orig[0]);

    // Test revoking a single URL
    recorder.revokeUrl(result.originalWavUri);
    expect((global as any).URL.revokeObjectURL).toHaveBeenCalledWith(result.originalWavUri);

    // Test revoking remaining URLs on unmount / cleanup
    recorder.revokeAllCreatedUrls();
    expect((global as any).URL.revokeObjectURL).toHaveBeenCalledWith(result.reversedWavUri);

    recorder.cleanup();
  });
});
