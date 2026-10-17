import { StyleSheet } from 'react-native';

/** Page widths include the same gutters as their header and footer. */
export const SCREEN_LAYOUT = {
  gutter: 16,
  touchTarget: 44,
  headerSlot: 76,
  form: 680,
  content: 720,
  tools: 900,
  library: 1200,
} as const;

export const screenLayout = StyleSheet.create({
  frame: { width: '100%', alignSelf: 'center', paddingHorizontal: SCREEN_LAYOUT.gutter },
  toolbar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  profileTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
