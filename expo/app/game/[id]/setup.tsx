import { Colors } from '@/src/theme/Colors';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Games, GameMode } from '@/src/models/AppModels';
import { useGameStore } from '@/src/store/useGameStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';

import { SetupPlayersSection, SetupRoundsSection, SetupStartButton } from '@/src/components/games/UnifiedSetupComponents';

// ─── Game-specific option types ───
type MemoryGridSize = 'tiny3x4' | 'small4x4' | 'medium4x5' | 'large5x6' | 'huge6x6';
const GRID_SIZES: { id: MemoryGridSize; title: string; subtitle: string; pairs: number }[] = [
  { id: 'tiny3x4', title: '3×4', subtitle: '6 pairs', pairs: 6 },
  { id: 'small4x4', title: '4×4', subtitle: '8 pairs', pairs: 8 },
  { id: 'medium4x5', title: '4×5', subtitle: '10 pairs', pairs: 10 },
  { id: 'large5x6', title: '5×6', subtitle: '15 pairs', pairs: 15 },
  { id: 'huge6x6', title: '6×6', subtitle: '18 pairs', pairs: 18 },
];

const MP_DIFFICULTIES = [
  { id: 'easy', gridSize: 5, color: Colors.green },
  { id: 'medium', gridSize: 6, color: Colors.orange },
  { id: 'hard', gridSize: 7, color: Colors.red },
  { id: 'expert', gridSize: 8, color: '#AF52DE' },
];

const MP_MODES = [
  { id: 'timeRace', title: 'Time Race', icon: 'timer' },
  { id: 'turnBased', title: 'Turn-Based', icon: 'arrow.trianglehead.2.clockwise.rotate.90' },
];

const TIO_GRID_SIZES = [4, 5, 6, 7];
const TIO_TILE_OPTIONS: Record<number, number[]> = {
  4: [4, 6, 8, 10],
  5: [6, 8, 10, 14],
  6: [8, 10, 14, 18],
  7: [10, 14, 18, 24],
};

export default function GameSetupScreen() {
  const { id } = useLocalSearchParams<{ id: string, mode: GameMode }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startSingleDeviceSession } = useGameStore();
  const { lastGameConfigs, lastPlayerNames, saveGameConfig, playerName } = useSettingsStore();
  
  
  const gameKey = Object.keys(Games).find(key => Games[key].id === id);
  const game = gameKey ? Games[gameKey] : null;

  // Default player names: Player 1 = the user's onboarding name; everyone else is blank.
  const getDefaultPlayerNames = (count: number): string[] => {
    return Array.from({ length: count }, (_, i) => (i === 0 ? (playerName || '') : ''));
  };

  const [playerCount, setPlayerCount] = useState(game ? Math.max(game.minPlayers, Math.min(2, game.maxPlayers)) : 2);
  const [playerNames, setPlayerNames] = useState<string[]>(
    () => getDefaultPlayerNames(game ? Math.max(game.minPlayers, Math.min(2, game.maxPlayers)) : 2)
  );
  const [showDuplicateError, setShowDuplicateError] = useState(false);
  const [roundCount, setRoundCount] = useState(3);

  // Games that have rounds (not grid/special games)
  const needsRounds = !['reverse_singing', 'memory_grid', 'memory_path', 'tap_in_order', 'ten_tangle', 'color_trap', 'spin_bottle', 'draw_rush', 'reaction_time', 'eye_sight', 'drum_challenge'].includes(id || '');

  // ─── Memory Grid state ───
  const [mgGridSize, setMgGridSize] = useState<MemoryGridSize>('tiny3x4');

  // ─── Memory Path state ───
  const [mpDifficulty, setMpDifficulty] = useState('easy');
  const [mpGameMode, setMpGameMode] = useState('timeRace');
  const [mpSteps, setMpSteps] = useState(6);

  // ─── Tap In Order state ───
  const [tioGridSize, setTioGridSize] = useState(4);
  const [tioTileCount, setTioTileCount] = useState(6);

  // ─── Spin Bottle (Truth & Dare) state ───
  const [sbDifficulty, setSbDifficulty] = useState<'mild'|'classic'|'bold'>('classic');

  // ─── Color Trap state ───
  const [ctDifficulty, setCtDifficulty] = useState<'easy'|'medium'|'hard'>('medium');

  // ─── Draw Rush state ───
  const [drConceptMode, setDrConceptMode] = useState<'preset'|'freeDraw'>('preset');

  // ─── Drum Challenge state ───
  const [drumMode, setDrumMode] = useState<'whitney'|'metronome'>('whitney');
  const [metronomeCycles, setMetronomeCycles] = useState(4);
  const [metronomeRhythm, setMetronomeRhythm] = useState<'4/4'|'3/4'|'fast'>('4/4');

  // ─── Imposter state ───
  const [imposterStyle, setImposterStyle] = useState<'discussion'|'clue'>('discussion');

  // ─── Restore last-used configs from persistent storage ───
  useEffect(() => {
    if (!id) return;
    const saved = lastGameConfigs[id];
    const savedNames = lastPlayerNames[id];
    if (savedNames?.length) {
      setPlayerCount(savedNames.length);
      const namesToRestore = savedNames.map((name, index) => {
        if (index === 0 && playerName) return playerName;
        if (name.trim() === `Player ${index + 1}`) return '';
        return name;
      });
      setPlayerNames(namesToRestore);
    }
    if (!saved) return;
    if (id === 'memory_grid' && saved.gridSize) setMgGridSize(saved.gridSize);
    if (id === 'memory_path') {
      if (saved.gameMode) setMpGameMode(saved.gameMode);
      if (saved.gridSize) setMpDifficulty(saved.gridSize);
      if (saved.pathLength) setMpSteps(saved.pathLength);
    }
    if (id === 'tap_in_order') {
      if (saved.gridSize) setTioGridSize(saved.gridSize);
      if (saved.tileCount) setTioTileCount(saved.tileCount);
    }
    if (id === 'spin_bottle' && saved.difficulty) setSbDifficulty(saved.difficulty);
    if (id === 'color_trap' && saved.difficulty) setCtDifficulty(saved.difficulty);
    if (id === 'draw_rush' && saved.conceptMode) setDrConceptMode(saved.conceptMode);
    if (id === 'drum_challenge') {
      if (saved.drumMode) setDrumMode(saved.drumMode);
      if (saved.metronomeCycles) setMetronomeCycles(saved.metronomeCycles);
      if (saved.metronomeRhythm) setMetronomeRhythm(saved.metronomeRhythm);
    }
    if (id === 'imposter' && saved.gameStyle) setImposterStyle(saved.gameStyle);
  }, [id]);

  // Clamp TIO tile count when grid changes
  useEffect(() => {
    const opts = TIO_TILE_OPTIONS[tioGridSize] || [6];
    if (!opts.includes(tioTileCount)) setTioTileCount(opts[1] || opts[0]);
  }, [tioGridSize]);

  // Clamp MP steps when difficulty changes
  useEffect(() => {
    const diff = MP_DIFFICULTIES.find(d => d.id === mpDifficulty);
    if (!diff) return;
    const sz = diff.gridSize;
    const minSteps = Math.max(3, sz - 1);
    const maxSteps = Math.floor(sz * sz / 2);
    const defaults: Record<string, number> = { easy: 6, medium: 10, hard: 14, expert: 18 };
    setMpSteps(Math.min(Math.max(defaults[mpDifficulty] || 6, minSteps), maxSteps));
  }, [mpDifficulty]);

  if (!game) {
    return (
      <View style={st.container}>
        <AppBackgroundView />
        <View style={st.centerContent}>
          <Text style={st.errorText}>Game not found</Text>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} style={st.backBtn}>
            <Text style={st.backBtnTx}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasDuplicateNames = () => {
    const trimmed = playerNames.map(n => n.trim().toLowerCase()).filter(n => n.length > 0);
    return new Set(trimmed).size !== trimmed.length;
  };

  const updatePlayerName = (index: number, name: string) => {
    const n = [...playerNames]; n[index] = name; setPlayerNames(n);
    if (showDuplicateError) setShowDuplicateError(false);
  };

  const handleStart = () => {
    // Default empty names to "Player N"
    const finalNames = playerNames.map((n, i) => n.trim() || `Player ${i + 1}`);
    if (hasDuplicateNames()) { setShowDuplicateError(true); return; }

    // Build game-specific config
    let config: Record<string, any> = {};
    switch (id) {
      case 'memory_grid':
        config = { gridSize: mgGridSize }; break;
      case 'memory_path':
        config = { gameMode: mpGameMode, gridSize: mpDifficulty, pathLength: mpSteps }; break;
      case 'tap_in_order':
        config = { gridSize: tioGridSize, tileCount: tioTileCount }; break;
      case 'spin_bottle':
        config = { difficulty: sbDifficulty }; break;
      case 'color_trap':
        config = { difficulty: ctDifficulty }; break;
      case 'draw_rush':
        config = { conceptMode: drConceptMode }; break;
      case 'drum_challenge':
        config = { drumMode, metronomeCycles, metronomeRhythm }; break;
      case 'imposter':
        config = { gameStyle: imposterStyle }; break;
    }

    startSingleDeviceSession(game!, finalNames, needsRounds ? roundCount : 1, config);
    saveGameConfig(id!, config, finalNames);
    router.push(`/game/${id}/session` as any);
  };

  // ─── Subtitle for start button ───
  const getSubtitle = () => {
    switch (id) {
      case 'memory_grid': {
        const gs = GRID_SIZES.find(g => g.id === mgGridSize);
        return `${gs?.title} · ${gs?.pairs} pairs · ${playerCount} players`;
      }
      case 'memory_path': {
        const diff = MP_DIFFICULTIES.find(d => d.id === mpDifficulty);
        const mode = MP_MODES.find(m => m.id === mpGameMode);
        return `${diff?.gridSize}×${diff?.gridSize} · ${mpSteps} steps · ${mode?.title}`;
      }
      case 'tap_in_order':
        return `Number Memory · ${tioGridSize}×${tioGridSize} · ${tioTileCount} tiles`;
      default:
        return `${playerCount} players`;
    }
  };

  const mpDiffObj = MP_DIFFICULTIES.find(d => d.id === mpDifficulty)!;
  const mpMinSteps = Math.max(3, (mpDiffObj?.gridSize || 5) - 1);
  const mpMaxSteps = Math.floor((mpDiffObj?.gridSize || 5) ** 2 / 2);

  return (
    <View style={st.container}>
      <AppBackgroundView />
      
      <Stack.Screen 
        options={{
          title: `${game.name} — Setup`,
          headerShown: true,
          headerTransparent: true,
          headerBlurEffect: 'dark',
          headerTintColor: 'white',
          headerTitleStyle: { fontFamily: 'Viral-Black', fontSize: 20 },
          headerBackVisible: false,
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 8,
                paddingVertical: 6,
              }}
            >
              <IconSymbol name="chevron.left" size={18} color="#007AFF" />
              <Text style={{ color: '#007AFF', fontSize: 17, fontWeight: '400', marginLeft: 2 }}>Back</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView 
        contentContainerStyle={[st.scrollContent, { paddingTop: Platform.OS === 'android' ? insets.top + 60 : 0 }]} 
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        
        <SetupPlayersSection
          playerCount={playerCount}
          playerNames={playerNames}
          minPlayers={game.minPlayers}
          maxPlayers={game.maxPlayers}
          onUpdateCount={(count) => {
            setPlayerCount(count);
            if (count > playerNames.length) {
              const newNames = Array.from({ length: count - playerNames.length }, () => '');
              setPlayerNames([...playerNames, ...newNames]);
            } else {
              setPlayerNames(playerNames.slice(0, count));
            }
          }}
          onUpdateName={updatePlayerName}
        />
        
        {/* Rounds section for non-phase-2 games */}
        {needsRounds && (
          <SetupRoundsSection
            roundCount={roundCount}
            minRounds={1}
            maxRounds={10}
            onUpdateRounds={setRoundCount}
          />
        )}

        {showDuplicateError && (
          <Text style={st.errorLabel}>Two or more players have the same name.</Text>
        )}

        {/* ══════════ IMPOSTER: Game Style ══════════ */}
        {id === 'imposter' && (
          <View style={st.card}>
            <View style={st.cardHeader}>
              <IconSymbol name="theatermasks.fill" size={16} color="#AF52DE" />
              <Text style={[st.cardTitle, { color: '#AF52DE' }]}>Game Style</Text>
            </View>
            {([
              { id: 'discussion' as const, title: 'Discussion Mode', subtitle: 'Talk together and find the Imposter', icon: 'bubble.left.and.bubble.right.fill', details: 'Free discussion · Timed conversation · Then voting', color: Colors.orange },
              { id: 'clue' as const, title: 'Clue Mode', subtitle: 'Give clues one by one', icon: 'magnifyingglass.circle.fill', details: 'Turn-based clues · No discussion · Then voting', color: '#AF52DE' },
            ]).map(style => {
              const sel = imposterStyle === style.id;
              return (
                <TouchableOpacity key={style.id} onPress={() => setImposterStyle(style.id)}
                  style={[st.imposterCard, sel && { borderColor: style.color + '99', backgroundColor: style.color + '1A' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: style.color + '33', alignItems: 'center', justifyContent: 'center' }}>
                      <IconSymbol name={style.icon as any} size={18} color={style.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>{style.title}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{style.subtitle}</Text>
                    </View>
                    {sel && <IconSymbol name="checkmark.circle.fill" size={20} color={style.color} />}
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 8 }}>{style.details}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ══════════ MEMORY GRID: Board Size ══════════ */}
        {id === 'memory_grid' && (
          <View style={st.card}>
            <View style={st.cardHeader}>
              <IconSymbol name="square.grid.3x3.fill" size={16} color="#5AC8FA" />
              <Text style={[st.cardTitle, { color: '#5AC8FA' }]}>Board Size</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {GRID_SIZES.map(sz => {
                  const sel = mgGridSize === sz.id;
                  return (
                    <TouchableOpacity key={sz.id} onPress={() => setMgGridSize(sz.id)}
                      style={[st.optionChip, sel && st.optionChipSelected, sel && { borderColor: 'rgba(90,200,250,0.5)', backgroundColor: 'rgba(90,200,250,0.2)' }]}>
                      <Text style={[st.optionChipTitle, sel && { color: '#fff' }]}>{sz.title}</Text>
                      <Text style={[st.optionChipSub, sel && { color: 'rgba(255,255,255,0.7)' }]}>{sz.subtitle}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ══════════ MEMORY PATH: Game Mode ══════════ */}
        {id === 'memory_path' && (
          <>
            <View style={st.card}>
              <View style={st.cardHeader}>
                <IconSymbol name="gamecontroller.fill" size={16} color="#00C7BE" />
                <Text style={[st.cardTitle, { color: '#00C7BE' }]}>Game Mode</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                {MP_MODES.map(gm => {
                  const sel = mpGameMode === gm.id;
                  return (
                    <TouchableOpacity key={gm.id} onPress={() => setMpGameMode(gm.id)}
                      style={[st.modeChip, sel && { borderColor: 'rgba(0,199,190,0.5)', backgroundColor: 'rgba(0,199,190,0.2)' }]}>
                      <IconSymbol name={gm.icon as any} size={22} color={sel ? '#00C7BE' : 'rgba(255,255,255,0.4)'} />
                      <Text style={[st.modeChipTx, sel && { color: '#fff' }]}>{gm.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Grid Size / Difficulty */}
            <View style={st.card}>
              <View style={st.cardHeader}>
                <IconSymbol name="square.grid.3x3" size={16} color="#00C7BE" />
                <Text style={[st.cardTitle, { color: '#00C7BE' }]}>Grid Size</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {MP_DIFFICULTIES.map(diff => {
                    const sel = mpDifficulty === diff.id;
                    return (
                      <TouchableOpacity key={diff.id} onPress={() => setMpDifficulty(diff.id)}
                        style={[st.optionChip, sel && { borderColor: diff.color + '80', backgroundColor: diff.color + '33' }]}>
                        <Text style={[st.optionChipTitle, sel && { color: '#fff' }]}>{diff.gridSize}×{diff.gridSize}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Path Length stepper */}
            <View style={st.card}>
              <View style={st.cardHeader}>
                <IconSymbol name="map.fill" size={16} color="#00C7BE" />
                <Text style={[st.cardTitle, { color: '#00C7BE' }]}>Path Length</Text>
              </View>
              <View style={st.stepperRow}>
                <TouchableOpacity style={st.stepperCircle} disabled={mpSteps <= mpMinSteps}
                  onPress={() => setMpSteps(s => Math.max(mpMinSteps, s - 1))}>
                  <IconSymbol name="minus" size={14} color={mpSteps <= mpMinSteps ? 'rgba(255,255,255,0.2)' : '#fff'} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={st.stepperValue}>{mpSteps}</Text>
                  <Text style={st.stepperLabel}>steps</Text>
                </View>
                <TouchableOpacity style={st.stepperCircle} disabled={mpSteps >= mpMaxSteps}
                  onPress={() => setMpSteps(s => Math.min(mpMaxSteps, s + 1))}>
                  <IconSymbol name="plus" size={14} color={mpSteps >= mpMaxSteps ? 'rgba(255,255,255,0.2)' : '#fff'} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* ══════════ TAP IN ORDER: Grid Size + Tile Count ══════════ */}
        {id === 'tap_in_order' && (
          <>
            <View style={st.card}>
              <View style={st.cardHeader}>
                <IconSymbol name="square.grid.3x3.fill" size={16} color={Colors.orange} />
                <Text style={[st.cardTitle, { color: Colors.orange }]}>Grid Size</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {TIO_GRID_SIZES.map(sz => {
                    const sel = tioGridSize === sz;
                    return (
                      <TouchableOpacity key={sz} onPress={() => setTioGridSize(sz)}
                        style={[st.optionChip, sel && { borderColor: 'rgba(255,149,0,0.5)', backgroundColor: 'rgba(255,149,0,0.2)' }]}>
                        <Text style={[st.optionChipTitle, sel && { color: '#fff' }]}>{sz}×{sz}</Text>
                        <Text style={[st.optionChipSub, sel && { color: 'rgba(255,255,255,0.7)' }]}>{sz*sz} cells</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View style={st.card}>
              <View style={st.cardHeader}>
                <IconSymbol name="number" size={16} color={Colors.orange} />
                <Text style={[st.cardTitle, { color: Colors.orange }]}>Numbers</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(TIO_TILE_OPTIONS[tioGridSize] || [6]).map(cnt => {
                    const sel = tioTileCount === cnt;
                    return (
                      <TouchableOpacity key={cnt} onPress={() => setTioTileCount(cnt)}
                        style={[st.optionChip, sel && { borderColor: 'rgba(255,149,0,0.5)', backgroundColor: 'rgba(255,149,0,0.2)' }]}>
                        <Text style={[st.optionChipTitle, sel && { color: '#fff', fontSize: 20 }]}>{cnt}</Text>
                        <Text style={[st.optionChipSub, sel && { color: 'rgba(255,255,255,0.7)' }]}>numbers</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </>
        )}

        {/* ══════════ SPIN BOTTLE: Difficulty ══════════ */}
        {id === 'spin_bottle' && (
          <View style={st.card}>
            <View style={st.cardHeader}>
              <IconSymbol name="flame.fill" size={16} color="#FF2D55" />
              <Text style={[st.cardTitle, { color: '#FF2D55' }]}>Vibe Level</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              {([{id:'mild',title:'Mild',sub:'Safe & friendly',icon:'heart.fill',color:Colors.green},{id:'classic',title:'Classic',sub:'Balanced fun',icon:'star.fill',color:Colors.orange},{id:'bold',title:'Bold',sub:'Spicy & risky',icon:'flame.fill',color:'#FF2D55'}] as const).map(d => {
                const sel = sbDifficulty === d.id;
                return (
                  <TouchableOpacity key={d.id} onPress={() => setSbDifficulty(d.id)}
                    style={[st.modeChip, sel && { borderColor: d.color + '80', backgroundColor: d.color + '33' }]}>
                    <IconSymbol name={d.icon as any} size={20} color={sel ? d.color : 'rgba(255,255,255,0.4)'} />
                    <Text style={[st.modeChipTx, sel && { color: '#fff' }]}>{d.title}</Text>
                    <Text style={{color: sel ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2}}>{d.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ══════════ COLOR TRAP: Difficulty ══════════ */}
        {id === 'color_trap' && (
          <View style={st.card}>
            <View style={st.cardHeader}>
              <IconSymbol name="bolt.fill" size={16} color="#5AC8FA" />
              <Text style={[st.cardTitle, { color: '#5AC8FA' }]}>Difficulty</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([{id:'easy',title:'Easy',sub:'Slower tiles'},{id:'medium',title:'Medium',sub:'Standard'},{id:'hard',title:'Hard',sub:'Fast & furious'}] as const).map(d => {
                  const sel = ctDifficulty === d.id;
                  return (
                    <TouchableOpacity key={d.id} onPress={() => setCtDifficulty(d.id)}
                      style={[st.optionChip, sel && { borderColor: 'rgba(90,200,250,0.5)', backgroundColor: 'rgba(90,200,250,0.2)' }]}>
                      <Text style={[st.optionChipTitle, sel && { color: '#fff' }]}>{d.title}</Text>
                      <Text style={[st.optionChipSub, sel && { color: 'rgba(255,255,255,0.7)' }]}>{d.sub}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ══════════ DRAW RUSH: Concept Mode ══════════ */}
        {id === 'draw_rush' && (
          <View style={st.card}>
            <View style={st.cardHeader}>
              <IconSymbol name={"pencil.and.scribble" as any} size={16} color="#007AFF" />
              <Text style={[st.cardTitle, { color: '#007AFF' }]}>Concept Mode</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              {([{id:'preset',title:'Preset',sub:'Secret word given',icon:'text.book.closed.fill'},{id:'freeDraw',title:'Free Draw',sub:'Drawer picks idea',icon:'sparkles'}] as const).map(d => {
                const sel = drConceptMode === d.id;
                return (
                  <TouchableOpacity key={d.id} onPress={() => setDrConceptMode(d.id)}
                    style={[st.modeChip, sel && { borderColor: 'rgba(0,122,255,0.5)', backgroundColor: 'rgba(0,122,255,0.2)' }]}>
                    <IconSymbol name={d.icon as any} size={20} color={sel ? '#007AFF' : 'rgba(255,255,255,0.4)'} />
                    <Text style={[st.modeChipTx, sel && { color: '#fff' }]}>{d.title}</Text>
                    <Text style={{color: sel ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2}}>{d.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ══════════ DRUM CHALLENGE: Game Mode ══════════ */}
        {id === 'drum_challenge' && (
          <View style={st.card}>
            <View style={st.cardHeader}>
              <IconSymbol name="music.quarternote.3" size={16} color="#AF52DE" />
              <Text style={[st.cardTitle, { color: '#AF52DE' }]}>Game Mode</Text>
            </View>
            <View style={{ flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {([
                { id: 'whitney', title: 'Whitney Houston', sub: 'The iconic beat drop', icon: 'mic.fill', color: Colors.green },
                { id: 'metronome', title: 'Metronome', sub: 'Pure internal timing test', icon: 'metronome', color: '#AF52DE' }
              ] as const).map(d => {
                const sel = drumMode === d.id;
                return (
                  <TouchableOpacity key={d.id} onPress={() => setDrumMode(d.id)}
                    style={[st.imposterCard, sel && { borderColor: d.color + '99', backgroundColor: d.color + '1A' }, { marginTop: 0 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.color + '33', alignItems: 'center', justifyContent: 'center' }}>
                        <IconSymbol name={d.icon as any} size={18} color={d.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>{d.title}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{d.sub}</Text>
                      </View>
                      {sel && <IconSymbol name="checkmark.circle.fill" size={20} color={d.color} />}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {drumMode === 'metronome' && (
                <View style={{ marginTop: 16, gap: 16 }}>
                  <View>
                    <Text style={{ color: 'white', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Cycles to Memorize</Text>
                    <View style={st.stepperRow}>
                      <TouchableOpacity style={st.stepperCircle} disabled={metronomeCycles <= 2}
                        onPress={() => setMetronomeCycles(c => Math.max(2, c - 1))}>
                        <IconSymbol name="minus" size={14} color={metronomeCycles <= 2 ? 'rgba(255,255,255,0.2)' : '#fff'} />
                      </TouchableOpacity>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={st.stepperValue}>{metronomeCycles}</Text>
                        <Text style={st.stepperLabel}>cycles</Text>
                      </View>
                      <TouchableOpacity style={st.stepperCircle} disabled={metronomeCycles >= 10}
                        onPress={() => setMetronomeCycles(c => Math.min(10, c + 1))}>
                        <IconSymbol name="plus" size={14} color={metronomeCycles >= 10 ? 'rgba(255,255,255,0.2)' : '#fff'} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View>
                    <Text style={{ color: 'white', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Rhythm</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {([
                        { id: '4/4', title: '4/4 Time', sub: 'Standard 120BPM' },
                        { id: '3/4', title: '3/4 Time', sub: 'Waltz 100BPM' },
                        { id: 'fast', title: 'Fast 4/4', sub: 'Speed 160BPM' }
                      ] as const).map(r => {
                        const sel = metronomeRhythm === r.id;
                        return (
                          <TouchableOpacity key={r.id} onPress={() => setMetronomeRhythm(r.id)}
                            style={[st.optionChip, { flex: 1 }, sel && { borderColor: '#AF52DE80', backgroundColor: '#AF52DE33' }]}>
                            <Text style={[st.optionChipTitle, sel && { color: '#fff', fontSize: 14 }]} numberOfLines={1}>{r.title}</Text>
                            <Text style={[st.optionChipSub, sel && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>{r.sub}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Bottom Start Button */}
      <View style={[st.bottomBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
        <SetupStartButton subtitle={getSubtitle()} onPress={handleStart} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'white', fontSize: 17, fontWeight: 'bold', marginBottom: 20 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 },
  backBtnTx: { color: 'white', fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120, gap: 14 },
  errorLabel: { color: Colors.red, fontSize: 13, marginTop: 4 },

  // SurfaceCard style matching iOS
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600' },

  // Option chips (horizontal scroll pickers) 
  optionChip: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, minWidth: 56,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  optionChipSelected: {},
  optionChipTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 'bold' },
  optionChipSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  // Mode chips (wider, with icon)
  modeChip: {
    flex: 1, alignItems: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  modeChipTx: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 'bold' },

  // Stepper (Path Length)
  stepperRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 6 },
  stepperCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepperValue: { color: '#00C7BE', fontSize: 28, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  stepperLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '500' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  imposterCard: {
    marginTop: 10, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
});
