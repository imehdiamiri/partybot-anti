import React from 'react';
import { Image, View } from 'react-native';

// Visible letter bounds of the canonical 1200x400 PNG (alpha > 32). Frame the
// existing bitmap instead of centering its transparent margins in a wide box.
const ART = { width: 1200, height: 400, left: 80, top: 50, visibleWidth: 1038, visibleHeight: 319 };

export function BrandWordmark({ height = 32, testID }: { height?: number; testID?: string }) {
  const scale = height / ART.visibleHeight;
  return (
    <View testID={testID} accessibilityLabel="8Playo" accessible
      style={{ width: ART.visibleWidth * scale, height, overflow: 'hidden', flexShrink: 0 }}>
      <Image source={require('@/assets/images/8playo-logo.png')} accessible={false}
        style={{ position: 'absolute', width: ART.width * scale, height: ART.height * scale, left: -ART.left * scale, top: -ART.top * scale }}
        resizeMode="stretch" />
    </View>
  );
}
