import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GameDefinition, GameModeDetails, getPlayerCountText } from '@/src/models/AppModels';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { platformShadow } from '@/src/theme/Colors';

// Platform-safe BlurView (iOS only)
let BlurView: any = null;
if (Platform.OS === 'ios') {
  try { BlurView = require('expo-blur').BlurView; } catch {}
}

interface GameCardViewProps {
  game: GameDefinition;
  isLocked?: boolean;
}

/** iOS: vivid translucent gradient (Liquid Glass language). */
const getIOSGradient = (accentName: string): [string, string, string] => {
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

/**
 * Android Material 3 Expressive palette per accent.
 *  - container: deep tonal surface (the card body)
 *  - primary:   bright key color (icon, accents)
 *  - onSurface: bold colored title
 *  - halo:      soft radial-feeling accent glow at top
 */
type AndroidPalette = {
  container: string;
  containerEdge: string;
  primary: string;
  onSurface: string;
  halo: [string, string];
  chipBg: string;
};

const getAndroidPalette = (accentName: string): AndroidPalette => {
  switch (accentName) {
    case 'pink':
      return { container: '#2A1220', containerEdge: '#3D1A2F', primary: '#FF8AB8', onSurface: '#FFD3E2', halo: ['rgba(255, 105, 180, 0.45)', 'rgba(255, 105, 180, 0)'], chipBg: 'rgba(255, 138, 184, 0.18)' };
    case 'cyan':
      return { container: '#0F1F2A', containerEdge: '#163040', primary: '#7CD3FF', onSurface: '#CFEBFF', halo: ['rgba(50, 173, 230, 0.45)', 'rgba(50, 173, 230, 0)'], chipBg: 'rgba(124, 211, 255, 0.16)' };
    case 'teal':
      return { container: '#0E2326', containerEdge: '#143539', primary: '#7FE6D1', onSurface: '#C9F4E9', halo: ['rgba(48, 199, 170, 0.45)', 'rgba(48, 199, 170, 0)'], chipBg: 'rgba(127, 230, 209, 0.16)' };
    case 'orange':
      return { container: '#2A1607', containerEdge: '#3F210B', primary: '#FFB770', onSurface: '#FFE0BD', halo: ['rgba(255, 149, 0, 0.5)', 'rgba(255, 149, 0, 0)'], chipBg: 'rgba(255, 183, 112, 0.18)' };
    case 'red':
      return { container: '#2A0F0E', containerEdge: '#3D1815', primary: '#FF8E84', onSurface: '#FFD0CC', halo: ['rgba(255, 59, 48, 0.5)', 'rgba(255, 59, 48, 0)'], chipBg: 'rgba(255, 142, 132, 0.18)' };
    case 'yellow':
      return { container: '#241D04', containerEdge: '#362C09', primary: '#FFE070', onSurface: '#FFF1B8', halo: ['rgba(255, 204, 0, 0.5)', 'rgba(255, 204, 0, 0)'], chipBg: 'rgba(255, 224, 112, 0.18)' };
    case 'purple':
      return { container: '#1E132E', containerEdge: '#2C1B44', primary: '#C99CFF', onSurface: '#E8D5FF', halo: ['rgba(175, 82, 222, 0.45)', 'rgba(175, 82, 222, 0)'], chipBg: 'rgba(201, 156, 255, 0.18)' };
    default:
      return { container: '#0F1830', containerEdge: '#172447', primary: '#7AB6FF', onSurface: '#D2E4FF', halo: ['rgba(0, 122, 255, 0.45)', 'rgba(0, 122, 255, 0)'], chipBg: 'rgba(122, 182, 255, 0.16)' };
  }
};

const getAccentColor = (accentName: string): string => {
  switch (accentName) {
    case 'pink': return '#FF69B4';
    case 'cyan': return '#32ADE6';
    case 'teal': return '#30B0C7';
    case 'orange': return '#FF9500';
    case 'red': return '#FF3B30';
    case 'yellow': return '#FFCC00';
    case 'purple': return '#AF52DE';
    default: return '#007AFF';
  }
};

export const GameCardView: React.FC<GameCardViewProps> = ({ game, isLocked = false }) => {
  if (Platform.OS === 'android') {
    return <AndroidGameCard game={game} isLocked={isLocked} />;
  }
  return <IOSGameCard game={game} isLocked={isLocked} />;
};

/* ───────────────────────── iOS (Liquid Glass) ───────────────────────── */

const IOSGameCard: React.FC<GameCardViewProps> = ({ game, isLocked }) => {
  const colors = getIOSGradient(game.accentName);
  const accentColor = getAccentColor(game.accentName);

  return (
    <View style={[iosStyles.container, { shadowColor: accentColor }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />

      <View style={iosStyles.content}>
        <View style={iosStyles.spacerTop} />
        <Text style={iosStyles.title} numberOfLines={2} adjustsFontSizeToFit>
          {game.id.name}
        </Text>
        <View style={iosStyles.spacerMiddle1} />
        <IconSymbol name={game.id.symbolName as any} size={52} color="rgba(255, 255, 255, 0.95)" />
        <View style={iosStyles.spacerMiddle2} />

        <View style={iosStyles.modesContainer}>
          {game.id.supportedModes.map((mode) => {
            const modeDetails = GameModeDetails[mode];
            return (
              <View key={mode} style={iosStyles.modePill}>
                <IconSymbol name={modeDetails.icon as any} size={14} color="rgba(255,255,255,0.85)" />
              </View>
            );
          })}
        </View>

        <Text style={iosStyles.playerCount}>{getPlayerCountText(game.id.minPlayers, game.id.maxPlayers)}</Text>
        <View style={iosStyles.spacerBottom} />
      </View>

      {isLocked && (
        <View style={iosStyles.lockedOverlay}>
          {BlurView ? (
            <BlurView tint="dark" intensity={60} style={iosStyles.lockedIconContainer}>
              <IconSymbol name="lock.fill" size={13} color="white" />
            </BlurView>
          ) : (
            <View style={[iosStyles.lockedIconContainer, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}>
              <IconSymbol name="lock.fill" size={13} color="white" />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

/* ──────────────────── Android (Material 3 Expressive) ──────────────────── */

const AndroidGameCard: React.FC<GameCardViewProps> = ({ game, isLocked }) => {
  const p = getAndroidPalette(game.accentName);

  return (
    <View style={androidStyles.outer}>
      {/* Tonal container */}
      <View style={[androidStyles.container, { backgroundColor: p.container, borderColor: p.containerEdge }]}>
        {/* Top accent halo — gives the card its "lit" Material You feel */}
        <LinearGradient
          colors={p.halo}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={androidStyles.halo}
          pointerEvents="none"
        />

        {/* Subtle bottom shade for depth */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']}
          start={{ x: 0.5, y: 0.4 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={androidStyles.content}>
          <View style={androidStyles.spacerTop} />

          <Text
            style={[androidStyles.title, { color: p.onSurface }]}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {game.id.name}
          </Text>

          <View style={androidStyles.spacerMiddle1} />

          {/* Filled tonal icon disc — Material 3 hero shape */}
          <View style={[androidStyles.iconDisc, { backgroundColor: p.chipBg, borderColor: p.containerEdge }]}>
            <IconSymbol name={game.id.symbolName as any} size={44} color={p.primary} />
          </View>

          <View style={androidStyles.spacerMiddle2} />

          <View style={androidStyles.modesContainer}>
            {game.id.supportedModes.map((mode) => {
              const modeDetails = GameModeDetails[mode];
              return (
                <View key={mode} style={[androidStyles.modeChip, { backgroundColor: p.chipBg, borderColor: p.containerEdge }]}>
                  <IconSymbol name={modeDetails.icon as any} size={14} color={p.primary} />
                </View>
              );
            })}
          </View>

          <Text style={[androidStyles.playerCount, { color: p.onSurface }]}>
            {getPlayerCountText(game.id.minPlayers, game.id.maxPlayers)}
          </Text>

          <View style={androidStyles.spacerBottom} />
        </View>

        {isLocked && (
          <View style={[androidStyles.lockedIconContainer, { backgroundColor: p.containerEdge, borderColor: p.chipBg }]}>
            <IconSymbol name="lock.fill" size={13} color={p.primary} />
          </View>
        )}
      </View>
    </View>
  );
};

const iosStyles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    ...platformShadow(8, '#000', 0.35, 10),
  },
  content: { flex: 1, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  spacerTop: { flex: 1, minHeight: 8 },
  title: {
    fontFamily: 'Viral-Black', fontSize: 20, fontWeight: 'bold', color: 'white',
    textAlign: 'center', minHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  spacerMiddle1: { flex: 0.7, minHeight: 6 },
  spacerMiddle2: { flex: 0.5, minHeight: 4 },
  modesContainer: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  modePill: {
    width: 22, height: 22, borderRadius: 11, overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  playerCount: { fontSize: 10, fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.7)' },
  spacerBottom: { flex: 1, minHeight: 8 },
  lockedOverlay: { position: 'absolute', top: 10, right: 10 },
  lockedIconContainer: {
    width: 28, height: 28, borderRadius: 14, overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.35)',
  },
});

const androidStyles = StyleSheet.create({
  outer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    ...platformShadow(6, '#000', 0.4, 10),
  },
  container: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  halo: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    height: '70%',
  },
  content: { flex: 1, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  spacerTop: { flex: 1, minHeight: 8 },
  title: {
    fontFamily: 'Viral-Black',
    fontSize: 19,
    fontWeight: '800' as const,
    textAlign: 'center',
    letterSpacing: 0.2,
    minHeight: 22,
  },
  spacerMiddle1: { flex: 0.6, minHeight: 6 },
  spacerMiddle2: { flex: 0.5, minHeight: 4 },
  iconDisc: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modesContainer: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  modeChip: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerCount: {
    fontSize: 10,
    fontWeight: '600' as const,
    opacity: 0.75,
    letterSpacing: 0.4,
  },
  spacerBottom: { flex: 1, minHeight: 8 },
  lockedIconContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
