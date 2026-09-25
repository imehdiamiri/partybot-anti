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
