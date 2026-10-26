import React, { createElement } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SCREEN_LAYOUT, screenLayout } from '@/src/theme/ScreenLayout';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  leftLabel?: string;
  leftIcon?: string;
  onLeftPress?: () => void;
  rightLabel?: string;
  rightIcon?: string;
  onRightPress?: () => void;
  rightColor?: string;
  leftColor?: string;
  maxWidth?: number;
  leftTestID?: string;
  rightTestID?: string;
  rightAccessibilityLabel?: string;
  includeTopInset?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  leftLabel,
  leftIcon,
  onLeftPress,
  rightLabel,
  rightIcon,
  onRightPress,
  rightColor = 'white',
  leftColor = '#007AFF',
  maxWidth = SCREEN_LAYOUT.content,
  leftTestID,
  rightTestID,
  rightAccessibilityLabel,
  includeTopInset = true,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const narrowNative = Platform.OS !== 'web' && width < 400;
  const slotWidth = narrowNative ? 64 : SCREEN_LAYOUT.headerSlot;

  return (
    <View style={{ paddingTop: (includeTopInset ? insets.top : 0) + 8, paddingBottom: 10, backgroundColor: '#08080F' }}>
    {Platform.OS === 'web' ? createElement('style', null, `
      @media (max-width: 399px) {
        [data-testid="screen-header"] > :first-child,
        [data-testid="screen-header"] > :last-child { width: 64px !important; }
        [data-testid="screen-header-title"] { font-size: 16px !important; line-height: 21px !important; }
      }
    `) : null}
    <View testID="screen-header" style={[screenLayout.frame, styles.header, { maxWidth }]}>
      {/* Left button slot */}
      {onLeftPress ? (
        <TouchableOpacity testID={leftTestID} onPress={onLeftPress} style={[styles.leftButton, { width: slotWidth }]} accessibilityRole="button" accessibilityLabel={leftLabel || "Back"}>
          {leftIcon ? <IconSymbol name={leftIcon as any} size={18} color={leftColor} /> : null}
          {leftLabel ? (
            <Text style={[styles.leftButtonText, { color: leftColor }, leftIcon ? { marginLeft: 2 } : null]} numberOfLines={1}>
              {leftLabel}
            </Text>
          ) : null}
        </TouchableOpacity>
      ) : (
        <View style={[styles.leftButton, { width: slotWidth }]} />
      )}

      {/* Title */}
      <View style={styles.titleSlot}>
      <Text testID="screen-header-title" style={[styles.headerTitle, narrowNative && { fontSize: 16, lineHeight: 21 }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>

      {/* Right button slot */}
      {onRightPress ? (
        <TouchableOpacity testID={rightTestID} onPress={onRightPress} style={[styles.rightButton, { width: slotWidth }]} accessibilityRole="button" accessibilityLabel={rightAccessibilityLabel || rightLabel || rightIcon}>
          {rightIcon ? <IconSymbol name={rightIcon as any} size={18} color={rightColor} /> : null}
          {rightLabel ? (
            <Text style={[styles.rightButtonText, { color: rightColor }, rightIcon ? { marginLeft: 2 } : null]} numberOfLines={1}>
              {rightLabel}
            </Text>
          ) : null}
        </TouchableOpacity>
      ) : (
        <View style={[styles.rightButton, { width: slotWidth }]} />
      )}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: SCREEN_LAYOUT.headerSlot,
    flexShrink: 0,
    minHeight: SCREEN_LAYOUT.touchTarget,
    justifyContent: 'flex-start',
  },
  rightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: SCREEN_LAYOUT.headerSlot,
    flexShrink: 0,
    minHeight: SCREEN_LAYOUT.touchTarget,
    justifyContent: 'flex-end',
  },
  leftButtonText: {
    color: '#007AFF',
    fontSize: 15,
    flexShrink: 1,
    fontWeight: '400',
  },
  rightButtonText: {
    fontSize: 15,
    flexShrink: 1,
    fontWeight: '500',
  },
  titleSlot: { flex: 1, minWidth: 0, marginHorizontal: 8, alignItems: 'center' },
  headerSubtitle: { color: '#A8AFBF', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  headerTitle: {
    fontFamily: 'Viral-Black',
    fontSize: 18,
    lineHeight: 23,
    color: 'white',
    textAlign: 'center',
    width: '100%',
  },
});
