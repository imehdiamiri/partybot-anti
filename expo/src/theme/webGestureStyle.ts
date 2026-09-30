import { Platform, type ViewStyle } from 'react-native';

// React Native Web supports touchAction; native ViewStyle intentionally does not.
// Keep browser gesture ownership on sliders without passing CSS-only props to native.
export const webSliderGestureStyle: ViewStyle & { touchAction?: 'none' } =
  Platform.OS === 'web' ? { touchAction: 'none' } : {};
