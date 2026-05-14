import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Dimensions, Pressable, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CardCategory, CardCategoryInfo, ALL_CARDS, PartyCard } from '@/src/models/CardModels';

// One-time index by category so we don't scan all 800+ cards on every filter change.
const CARDS_BY_CATEGORY: Record<string, PartyCard[]> = (() => {
  const out: Record<string, PartyCard[]> = {};
  for (const card of ALL_CARDS) {
    if (!out[card.category]) out[card.category] = [];
    out[card.category].push(card);
  }
  return out;
})();

let BlurView: any = null;
if (Platform.OS === 'ios') {
  try { BlurView = require('expo-blur').BlurView; } catch {}
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 0.25 * SCREEN_WIDTH;
const SWIPE_OUT_DURATION = 240;

interface Props {
  categoryId: CardCategory;
}

export function CardsDeckRenderer({ categoryId }: Props) {
  const category = CardCategoryInfo[categoryId];
  const [includeSpicy, setIncludeSpicy] = useState<boolean>(false);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<Set<string>>(new Set());

  const categoryCards = useMemo(() => CARDS_BY_CATEGORY[categoryId] ?? [], [categoryId]);

  const availableSubtypes = useMemo(
    () => Array.from(new Set(categoryCards.map(c => c.subtype))),
    [categoryCards]
  );

  const [deck, setDeck] = useState<PartyCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const deckLengthRef = useRef<number>(0);

  useEffect(() => {
    let cards = categoryCards;
    if (!includeSpicy) cards = cards.filter(c => !c.isSpicy);
    if (selectedSubtype) cards = cards.filter(c => c.subtype === selectedSubtype);
    const next = [...cards].sort(() => Math.random() - 0.5);
    setDeck(next);
    deckLengthRef.current = next.length;
    setCurrentIndex(0);
  }, [categoryCards, includeSpicy, selectedSubtype]);

  const position = useRef(new Animated.ValueXY()).current;

  const forceSwipeRef = useRef<(direction: 'left' | 'right') => void>(() => {});
  const resetPositionRef = useRef<() => void>(() => {});

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderMove: (_event, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipeRef.current('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipeRef.current('left');
        } else {
          resetPositionRef.current();
        }
      },
      onPanResponderTerminate: () => {
        resetPositionRef.current();
      },
    })
  ).current;

  const forceSwipe = (direction: 'left' | 'right') => {
    const x = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  };

  const onSwipeComplete = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      setCurrentIndex(prev => Math.min(prev + 1, deckLengthRef.current));
    } else {
      setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
    position.setValue({ x: 0, y: 0 });
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 6,
      useNativeDriver: false,
    }).start();
  };

  forceSwipeRef.current = forceSwipe;
  resetPositionRef.current = resetPosition;

  const handleShuffle = () => {
    setDeck([...deck].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    position.setValue({ x: 0, y: 0 });
  };

  const handleSave = () => {
    if (currentIndex >= deck.length) return;
    const currentCard = deck[currentIndex];
    const newSaved = new Set(savedCards);
    if (newSaved.has(currentCard.id)) newSaved.delete(currentCard.id);
    else newSaved.add(currentCard.id);
    setSavedCards(newSaved);
  };

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  const prevOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH * 0.25],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const nextOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.25, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const renderFilters = () => {
    const content = (
      <View style={styles.filtersInner}>
        <View style={styles.chipsWrap}>
          <Pressable
            style={[styles.chip, !selectedSubtype && styles.chipActive]}
            onPress={() => setSelectedSubtype(null)}
          >
            <Text style={[styles.chipText, !selectedSubtype && styles.chipTextActive]}>All</Text>
          </Pressable>
          {availableSubtypes.map(subtype => {
            const active = selectedSubtype === subtype;
            return (
              <Pressable
                key={subtype}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedSubtype(active ? null : subtype)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{subtype}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.divider} />

        <Pressable
          style={styles.spicyRow}
          onPress={() => setIncludeSpicy(!includeSpicy)}
        >
          <View style={styles.spicyLeft}>
            <View style={[styles.spicyIcon, includeSpicy && styles.spicyIconActive]}>
              <IconSymbol name="flame.fill" size={13} color={includeSpicy ? '#FFF' : 'rgba(255,255,255,0.55)'} />
            </View>
            <View>
              <Text style={[styles.spicyLabel, includeSpicy && styles.spicyLabelActive]}>Spicy</Text>
            </View>
          </View>
          <View style={[styles.toggleTrack, includeSpicy && styles.toggleTrackActive]}>
            <View style={[styles.toggleKnob, includeSpicy && styles.toggleKnobActive]} />
          </View>
        </Pressable>
      </View>
    );

    return (
      <View style={styles.filtersContainer}>
        {BlurView ? (
          <BlurView intensity={40} tint="dark" style={styles.filtersBlur}>
            {content}
          </BlurView>
        ) : (
          <View style={[styles.filtersBlur, { backgroundColor: 'rgba(20,20,30,0.85)' }]}>
            {content}
          </View>
        )}
      </View>
    );
  };

  const renderCards = () => {
    if (currentIndex >= deck.length) {
      return (
        <View style={styles.emptyDeck}>
          <IconSymbol name="sparkle.magnifyingglass" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyTextTitle}>No more cards</Text>
          <Text style={styles.emptyText}>Change your filters or shuffle to start over.</Text>
          <Pressable style={styles.shuffleAgain} onPress={handleShuffle}>
            <IconSymbol name="shuffle" size={16} color="black" />
            <Text style={styles.shuffleAgainText}>Shuffle deck</Text>
          </Pressable>
        </View>
      );
    }

    const VISIBLE_BEHIND = 3;
    return deck.map((card, index) => {
      const offset = index - currentIndex;
      if (offset < 0 || offset > VISIBLE_BEHIND) return null;

      if (offset === 0) {
        return (
          <Animated.View
            key={card.id}
            style={[
              styles.cardStyle,
              {
                zIndex: 99,
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  { rotate },
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <CardFace card={card} category={category} />
            <Animated.View style={[styles.stamp, styles.stampLike, { opacity: prevOpacity }]}>
              <Text style={styles.stampText}>PREV</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampNope, { opacity: nextOpacity }]}>
              <Text style={styles.stampText}>NEXT</Text>
            </Animated.View>
          </Animated.View>
        );
      }

      // Stacked cards behind — peek from left & right so swipe affordance is obvious
      const scale = 1 - 0.04 * offset;
      const sideShift = 22 * offset; // horizontal peek
      const direction = offset % 2 === 0 ? 1 : -1; // alternate sides
      const tilt = direction * (4 + offset * 1.5);
      const top = 6 * offset;
      return (
        <View
          key={card.id}
          style={[
            styles.cardStyle,
            {
              top,
              transform: [
                { translateX: direction * sideShift },
                { scale },
                { rotate: `${tilt}deg` },
              ],
              zIndex: 50 - offset,
              opacity: 1 - 0.12 * offset,
            },
          ]}
          pointerEvents="none"
        >
          <CardBack category={category} />
        </View>
      );
    }).reverse();
  };

  const renderActionBar = () => {
    if (currentIndex >= deck.length) return null;
    const currentCard = deck[currentIndex];
    const isSaved = currentCard ? savedCards.has(currentCard.id) : false;
    const total = deck.length;
    const progress = (currentIndex + 1) / Math.max(total, 1);

    return (
      <View style={styles.actionWrap}>
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: category.accentColor }]} />
          </View>
          <Text style={styles.progressText}>{currentIndex + 1} / {total}</Text>
        </View>

        <View style={styles.actionBar}>
          <Pressable style={styles.actionButton} onPress={handleSave} hitSlop={8}>
            <IconSymbol name={isSaved ? 'bookmark.fill' : 'bookmark'} size={22} color={isSaved ? category.accentColor : 'white'} />
          </Pressable>

          <Pressable style={styles.nextButton} onPress={() => forceSwipe('left')}>
            <Text style={styles.nextButtonText}>Next</Text>
            <IconSymbol name="arrow.right" size={18} color="black" />
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleShuffle} hitSlop={8}>
            <IconSymbol name="shuffle" size={22} color="white" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderFilters()}
      <View style={styles.deckContainer}>
        {renderCards()}
      </View>
      {renderActionBar()}
    </View>
  );
}

function CardFace({ card, category }: { card: PartyCard, category: any }) {
  return (
    <View style={styles.cardContainer}>
      <View style={[styles.cardAccent, { backgroundColor: category.accentColor }]} />
      <View style={styles.cardCorner}>
        <View style={[styles.cornerDot, { backgroundColor: category.accentColor }]} />
        <Text style={styles.cornerText}>{card.subtype.toUpperCase()}</Text>
      </View>
      {card.isSpicy && (
        <View style={styles.spicyBadge}>
          <IconSymbol name="flame.fill" size={11} color={Colors.orange} />
          <Text style={styles.spicyBadgeText}>SPICY</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardText}>{card.text}</Text>
      </View>
      <View style={styles.cardFooter}>
        <IconSymbol name="chevron.left" size={12} color="rgba(0,0,0,0.3)" />
        <Text style={styles.cardFooterText}>swipe left or right</Text>
        <IconSymbol name="chevron.right" size={12} color="rgba(0,0,0,0.3)" />
      </View>
      <IconSymbol name={category.icon as any} size={140} color={category.accentColor + '0E'} style={styles.watermark} />
    </View>
  );
}

function CardBack({ category }: { category: any }) {
  return (
    <View style={[styles.cardContainer, styles.cardBack, { borderColor: category.accentColor + '30' }]}>
      <View style={[styles.backPattern, { backgroundColor: category.accentColor + '14' }]}>
        <IconSymbol name={category.icon as any} size={70} color={category.accentColor + '60'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  filtersContainer: {
    marginBottom: 14,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filtersBlur: {
    paddingVertical: 10,
  },
  filtersInner: {
    gap: 10,
  },
  chipsWrap: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    fontFamily: 'Viral-Black',
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.2,
  },
  chipTextActive: {
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 14,
  },
  spicyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  spicyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  spicyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  spicyIconActive: {
    backgroundColor: Colors.orange,
  },
  spicyLabel: {
    fontFamily: 'Viral-Black',
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
  spicyLabelActive: {
    color: '#FFF',
  },
  spicyHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 1,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: Colors.orange,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
  },
  toggleKnobActive: {
    transform: [{ translateX: 18 }],
  },

  deckContainer: {
    flex: 1,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStyle: {
    position: 'absolute',
    width: '92%',
    alignSelf: 'center',
    height: SCREEN_WIDTH * 1.2,
  },
  emptyDeck: {
    width: '92%',
    height: SCREEN_WIDTH * 1.2,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  emptyTextTitle: {
    fontFamily: 'Viral-Black',
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 6,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  shuffleAgain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'white',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    marginTop: 8,
  },
  shuffleAgainText: {
    fontFamily: 'Viral-Black',
    fontSize: 14,
    color: 'black',
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  cardBack: {
    backgroundColor: '#F2F2F2',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPattern: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAccent: {
    height: 6,
    width: '100%',
  },
  cardCorner: {
    position: 'absolute',
    top: 18,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 3,
  },
  cornerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cornerText: {
    fontFamily: 'Viral-Black',
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(0,0,0,0.5)',
  },
  spicyBadge: {
    position: 'absolute',
    top: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 3,
  },
  spicyBadgeText: {
    color: Colors.orange,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  cardText: {
    fontFamily: 'Viral-Black',
    fontSize: 26,
    color: '#111',
    textAlign: 'center',
    lineHeight: 34,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 18,
    zIndex: 3,
  },
  cardFooterText: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.3)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  watermark: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    zIndex: 1,
    transform: [{ rotate: '-12deg' }],
  },
  stamp: {
    position: 'absolute',
    top: 36,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 3,
    zIndex: 5,
  },
  stampLike: {
    left: 24,
    borderColor: '#22C55E',
    transform: [{ rotate: '-14deg' }],
  },
  stampNope: {
    right: 24,
    borderColor: '#EF4444',
    transform: [{ rotate: '14deg' }],
  },
  stampText: {
    fontFamily: 'Viral-Black',
    fontSize: 22,
    color: '#111',
    letterSpacing: 1,
  },

  actionWrap: {
    paddingTop: 6,
    paddingBottom: 16,
    gap: 12,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontFamily: 'Viral-Black',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    minWidth: 50,
    textAlign: 'right',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  actionButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black',
    letterSpacing: 0.2,
  },
});
