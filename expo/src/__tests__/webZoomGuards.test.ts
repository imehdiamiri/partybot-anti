import { installWebZoomGuards } from '../utils/webZoomGuards';

test('blocks zoom gestures but preserves clicks and ordinary scroll; cleans up', () => {
  const target = new EventTarget();
  const cleanup = installWebZoomGuards(target as unknown as Document);
  const send = (name: string, values = {}) => {
    const event = new Event(name, { cancelable: true });
    Object.assign(event, values); target.dispatchEvent(event); return event.defaultPrevented;
  };
  expect(send('dblclick')).toBe(true);
  expect(send('gesturestart')).toBe(true);
  expect(send('gesturechange')).toBe(true);
  expect(send('touchmove', { touches: [1, 2] })).toBe(true);
  expect(send('wheel', { ctrlKey: true })).toBe(true);
  expect(send('touchmove', { touches: [1] })).toBe(false);
  expect(send('wheel', { ctrlKey: false })).toBe(false);
  expect(send('click')).toBe(false);
  cleanup(); expect(send('dblclick')).toBe(false);
  expect(send('touchmove', { touches: [1, 2] })).toBe(false);
});
