import { useRef } from 'react';
import { GestureResponderEvent } from 'react-native';

export function sliderValue(position: number, length: number, min: number, max: number, inverted = false) {
  const fraction = Math.max(0, Math.min(1, position / Math.max(1, length)));
  return min + (inverted ? 1 - fraction : fraction) * (max - min);
}

/** Own a drag until release. Page deltas remain stable when the thumb moves. */
export function useSliderDrag({ axis, length, value, min, max, inverted = false, onChange, onDraggingChange, onComplete }: {
  axis: 'x' | 'y'; length: number; value: number; min: number; max: number; inverted?: boolean;
  onChange: (value: number) => void; onDraggingChange: (active: boolean) => void;
  onComplete?: (value: number) => void;
}) {
  const drag = useRef<{ page: number; position: number; value: number } | null>(null);
  const update = (position: number) => {
    const next = sliderValue(position, length, min, max, inverted);
    if (drag.current) drag.current.value = next;
    onChange(next);
  };
  const release = (complete: boolean) => {
    const last = drag.current;
    drag.current = null;
    onDraggingChange(false);
    if (complete && last) onComplete?.(last.value);
  };
  return {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onResponderGrant: (event: GestureResponderEvent) => {
      const e = event.nativeEvent;
      const page = axis === 'x' ? e.pageX : e.pageY;
      const local = axis === 'x' ? e.locationX : e.locationY;
      const fraction = (value - min) / (max - min);
      const thumb = (inverted ? 1 - fraction : fraction) * length;
      // Grabbing any part of the thumb must not jump its centre to the finger.
      const position = Math.abs(local - thumb) <= 24 ? thumb : local;
      drag.current = { page, position, value };
      onDraggingChange(true);
      update(position);
    },
    onResponderMove: (event: GestureResponderEvent) => {
      if (!drag.current) return;
      const page = axis === 'x' ? event.nativeEvent.pageX : event.nativeEvent.pageY;
      update(drag.current.position + page - drag.current.page);
    },
    onResponderRelease: () => release(true),
    onResponderTerminate: () => release(false),
  };
}
