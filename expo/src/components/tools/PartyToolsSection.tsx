import { Colors } from '@/src/theme/Colors';
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { ToolIllustration } from './ToolIllustration';
import { useRouter } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';

// Platform-safe BlurView (iOS only — broken on Android)
let BlurView: any = null;
if (Platform.OS === 'ios') {
  try { BlurView = require('expo-blur').BlurView; } catch {}
}

export type PartyToolType = 'dice' | 'bottle' | 'hourglass' | 'coin' | 'teams' | 'wheel';

export interface PartyTool {
  id: PartyToolType;
  title: string;
  subtitle: string;
  icon: any;
  tint: string;
}

export const PARTY_TOOLS: PartyTool[] = [
  { id: 'dice', title: 'Dice', subtitle: 'Roll 1–4 dice', icon: 'die.face.5.fill', tint: Colors.orange }, // orange
  { id: 'bottle', title: 'Bottle', subtitle: 'Spin to pick', icon: 'waterbottle.fill', tint: '#FF2D55' }, // pink
  { id: 'hourglass', title: 'Hourglass', subtitle: 'Set a timer', icon: 'hourglass', tint: Colors.cyan }, // cyan
  { id: 'coin', title: 'Coin Flip', subtitle: 'Heads or tails', icon: 'circle.circle.fill', tint: Colors.yellow }, // yellow
  { id: 'teams', title: 'Team Splitter', subtitle: 'Split into teams', icon: 'person.2.badge.gearshape.fill', tint: Colors.green }, // green
  { id: 'wheel', title: 'Wheel', subtitle: 'Spin to decide', icon: 'arrow.triangle.2.circlepath', tint: '#AF52DE' }, // purple
];

interface PartyToolsSectionProps {
  showsHeader?: boolean;
}

export function PartyToolsSection({ showsHeader = true }: PartyToolsSectionProps) {
  const router = useRouter();
  // Fixed 3-by-2 layout; percentages fit the first frame on every platform.
  const columnWidth = '32%';

  const handlePress = (tool: PartyToolType) => {
    router.push(`/(tools)/${tool}` as any);
  };

  const renderCardInner = (tool: PartyTool) => (
    <>
      <View style={styles.iconContainer}>
        <ToolIllustration tool={tool.id} color={tool.tint} size={68} />
      </View>
      <Text style={styles.title}>{tool.title}</Text>
    </>
  );

  return (
    <View style={styles.container}>
      {showsHeader && (
        <View style={styles.header}>
          <IconSymbol name="wrench.and.screwdriver.fill" size={12} color="rgba(255,255,255,0.55)" weight="bold" />
          <Text style={styles.headerTitle}>TOOLS</Text>
        </View>
      )}

      <View style={styles.grid}>
        {PARTY_TOOLS.map((tool) => (
          <Pressable 
            key={tool.id} 
            testID={`tool-card-${tool.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${tool.title}, ${tool.subtitle}`}
            style={[{ width: columnWidth }, styles.cardContainer]} 
            onPress={() => handlePress(tool.id)}
          >
            {BlurView ? (
              <BlurView intensity={30} tint="dark" style={styles.card}>
                {renderCardInner(tool)}
              </BlurView>
            ) : (
              <View style={[styles.card, { backgroundColor: 'rgba(30,30,45,0.85)' }]}>
                {renderCardInner(tool)}
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  cardContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 14,
    paddingHorizontal: 8,
    minHeight: 130,
    flexGrow: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
  },
  iconContainer: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '900',
  },
});
