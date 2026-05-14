import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, TouchableOpacity, Platform, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { LiquidGlass } from '@/src/components/LiquidGlass';
import { Colors } from '@/src/theme/Colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GamesDefinitions, GameMode, GameModeDetails } from '@/src/models/AppModels';
import { GameCardView } from '@/components/ui/GameCardView';
import { OtherFunListView } from '@/src/components/games/OtherFunListView';

export default function GamesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ defaultTab?: string; resetAt?: string }>();
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [selectedLibraryTab, setSelectedLibraryTab] = useState<'Games' | 'Ideas'>('Games');
  const [selectedModeFilter, setSelectedModeFilter] = useState<GameMode | null>(null);

  useEffect(() => {
    if (params.defaultTab === 'Games') {
      setSelectedLibraryTab('Games');
    }
  }, [params.defaultTab, params.resetAt]);

  const filteredGames = GamesDefinitions.filter(game => 
    selectedModeFilter ? game.id.supportedModes.includes(selectedModeFilter) : true
  );

  const effectiveWidth = containerWidth > 0 ? containerWidth : 0;
  const columnWidth = effectiveWidth > 0 ? (effectiveWidth - 12) / 2 : 0; // gap 12

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 6, paddingBottom: 120 }]} onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width - 32)}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={require('@/assets/images/partybot-logo.png')} style={styles.logoImage} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => router.push('/lobby/join')} activeOpacity={0.85}>
            <LiquidGlass variant="high" radius={20} style={styles.joinButton} shadow={false}>
              <IconSymbol name="number" size={13} color="#fff" />
              <Text style={styles.joinText}>Join</Text>
            </LiquidGlass>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.85}>
            <LiquidGlass variant="mid" radius={20} style={styles.profileButton} shadow={false}>
              <IconSymbol name="person.crop.circle" size={22} color="white" />
            </LiquidGlass>
          </TouchableOpacity>
        </View>

        {/* Library Tabs (Games | Ideas) */}
        <View style={styles.libraryTabsContainer}>
          <LiquidGlass variant="high" radius={30} style={styles.libraryTabsWrapperOuter} shadow>
            <View style={styles.libraryTabsInner}>
              <TouchableOpacity 
                style={[styles.libraryTab, selectedLibraryTab === 'Games' ? styles.libraryTabActive : null]}
                onPress={() => setSelectedLibraryTab('Games')}
              >
                <IconSymbol name="gamecontroller.fill" size={14} color={selectedLibraryTab === 'Games' ? "white" : "rgba(255,255,255,0.6)"} weight="bold" />
                <Text style={selectedLibraryTab === 'Games' ? styles.libraryTabTextActive : styles.libraryTabText}>Games</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.libraryTab, selectedLibraryTab === 'Ideas' ? styles.libraryTabActive : null]}
                onPress={() => setSelectedLibraryTab('Ideas')}
              >
                <IconSymbol name="shippingbox.fill" size={14} color={selectedLibraryTab === 'Ideas' ? "white" : "rgba(255,255,255,0.6)"} weight="bold" />
                <Text style={selectedLibraryTab === 'Ideas' ? styles.libraryTabTextActive : styles.libraryTabText}>Ideas</Text>
              </TouchableOpacity>
            </View>
          </LiquidGlass>
        </View>

        {selectedLibraryTab === 'Games' ? (
          <>
            {/* Mode Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeFilterContainer}>
              <TouchableOpacity 
                style={[styles.modeFilterChip, selectedModeFilter === null && styles.modeFilterChipActive]}
                onPress={() => setSelectedModeFilter(null)}
                activeOpacity={0.7}
              >
                <IconSymbol
                  name="square.grid.2x2.fill"
                  size={11}
                  color={selectedModeFilter === null ? Colors.blue : 'rgba(255,255,255,0.55)'}
                />
                <Text style={[styles.modeFilterText, selectedModeFilter === null && styles.modeFilterTextActive]}>All</Text>
              </TouchableOpacity>
              {Object.values(GameMode).map(mode => {
                const isActive = selectedModeFilter === mode;
                return (
                  <TouchableOpacity 
                    key={mode}
                    style={[styles.modeFilterChip, isActive && styles.modeFilterChipActive]}
                    onPress={() => setSelectedModeFilter(mode)}
                    activeOpacity={0.7}
                  >
                    <IconSymbol
                      name={GameModeDetails[mode].icon as any}
                      size={11}
                      color={isActive ? Colors.blue : 'rgba(255,255,255,0.55)'}
                    />
                    <Text style={[styles.modeFilterText, isActive && styles.modeFilterTextActive]}>
                      {GameModeDetails[mode].title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Game Grid */}
            <View style={styles.gamesGrid}>
              {columnWidth > 0 && filteredGames.map((game) => (
                <View key={game.id.id} style={{ width: columnWidth }}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/game/${game.id.id}` as any)}>
                    <GameCardView game={game} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Empty State */}
            {filteredGames.length === 0 && (
              <View style={styles.emptyStateContainer}>
                <IconSymbol name="gamecontroller" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyStateTitle}>No Games</Text>
                <Text style={styles.emptyStateDesc}>
                  {selectedModeFilter === null 
                    ? "Games will appear here as they are added." 
                    : "No games support this mode yet."}
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.ideasContainer}>
            <OtherFunListView />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  title: {
    fontFamily: 'Viral-Black',
    fontSize: 25,
    color: 'white',
  },
  logo: {
    width: 150,
    height: 36,
  },
  logoImage: {
    height: 30,
    width: 140,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  joinText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  profileButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libraryTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  libraryTabsWrapperOuter: {
    borderRadius: 30,
    padding: 4,
    maxWidth: 260,
    width: '100%',
  },
  libraryTabsInner: {
    flexDirection: 'row',
  },
  libraryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  libraryTabActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.95)',
    shadowColor: Colors.blue,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  libraryTabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  libraryTabTextActive: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  modeFilterContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 20,
  },
  modeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: Platform.OS === 'android' ? Colors.surface2 : 'rgba(255,255,255,0.05)',
  },
  modeFilterChipActive: {
    borderColor: 'rgba(10, 132, 255, 0.45)',
    backgroundColor: 'rgba(10, 132, 255, 0.10)',
  },
  modeFilterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    includeFontPadding: false,
  },
  modeFilterTextActive: {
    color: Colors.blue,
    fontWeight: '600',
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  ideasContainer: {
    paddingVertical: 10,
  },
  ideasPlaceholderText: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Viral-Regular',
    fontSize: 16,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    gap: 8,
  },
  emptyStateTitle: {
    color: 'white',
    fontSize: 17,
    fontFamily: 'Viral-Black',
    marginTop: 8,
  },
  emptyStateDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
  },
});
