import React from 'react';
import { act, create } from 'react-test-renderer';
import { useSliderDrag } from '../hooks/useSliderDrag';

let handlers: ReturnType<typeof useSliderDrag>;
function Harness(props: Parameters<typeof useSliderDrag>[0]) {
  handlers = useSliderDrag(props);
  return null;
}
const event = (page: number, local: number) => ({ nativeEvent: { pageX: page, pageY: page, locationX: local, locationY: local } } as any);

test.each(['x', 'y'] as const)('%s drag keeps its thumb offset and owns the touch until release', async axis => {
  const onChange = jest.fn(), onDraggingChange = jest.fn(), onComplete = jest.fn();
  let view: any;
  await act(async () => { view = create(<Harness axis={axis} length={200} value={50} min={0} max={100} onChange={onChange} onDraggingChange={onDraggingChange} onComplete={onComplete} />); });
  handlers.onResponderGrant(event(310, 110));
  expect(onChange).toHaveBeenLastCalledWith(50); // Finger is 10px off thumb centre.
  handlers.onResponderMove(event(350, 5)); // Child-relative location changes on iOS.
  expect(onChange).toHaveBeenLastCalledWith(70);
  expect(handlers.onResponderTerminationRequest()).toBe(false);
  expect(handlers.onShouldBlockNativeResponder()).toBe(true);
  handlers.onResponderRelease();
  expect(onDraggingChange.mock.calls).toEqual([[true], [false]]);
  expect(onComplete).toHaveBeenCalledWith(70);
  handlers.onResponderMove(event(500, 100));
  expect(onChange).toHaveBeenCalledTimes(2);
  await act(async () => view.unmount());
});

test('vertical frequency drag clamps endpoints and interruption never starts a new tone', async () => {
  const onChange = jest.fn(), onDraggingChange = jest.fn(), onComplete = jest.fn();
  let view: any;
  await act(async () => { view = create(<Harness axis="y" length={200} value={600} min={200} max={1000} inverted onChange={onChange} onDraggingChange={onDraggingChange} onComplete={onComplete} />); });
  handlers.onResponderGrant(event(400, 100));
  handlers.onResponderMove(event(100, 0));
  expect(onChange).toHaveBeenLastCalledWith(1000);
  handlers.onResponderMove(event(800, 200));
  expect(onChange).toHaveBeenLastCalledWith(200);
  handlers.onResponderTerminate();
  expect(onDraggingChange).toHaveBeenLastCalledWith(false);
  expect(onComplete).not.toHaveBeenCalled();
  await act(async () => view.unmount());
});
