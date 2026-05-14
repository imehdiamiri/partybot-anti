import { Colors } from '@/src/theme/Colors';
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from 'expo-image';

export const GamePlayerColor = {
  palette: [
    '#007AFF', Colors.green, Colors.orange, '#AF52DE', '#FF2D55', 
    Colors.cyan, '#00C7BE', Colors.yellow, Colors.red, '#5856D6', 
    '#30B0C7', '#A2845E'
  ],
  color: (index: number) => {
    return GamePlayerColor.palette[index % GamePlayerColor.palette.length];
  }
};

interface GamePassPhoneViewProps {
  playerName: string;
  subtitle?: string;
  accentColor?: string;
  buttonTitle?: string;
  onReady: () => void;
}

export function GamePassPhoneView({
  playerName,
  subtitle = "Make sure no one else is looking!",
  accentColor = Colors.yellow,
  buttonTitle = "I'm Ready",
  onReady
}: GamePassPhoneViewProps) {
  return (
    <View style={styles.passPhoneContainer}>
      <View style={{ flex: 1 }} />
      <View style={styles.passPhoneCenter}>
        <View style={[styles.passPhoneIconContainer, { backgroundColor: `${accentColor}22` }]}>
          <IconSymbol name="hand.raised.fill" size={48} color={accentColor} />
        </View>

        <Text style={styles.passPhoneTitle}>Pass the phone to</Text>
        <CurrentTurnPill playerName={playerName} accent={Colors.green} scale={1.2} />
        <Text style={styles.passPhoneSubtitle}>{subtitle}</Text>
      </View>
      <View style={{ flex: 1 }} />
      
      <Pressable 
        style={[styles.actionButton, { backgroundColor: accentColor }]}
        onPress={onReady}
      >
        <Text style={styles.actionButtonText}>{buttonTitle}</Text>
      </Pressable>
    </View>
  );
}

export function CurrentTurnPill({ 
  playerName, 
  prefix, 
  accent = Colors.green,
  scale = 1.0 
}: { 
  playerName: string, 
  prefix?: string, 
  accent?: string,
  scale?: number 
}) {
  return (
    <View style={[styles.turnPill, { backgroundColor: accent, transform: [{ scale }] }]}>
      <View style={styles.turnPillDot} />
      {prefix && <Text style={styles.turnPillPrefix}>{prefix}</Text>}
      <Text style={styles.turnPillName}>{playerName}</Text>
    </View>
  );
}

export function GamePlayerAvatar({ name, color = 'rgba(255,255,255,0.08)', size = 34 }: { name: string, color?: string, size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38, color: Colors.white }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  passPhoneContainer: {
    flex: 1,
    padding: 24,
  },
  passPhoneCenter: {
    alignItems: 'center',
    gap: 24,
  },
  passPhoneIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passPhoneTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  passPhoneSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 8,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  turnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  turnPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  turnPillPrefix: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  turnPillName: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  avatar: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: 'bold',
  }
});

// ─── Beer Bottle Image (external) ───

export function BeerBottleView({ width: w }: { width: number }) {
  const h = w * 2.4;

  return (
    <View style={{
      shadowColor: 'black',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.55,
      shadowRadius: 14,
      elevation: 10,
    }}>
      <Image
        source={require('@/assets/images/tools/bottle.png')}
        style={{
          width: w,
          height: h,
        }}
        contentFit="contain"
        transition={200}
      />
    </View>
  );
}
