import { Colors } from '@/src/theme/Colors';
import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { ToolIllustration } from './ToolIllustration';
import { useRouter } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';

import { LiquidGlass } from '../LiquidGlass';
import { toolGridColumns } from '@/src/utils/mobileLayout';

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
  const { width, fontScale } = useWindowDimensions();
  const columns = toolGridColumns(width, fontScale);
  const columnWidth = columns === 2 ? '48.5%' : '32%';

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
            accessibilityLabel={tool.title}
            style={({ pressed }) => [{ width: columnWidth, aspectRatio: 1 }, styles.cardContainer, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
            onPress={() => handlePress(tool.id)}
          >
            <LiquidGlass variant="low" radius={22} shadow={false} style={styles.card}>
              {renderCardInner(tool)}
            </LiquidGlass>
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
    alignItems: 'flex-start',
    alignContent: 'flex-start',
  },
  cardContainer: {
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
    paddingVertical: 10,
    paddingHorizontal: 8,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
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
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
});
