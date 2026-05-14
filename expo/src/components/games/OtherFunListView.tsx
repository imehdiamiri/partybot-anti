import { Colors } from '@/src/theme/Colors';
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PartyGameTutorial, PartyGameTutorials } from '@/src/models/PartyGameTutorial';

// Platform-safe imports: reanimated + blur
let Animated: any;
let FadeInUp: any;
let FadeIn: any;
let FadeOut: any;
let Layout: any;
let BlurView: any;

if (Platform.OS !== 'web') {
  const Reanimated = require('react-native-reanimated');
  Animated = Reanimated.default;
  FadeInUp = Reanimated.FadeInUp;
  FadeIn = Reanimated.FadeIn;
  FadeOut = Reanimated.FadeOut;
  Layout = Reanimated.Layout;
  if (Platform.OS === 'ios') {
    try { BlurView = require('expo-blur').BlurView; } catch {}
  }
} else {
  Animated = { View };
  FadeInUp = undefined;
  FadeIn = undefined;
  FadeOut = undefined;
  Layout = undefined;
}

export function OtherFunListView() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Party Game Ideas</Text>
      </View>

      <View style={styles.list}>
        {PartyGameTutorials.map((game, index) => (
          <Animated.View key={game.id} entering={FadeInUp.delay(index * 35).springify()}>
            <PartyGameCard 
              game={game} 
              isExpanded={expandedId === game.id}
              onToggle={() => setExpandedId(expandedId === game.id ? null : game.id)}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function PartyGameCard({ game, isExpanded, onToggle }: { game: PartyGameTutorial, isExpanded: boolean, onToggle: () => void }) {
  // Map our tint strings to actual colors
  const getTintColor = (tint: string) => {
    const colors: Record<string, string> = {
      orange: Colors.orange,
      pink: '#FF2D55',
      yellow: Colors.yellow,
      red: Colors.red,
      cyan: Colors.cyan,
      green: Colors.green,
      purple: '#AF52DE',
      indigo: '#5856D6',
      teal: '#30B0C7',
      mint: '#00C7BE',
      blue: '#007AFF',
      brown: '#A2845E'
    };
    return colors[tint] || '#007AFF';
  };

  const tintColor = getTintColor(game.tint);

  return (
    <Animated.View layout={Layout.springify()} style={[styles.card]}>
      {Platform.OS === 'ios' && BlurView ? (
        <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,20,30,0.92)' }]} />
      )}
      <Pressable onPress={onToggle} style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: tintColor + '20' }]}>
          <IconSymbol name={game.iconName as any} size={22} color={tintColor} weight="semibold" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.gameTitle}>{game.title}</Text>
          <Text style={styles.gameDescription} numberOfLines={isExpanded ? undefined : 1}>{game.description}</Text>
        </View>

        <View style={styles.chevronContainer}>
          <IconSymbol 
            name={isExpanded ? "chevron.up" : "chevron.down"} 
            size={12} 
            color="rgba(255,255,255,0.6)" 
            weight="semibold" 
          />
        </View>
      </Pressable>

      {isExpanded && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.expandedContent}>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <IconSymbol name="play.circle.fill" size={14} color={tintColor} />
              <Text style={[styles.sectionTitle, { color: tintColor }]}>How to Play</Text>
            </View>
            <View style={styles.stepsContainer}>
              {game.howToPlay.map((step, index) => (
                <View key={index} style={styles.stepRow}>
                  <View style={[styles.stepNumberBadge, { backgroundColor: tintColor + '1F' }]}>
                    <Text style={[styles.stepNumber, { color: tintColor }]}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>

          {game.rules.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={14} color={Colors.orange} />
                  <Text style={[styles.sectionTitle, { color: Colors.orange }]}>Rules</Text>
                </View>
                <View style={styles.rulesContainer}>
                  {game.rules.map((rule, index) => (
                    <View key={index} style={styles.ruleRow}>
                      <View style={styles.ruleIconContainer}>
                        <IconSymbol name="arrow.right" size={10} color="rgba(255, 149, 0, 0.7)" weight="bold" />
                      </View>
                      <Text style={styles.ruleText}>{rule}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  header: {
    paddingBottom: 4,
  },
  title: {
    fontFamily: 'Viral-Black',
    fontSize: 20,
    color: 'white',
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  gameTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  gameDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  chevronContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 12,
  },
  section: {
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepsContainer: {
    gap: 6,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 16,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rulesContainer: {
    gap: 6,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  ruleIconContainer: {
    width: 20,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  ruleText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 16,
    marginTop: 2,
  }
});
