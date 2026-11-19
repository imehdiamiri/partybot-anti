import { Colors } from '@/src/theme/Colors';
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ToolIllustration } from './ToolIllustration';
import { useRouter } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';

import { LiquidGlass } from '../LiquidGlass';

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

const toolRows = [PARTY_TOOLS.slice(0, 3), PARTY_TOOLS.slice(3)];

export function PartyToolsSection({ showsHeader = true }: PartyToolsSectionProps) {
  const router = useRouter();

  const handlePress = (tool: PartyToolType) => {
    router.push(`/(tools)/${tool}` as any);
  };

  return (
    <View style={styles.container}>
      {showsHeader && (
        <View style={styles.header}>
          <IconSymbol name="wrench.and.screwdriver.fill" size={12} color="rgba(255,255,255,0.55)" weight="bold" />
          <Text style={styles.headerTitle}>TOOLS</Text>
        </View>
      )}

      <View style={styles.grid}>
        {toolRows.map(row => (
          <View key={row[0].id} style={styles.row}>
            {row.map(tool => (
              <Pressable
                key={tool.id}
                testID={`tool-card-${tool.id}`}
                accessibilityRole="button"
                accessibilityLabel={tool.title}
                style={({ pressed }) => [styles.cardContainer, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
                onPress={() => handlePress(tool.id)}
              >
                <LiquidGlass variant="low" radius={22} shadow={false} style={styles.card}>
                  <ToolIllustration tool={tool.id} />
                  <Text adjustsFontSizeToFit numberOfLines={2} style={styles.title}>{tool.title}</Text>
                </LiquidGlass>
              </Pressable>
            ))}
          </View>
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
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardContainer: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 4,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
  },
  title: {
    alignSelf: 'stretch',
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '700',
  },
});
