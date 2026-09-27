/** Block browser zoom gestures without swallowing clicks or one-finger scrolling.
 * CSS touch-action handles double taps; Safari's gesture events cover pinch zoom.
 * This is installed once by the web shell, never by native screens.
 */
export function installWebZoomGuards(target: Document) {
  const cancel = (event: Event) => { if (event.cancelable) event.preventDefault(); };
  const touchMove = (event: Event) => {
    if ((event as TouchEvent).touches.length > 1) cancel(event);
  };
  const wheel = (event: Event) => { if ((event as WheelEvent).ctrlKey) cancel(event); };
  const events: [string, EventListener][] = [
    ['gesturestart', cancel], ['gesturechange', cancel], ['dblclick', cancel],
    ['touchmove', touchMove], ['wheel', wheel],
  ];
  for (const [name, handler] of events) target.addEventListener(name, handler, { passive: false });
  return () => { for (const [name, handler] of events) target.removeEventListener(name, handler); };
}
