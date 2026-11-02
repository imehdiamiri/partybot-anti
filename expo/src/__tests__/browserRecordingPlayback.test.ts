import { BrowserRecordingPlayback } from '../utils/browserRecordingPlayback';

test('Retry cancels a pending browser resume before it can start old audio', async () => {
  let resume!: () => void;
  const context: any = { state: 'suspended', resume: () => new Promise<void>(r => { resume = r; }), createBufferSource: jest.fn() };
  const playback = new BrowserRecordingPlayback(() => context);
  playback.remember('blob:old', {} as AudioBuffer);
  const pending = playback.play('blob:old');
  playback.clear();
  resume();
  expect(await pending).toBe(false);
  expect(context.createBufferSource).not.toHaveBeenCalled();
});

test('a suspended context is resumed from Play, repeated playback replaces its node, and old end events cannot stop a new take', async () => {
  const nodes: any[] = [];
  const context: any = { state: 'suspended', resume: jest.fn(async () => {}), destination: {},
    createBuffer: (count: number, length: number) => { const data = new Float32Array(length); return { length, getChannelData: () => data }; },
    createBufferSource: () => {
      const node = { connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(), playbackRate: { value: 1 }, onended: null };
      nodes.push(node); return node;
    } };
  const playback = new BrowserRecordingPlayback(() => context);
  const ended = jest.fn();
  playback.remember('blob:first', { length: 100, numberOfChannels: 1, sampleRate: 44100, getChannelData: () => new Float32Array(100) } as unknown as AudioBuffer);
  await playback.play('blob:first', .5, ended);
  expect(context.resume).toHaveBeenCalled();
  expect(nodes[0].playbackRate.value).toBe(1);
  expect(nodes[0].buffer.length).toBe(200);
  const staleEnd = nodes[0].onended;
  await playback.play('blob:first', 1, ended);
  expect(nodes[0].stop).toHaveBeenCalled();
  staleEnd();
  expect(ended).not.toHaveBeenCalled();
  nodes[1].onended();
  expect(ended).toHaveBeenCalledTimes(1);
});

test('decoded replay and half-speed output stay loud, peak-safe and stable across repeats', async () => {
  const rate = 22050;
  const makeBuffer = (count: number, length: number, sampleRate: number) => {
    const channels = Array.from({ length: count }, () => new Float32Array(length));
    return { length, sampleRate, numberOfChannels: count, getChannelData: (c: number) => channels[c] };
  };
  const take = makeBuffer(1, rate, rate);
  take.getChannelData(0).set(Float32Array.from({ length: rate }, (_, i) => 0.003 * Math.sin(2 * Math.PI * 220 * i / rate)));
  const nodes: any[] = [];
  const context: any = {
    state: 'running', destination: {}, createBuffer: makeBuffer,
    decodeAudioData: jest.fn(async () => take),
    createBufferSource: () => {
      const node = { buffer: null, playbackRate: { value: 1 }, connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(), onended: null };
      nodes.push(node); return node;
    },
  };
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = jest.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
  const playback = new BrowserRecordingPlayback(() => context);
  try {
    await playback.play('blob:quiet');
    const normal = nodes.at(-1).buffer.getChannelData(0).slice();
    await playback.play('blob:quiet', 0.5);
    const slow = nodes.at(-1).buffer.getChannelData(0);
    expect(slow.length).toBe(normal.length * 2);
    for (const samples of [normal, slow]) {
      const middle = samples.slice(rate / 5, -rate / 5);
      const rms = Math.sqrt(middle.reduce((sum: number, x: number) => sum + x * x, 0) / middle.length);
      expect(rms).toBeGreaterThan(0.4);
      expect(samples.every((x: number) => Number.isFinite(x) && Math.abs(x) <= 0.89001)).toBe(true);
    }
    await playback.play('blob:quiet');
    expect(nodes.at(-1).buffer.getChannelData(0)).toEqual(normal);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
  } finally { playback.clear(); globalThis.fetch = originalFetch; }
});
