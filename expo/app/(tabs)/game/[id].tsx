import { Colors } from '@/src/theme/Colors';
import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, Dimensions, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';


import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Games, GamesDefinitions, GameMode, GameModeDetails } from '@/src/models/AppModels';
import { getGameInstructions } from '@/src/constants/GameLocalization';
import { useEconomyStore } from '@/src/store/useEconomyStore';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const gameKey = Object.keys(Games).find(key => Games[key].id === id);
  const game = gameKey ? Games[gameKey] : null;
  const gameDef = GamesDefinitions.find(def => def.id.id === id);

  const [showPaywall, setShowPaywall] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroAspectRatio, setHeroAspectRatio] = useState(16 / 9); // fallback
  const { isPremium } = useEconomyStore();

  const onHeroLoad = useCallback(() => setHeroLoaded(true), []);

  // Measure the actual image dimensions to compute a natural aspect ratio
  useEffect(() => {
    if (!game) return;
    const source = game.heroImageLocal || (game.heroImageURL ? { uri: game.heroImageURL } : null);
    if (!source) return;

    if (game.heroImageLocal) {
      // For local assets, use resolveAssetSource
      const resolved = Image.resolveAssetSource(game.heroImageLocal);
      if (resolved?.width && resolved?.height) {
        setHeroAspectRatio(resolved.width / resolved.height);
      }
    } else if (game.heroImageURL) {
      Image.getSize(
        game.heroImageURL,
        (w, h) => { if (w && h) setHeroAspectRatio(w / h); },
        () => {} // keep fallback
      );
    }
  }, [game?.id]);

  if (!game || !gameDef) {
    return (
      <View style={styles.container}>
        <AppBackgroundView />
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Game not found</Text>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Helper to get gradient colors for hero section
  const getGradientColors = (accentName: string): [string, string, string] => {
    switch (accentName) {
      case 'pink': return ['rgba(255, 105, 180, 0.95)', 'rgba(255, 59, 48, 0.65)', 'rgba(175, 82, 222, 0.5)'];
      case 'cyan': return ['rgba(50, 173, 230, 0.95)', 'rgba(0, 199, 190, 0.7)', 'rgba(0, 122, 255, 0.5)'];
      case 'teal': return ['rgba(48, 176, 199, 0.95)', 'rgba(52, 199, 89, 0.7)', 'rgba(0, 199, 190, 0.45)'];
      case 'orange': return ['rgba(255, 149, 0, 0.96)', 'rgba(255, 59, 48, 0.72)', 'rgba(255, 204, 0, 0.4)'];
      case 'red': return ['rgba(255, 59, 48, 0.95)', 'rgba(255, 105, 180, 0.7)', 'rgba(255, 149, 0, 0.45)'];
      case 'yellow': return ['rgba(255, 204, 0, 0.96)', 'rgba(255, 149, 0, 0.72)', 'rgba(255, 59, 48, 0.4)'];
      case 'purple': return ['rgba(175, 82, 222, 0.95)', 'rgba(88, 86, 214, 0.8)', 'rgba(255, 105, 180, 0.45)'];
      default: return ['rgba(0, 122, 255, 0.95)', 'rgba(88, 86, 214, 0.75)', 'rgba(175, 82, 222, 0.45)'];
    }
  };

  const getAccentColor = (accentName: string): string => {
    switch (accentName) {
      case 'pink': return 'rgba(255, 105, 180, 1)';
      case 'cyan': return 'rgba(50, 173, 230, 1)';
      case 'teal': return 'rgba(48, 176, 199, 1)';
      case 'orange': return 'rgba(255, 149, 0, 1)';
      case 'red': return 'rgba(255, 59, 48, 1)';
      case 'yellow': return 'rgba(255, 204, 0, 1)';
      case 'purple': return 'rgba(175, 82, 222, 1)';
      default: return 'rgba(0, 122, 255, 1)';
    }
  };

  const isLocked = gameDef.id.isPremium && !isPremium;
  const accentColor = getAccentColor(gameDef.accentName);

  const handleModeSelect = (mode: GameMode) => {
    if (mode === GameMode.multiDevice || mode === GameMode.teamMode) {
      router.push(`/game/${id}/lobby/create` as any);
    } else {
      router.push(`/game/${id}/setup?mode=singleDevice` as any);
    }
  };

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          style={styles.backButtonCustom}
        >
          <IconSymbol name="chevron.left" size={18} color="#007AFF" />
          <Text style={styles.backButtonCustomText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitleCustom}>{game.name}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={[styles.heroContainer, { aspectRatio: heroAspectRatio }]}>
            <LinearGradient
              colors={getGradientColors(gameDef.accentName)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {(game.heroImageLocal || game.heroImageURL) ? (
              <>
                {!heroLoaded && (
                  <View style={styles.heroLoadingContainer}>
                    <ActivityIndicator size="large" color="rgba(255,255,255,0.5)" />
                  </View>
                )}
                <Image
                  key={game.id}
                  source={game.heroImageLocal ? game.heroImageLocal : { uri: game.heroImageURL! }}
                  style={[
                    { width: '100%', height: '100%' },
                    !heroLoaded && { opacity: 0 },
                  ]}
                  resizeMode="contain"
                  onLoad={onHeroLoad}
                />
                {heroLoaded && (
                  <>
                    <LinearGradient
                      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
                      start={{ x: 0.5, y: 0.5 }}
                      end={{ x: 0.5, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                      pointerEvents="none"
                    />
                    <View style={styles.heroBadge}>
                      <IconSymbol name={game.symbolName as any} size={20} color="white" />
                      <Text style={styles.heroBadgeText} numberOfLines={1}>{game.name}</Text>
                    </View>
                  </>
                )}
              </>
            ) : (
              <IconSymbol name={game.symbolName as any} size={72} color="white" />
            )}
          </View>
        </View>

        {isLocked ? (
          <View style={styles.card}>
            <View style={styles.premiumHeader}>
              <View style={styles.premiumIconContainer}>
                <IconSymbol name="lock.fill" size={24} color="orange" />
              </View>
              <View style={styles.premiumTextContainer}>
                <Text style={styles.premiumTitle}>Premium Game</Text>
                <Text style={styles.premiumSubtitle}>
                  Subscribe to PartyBot+ to unlock {game.name} and every other premium game.
                </Text>
              </View>
            </View>

            <View style={styles.premiumBullets}>
              <View style={styles.bulletRow}>
                <IconSymbol name="checkmark.circle.fill" size={16} color="orange" />
                <Text style={styles.bulletText}>Unlock all premium games</Text>
              </View>
              <View style={styles.bulletRow}>
                <IconSymbol name="sparkles" size={16} color="orange" />
                <Text style={styles.bulletText}>AI cards cost just 1 ★ instead of 5</Text>
              </View>
              <View style={styles.bulletRow}>
                <IconSymbol name="star.fill" size={16} color="orange" />
                <Text style={styles.bulletText}>Bonus Stars every billing period</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.premiumButton} 
              onPress={() => setShowPaywall(true)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.orange, '#FF2D55']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.premiumButtonContent}>
                <IconSymbol name="crown.fill" size={16} color="white" />
                <Text style={styles.premiumButtonText}>Unlock with PartyBot+</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose a Mode</Text>
            
            <View style={styles.modesContainer}>
              {game.supportedModes.map(mode => {
                const modeDetails = GameModeDetails[mode];
                const modeAccent = modeDetails.accentColor;
                
                return (
                  <TouchableOpacity 
                    key={mode} 
                    style={styles.modeCard}
                    activeOpacity={0.7}
                    onPress={() => handleModeSelect(mode)}
                  >
                    <View style={[styles.modeCardBg, { backgroundColor: `${modeAccent}12` }]} />
                    
                    <View style={[styles.modeIconContainer, { backgroundColor: modeAccent }]}>
                      {mode === GameMode.multiDevice ? (
                        <View style={styles.multiPhoneContainer}>
                          <IconSymbol name="iphone" size={18} color="rgba(255,255,255,0.9)" />
                        </View>
                      ) : (
                        <IconSymbol name={modeDetails.icon as any} size={22} color="white" />
                      )}
                    </View>
                    
                    <View style={styles.modeTextContainer}>
                      <Text style={styles.modeTitle}>{modeDetails.title}</Text>
                      <Text style={styles.modeSubtitle} numberOfLines={2}>
                        {modeDetails.subtitle}
                      </Text>
                    </View>
                    
                    <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionHeaderTitle}>How it works</Text>
          <View style={styles.instructionsContainer}>
            {getGameInstructions(id!).map((step, i) => (
              <View key={i} style={styles.instructionRow}>
                <View style={[styles.stepBadge, { backgroundColor: accentColor + '22' }]}>
                  <Text style={[styles.stepBadgeText, { color: accentColor }]}>{i + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'white',
    fontSize: 17,
    fontFamily: 'Viral-Black',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  backButtonCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  backButtonCustomText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '400',
    marginLeft: 2,
  },
  headerTitleCustom: {
    fontFamily: 'Viral-Black',
    color: 'white',
    fontSize: 17,
    flex: 1,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: 'Viral-Black',
    color: 'white',
    fontSize: 20,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
  },
  heroContainer: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
  },
  heroLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  heroBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    maxWidth: '80%',
  },
  heroBadgeText: {
    color: 'white',
    fontFamily: 'Viral-Black',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
    paddingLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modesContainer: {
    gap: 8,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
  },
  modeCardBg: {
    ...StyleSheet.absoluteFillObject,
  },
  modeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiPhoneContainer: {
    flexDirection: 'row',
  },
  modeTextContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  modeTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modeSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  sectionHeaderTitle: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 14,
  },
  instructionsContainer: {
    gap: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  instructionText: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 20,
  },
  premiumHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  premiumIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 149, 0, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumTextContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  premiumTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  premiumSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  premiumBullets: {
    gap: 8,
    marginBottom: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  premiumButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  premiumButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  premiumButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
