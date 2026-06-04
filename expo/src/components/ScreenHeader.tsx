import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ScreenHeaderProps {
  title: string;
  leftLabel?: string;
  leftIcon?: string;
  onLeftPress?: () => void;
  rightLabel?: string;
  rightIcon?: string;
  onRightPress?: () => void;
  rightColor?: string;
}

export function ScreenHeader({
  title,
  leftLabel,
  leftIcon,
  onLeftPress,
  rightLabel,
  rightIcon,
  onRightPress,
  rightColor = 'white'
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      {/* Left button slot */}
      {onLeftPress ? (
        <TouchableOpacity onPress={onLeftPress} style={styles.leftButton}>
          {leftIcon ? <IconSymbol name={leftIcon as any} size={18} color="#007AFF" /> : null}
          {leftLabel ? (
            <Text style={[styles.leftButtonText, leftIcon ? { marginLeft: 2 } : null]}>
              {leftLabel}
            </Text>
          ) : null}
        </TouchableOpacity>
      ) : (
        <View style={styles.leftButton} />
      )}

      {/* Title */}
      <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>

      {/* Right button slot */}
      {onRightPress ? (
        <TouchableOpacity onPress={onRightPress} style={styles.rightButton}>
          {rightIcon ? <IconSymbol name={rightIcon as any} size={18} color={rightColor} /> : null}
          {rightLabel ? (
            <Text style={[styles.rightButtonText, { color: rightColor }, rightIcon ? { marginLeft: 2 } : null]}>
              {rightLabel}
            </Text>
          ) : null}
        </TouchableOpacity>
      ) : (
        <View style={styles.rightButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  leftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
    height: 44,
    justifyContent: 'flex-start',
  },
  rightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
    height: 44,
    justifyContent: 'flex-end',
  },
  leftButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '400',
  },
  rightButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  headerTitle: {
    fontFamily: 'Viral-Black',
    fontSize: 20,
    color: 'white',
    textAlign: 'center',
    flex: 1,
  },
});
