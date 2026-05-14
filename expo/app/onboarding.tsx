import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolate,
  interpolate,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { LiquidGlass } from '@/src/components/LiquidGlass';
import { Colors } from '@/src/theme/Colors';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { useFriendsStore } from '@/src/store/useFriendsStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGES = [0, 1, 2, 3] as const;
type PageIndex = 0 | 1 | 2 | 3;

const ART_LOCAL = {
  bored: require('@/assets/images/onboarding/onboarding-1.png'),
  party: require('@/assets/images/onboarding/onboarding-2.png'),
  portrait: require('@/assets/images/onboarding/onboarding-3.png'),
  hero: require('@/assets/images/onboarding/onboarding-4.png'),
} as const;

export const PARTYBOT_LOGO_URL = null; // kept for compat, logo is now text-based
export const PARTYBOT_MASCOT_URL = require('@/assets/images/onboarding/onboarding-4.png');

type PageTheme = {
  accent: string;
  glow: [string, string, string];
  eyebrow: string;
  title: string;
  subtitle: string;
  art: any;
};

const THEMES: PageTheme[] = [
  {
    accent: Colors.pink,
    glow: ['rgba(255, 55, 95, 0.55)', 'rgba(175, 82, 222, 0.25)', 'rgba(0, 0, 0, 0)'],
    eyebrow: 'THE SILENCE IS REAL',
    title: 'Hangouts going\nflat already?',
    subtitle: "Phones dead. Vibes deader. We've all been there.",
    art: ART_LOCAL.bored,
  },
  {
    accent: Colors.green,
    glow: ['rgba(48, 209, 88, 0.5)', 'rgba(50, 173, 230, 0.25)', 'rgba(0, 0, 0, 0)'],
    eyebrow: 'ENTER PARTYBOT',
    title: "We came to\nblow up\nthe room",
    subtitle: 'Quick, loud party games — ready in seconds.',
    art: ART_LOCAL.party,
  },
  {
    accent: Colors.blue,
    glow: ['rgba(10, 132, 255, 0.55)', 'rgba(94, 92, 230, 0.3)', 'rgba(0, 0, 0, 0)'],
    eyebrow: "WHAT'S YOUR NAME?",
    title: 'Slap your\nname on it',
    subtitle: 'This is going on the leaderboard, so spell it right.',
    art: ART_LOCAL.portrait,
  },
  {
    accent: Colors.orange,
    glow: ['rgba(255, 159, 10, 0.55)', 'rgba(255, 55, 95, 0.3)', 'rgba(0, 0, 0, 0)'],
    eyebrow: 'SUIT UP',
    title: 'Ready to\nown the room?',
    subtitle: 'Drop the first game and watch the room light up.',
    art: ART_LOCAL.hero,
  },
];

/** Glassy hero stage with accent glow behind the artwork. */
function ArtStage({ active, art, accent, glow }: { active: boolean; art: any; accent: string; glow: [string, string, string] }) {
  const enter = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (active) {
      enter.value = withSpring(1, { damping: 14, stiffness: 120 });
      float.value = withRepeat(
        withSequence(withTiming(1, { duration: 2400 }), withTiming(0, { duration: 2400 })),
        -1,
        true,
      );
    } else {
      enter.value = withTiming(0, { duration: 180 });
      float.value = 0;
    }
  }, [active, enter, float]);

  const frameStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: interpolate(enter.value, [0, 1], [0.92, 1], Extrapolate.CLAMP) },
    ],
  }));

  const artStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [-6, 6], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={[styles.stageWrap, frameStyle]}>
      <View style={[styles.glowOrb, { shadowColor: accent }]}>
        <LinearGradient
          colors={glow}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </View>
      <Animated.View style={[styles.artHolder, artStyle]}>
        <Image source={art} style={styles.artImage} resizeMode="contain" />
      </Animated.View>
    </Animated.View>
  );
}

function HeroStage({ active }: { active: boolean }) {
  const float = useSharedValue(0);
  const enter = useSharedValue(0);

  useEffect(() => {
    if (active) {
      enter.value = withSpring(1, { damping: 14, stiffness: 120 });
      float.value = withRepeat(
        withSequence(withTiming(1, { duration: 1800 }), withTiming(0, { duration: 1800 })),
        -1,
        true,
      );
    } else {
      enter.value = withTiming(0, { duration: 180 });
      float.value = 0;
    }
  }, [active, enter, float]);

  const frameStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: interpolate(enter.value, [0, 1], [0.92, 1], Extrapolate.CLAMP) },
    ],
  }));

  const artStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [-8, 4], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={[styles.stageWrap, frameStyle]}>
      <View style={[styles.glowOrb, { shadowColor: Colors.orange }]}>
        <LinearGradient
          colors={['rgba(255, 159, 10, 0.55)', 'rgba(255, 55, 95, 0.3)', 'rgba(0, 0, 0, 0)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </View>
      <Animated.View style={[styles.artHolder, artStyle]}>
        <Image source={ART_LOCAL.hero} style={styles.artImage} resizeMode="contain" />
      </Animated.View>
    </Animated.View>
  );
}

function IndicatorBar({ index, scrollX, accent }: { index: number; scrollX: SharedValue<number>; accent: string }) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH], [8, 28, 8], Extrapolate.CLAMP),
    opacity: interpolate(scrollX.value, [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH], [0.3, 1, 0.3], Extrapolate.CLAMP),
  }));
  return <Animated.View style={[styles.indicator, { backgroundColor: accent }, animatedStyle]} />;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setHasCompletedOnboarding, setPlayerName } = useSettingsStore();
  const [currentPage, setCurrentPage] = useState<PageIndex>(0);
  const [name, setName] = useState<string>('');
  const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollX = useSharedValue(0);

  useEffect(() => {
    if (currentPage === 2) setTimeout(() => inputRef.current?.focus(), 460);
  }, [currentPage]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollX.value = event.contentOffset.x; },
  });

  const goToPage = useCallback((page: PageIndex) => {
    scrollViewRef.current?.scrollTo({ x: page * SCREEN_WIDTH, animated: true });
    setCurrentPage(page);
  }, []);

  const goNext = useCallback(() => {
    Keyboard.dismiss();
    if (currentPage < 3) goToPage((currentPage + 1) as PageIndex);
  }, [currentPage, goToPage]);

  const goBack = useCallback(() => {
    Keyboard.dismiss();
    if (currentPage > 0) goToPage((currentPage - 1) as PageIndex);
  }, [currentPage, goToPage]);

  const complete = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    Keyboard.dismiss();
    setPlayerName(trimmed);
    // Sync the user's name as the first offline friend ("me")
    const { offlineFriends } = useFriendsStore.getState();
    const hasMe = offlineFriends.length > 0 && offlineFriends[0].id === 'me';
    if (hasMe) {
      useFriendsStore.getState().updateOfflineFriend('me', trimmed);
    } else {
      // Replace all default placeholder friends with just the user
      useFriendsStore.setState({
        offlineFriends: [
          { id: 'me', name: trimmed, isOnline: false, status: 'Offline player', kind: 'offline' },
          ...offlineFriends.filter(f => f.id !== 'me' && f.id !== '1' && f.id !== '2'),
        ],
      });
    }
    setHasCompletedOnboarding(true);
    router.replace('/(tabs)');
  }, [name, router, setHasCompletedOnboarding, setPlayerName]);

  const isNameValid = name.trim().length >= 2;
  const onLastPage = currentPage === 3;
  const activeAccent = THEMES[currentPage].accent;

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      <View style={styles.container}>
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onMomentumScrollEnd={(event) => setCurrentPage(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH) as PageIndex)}
        >
          {THEMES.map((theme, i) => (
            <Pressable key={i} style={[styles.page, { paddingTop: insets.top + 16 }]} onPress={() => Keyboard.dismiss()}>
              <View style={styles.brandRow}>
                  <Image source={require('@/assets/images/partybot-logo.png')} style={styles.brandLogo} resizeMode="contain" />
                </View>

                <View style={[styles.stageContainer, i === 2 && keyboardVisible && { flex: 0, minHeight: 160 }]}>
                  {i === 3
                    ? <HeroStage active={currentPage === 3} />
                    : i === 2
                      ? <NameSticker active={currentPage === 2} name={name} setName={setName} inputRef={inputRef} accent={theme.accent} />
                      : <ArtStage active={currentPage === i} art={theme.art} accent={theme.accent} glow={theme.glow} />}
                </View>

                {!(i === 2 && keyboardVisible) && (
                  <CopyBlock
                    active={currentPage === i}
                    eyebrow={i === 3 && name.trim() ? `READY, ${name.trim().toUpperCase()}?` : theme.eyebrow}
                    title={i === 3 && name.trim() ? `Let's go,\n${name.trim()}` : theme.title}
                    subtitle={theme.subtitle}
                    accent={theme.accent}
                  />
                )}
            </Pressable>
          ))}
        </Animated.ScrollView>

        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.indicators}>
            {PAGES.map((i) => <IndicatorBar key={i} index={i} scrollX={scrollX} accent={THEMES[i].accent} />)}
          </View>

          <View style={styles.navRow}>
            {currentPage > 0 && (
              <Pressable
                onPress={goBack}
                style={({ pressed }) => [
                  styles.backBtn,
                  pressed && styles.ctaPressed,
                ]}
              >
                <View style={[styles.backBtnInner, { backgroundColor: activeAccent + '22' }]}>
                  <IconSymbol name="chevron.left" size={24} color={activeAccent} />
                </View>
              </Pressable>
            )}

            <Pressable
              disabled={currentPage === 2 && !isNameValid}
              onPress={onLastPage ? complete : goNext}
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.ctaPressed,
                currentPage === 2 && !isNameValid && styles.ctaDisabled,
                { flex: 1 }
              ]}
            >
              <LinearGradient
                colors={[activeAccent, THEMES[Math.min(3, currentPage + 1)].accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.ctaInner}>
                <Text style={styles.ctaText}>
                  {onLastPage ? "Let's Play" : currentPage === 2 ? (isNameValid ? 'Looks Good' : 'Type your name') : 'Continue'}
                </Text>
                <IconSymbol name={onLastPage ? 'gamecontroller.fill' : 'chevron.right'} size={18} color="#fff" />
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function CopyBlock({ active, eyebrow, title, subtitle, accent }: { active: boolean; eyebrow: string; title: string; subtitle: string; accent: string }) {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = active
      ? withDelay(140, withSpring(1, { damping: 14, stiffness: 130 }))
      : withTiming(0, { duration: 160 });
  }, [active, enter]);
  const a = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [22, 0], Extrapolate.CLAMP) }],
  }));
  return (
    <Animated.View style={[styles.copyBlock, a]}>
      <View style={[styles.eyebrowPill, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
        <View style={[styles.eyebrowDot, { backgroundColor: accent }]} />
        <Text style={[styles.eyebrowText, { color: accent }]}>{eyebrow}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{subtitle}</Text>
    </Animated.View>
  );
}

function NameSticker({ active, name, setName, inputRef, accent }: { active: boolean; name: string; setName: (s: string) => void; inputRef: React.RefObject<TextInput | null>; accent: string }) {
  const enter = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (active) {
      enter.value = withSpring(1, { damping: 14, stiffness: 120 });
      float.value = withRepeat(
        withSequence(withTiming(1, { duration: 2400 }), withTiming(0, { duration: 2400 })),
        -1,
        true,
      );
    } else {
      enter.value = withTiming(0, { duration: 180 });
      float.value = 0;
    }
  }, [active, enter, float]);

  const frameStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: interpolate(enter.value, [0, 1], [0.92, 1], Extrapolate.CLAMP) },
    ],
  }));

  const artStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [-6, 6], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={[styles.nameStickerWrap, frameStyle]}>
      <View style={[styles.glowOrb, { shadowColor: accent }]}>
        <LinearGradient
          colors={[accent + '88', accent + '33', 'rgba(0,0,0,0)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </View>
      <Animated.View style={[styles.nameContentColumn, artStyle]}>
        <LiquidGlass variant="high" radius={16} style={styles.nameInputCard} shadow>
          <View style={styles.nameStickerHeader}>
            <View style={[styles.nameStickerHeaderDot, { backgroundColor: accent }]} />
            <Text style={styles.nameStickerHeaderText}>YOUR NAME</Text>
          </View>
          <TextInput
            ref={inputRef}
            value={name}
            onChangeText={setName}
            placeholder="Type here…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.nameInput}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            maxLength={14}
          />
          <View style={[styles.nameUnderline, { backgroundColor: accent }]} />
        </LiquidGlass>
      </Animated.View>
    </Animated.View>
  );
}

const STAGE = Math.min(SCREEN_WIDTH - 56, Math.min(SCREEN_HEIGHT * 0.42, 360));
const NAME_W = Math.min(SCREEN_WIDTH - 48, 360);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  page: { width: SCREEN_WIDTH, flex: 1, paddingHorizontal: 24, paddingBottom: 200, alignItems: 'center', justifyContent: 'flex-start' },

  brandRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brandText: { fontFamily: 'Viral-Black', fontSize: 22, color: 'white', letterSpacing: -0.5 },
  brandLogo: { height: 36, width: 160 },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  skipText: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600' },

  stageContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: STAGE + 40, width: '100%' },

  stageWrap: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center' },
  glowOrb: {
    position: 'absolute',
    width: STAGE * 0.95,
    height: STAGE * 0.95,
    borderRadius: STAGE,
    overflow: 'hidden',
    shadowOpacity: 0.6,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
  artHolder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  artImage: { width: '94%', height: '94%' },

  heroBadgeWrap: { position: 'absolute', bottom: '14%', alignSelf: 'center' },
  heroBadgeInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, maxWidth: STAGE * 0.7 },
  heroBadgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green },
  heroBadgeText: { fontFamily: 'Viral-Black', fontSize: 15, color: '#fff', textAlign: 'center', letterSpacing: 1 },

  nameStickerWrap: { width: NAME_W, alignItems: 'center', justifyContent: 'center', minHeight: 220 },
  nameContentColumn: { width: '100%', alignItems: 'center', gap: 14 },
  nameCardPreview: { width: NAME_W * 0.72, height: NAME_W * 0.48 },
  nameInputCard: { width: '100%', paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center' },
  nameSticker: { width: '100%', padding: 24, alignItems: 'center' },
  nameStickerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  nameStickerHeaderDot: { width: 8, height: 8, borderRadius: 4 },
  nameStickerHeaderText: { fontFamily: 'Viral-Black', color: 'rgba(255,255,255,0.6)', fontSize: 12, letterSpacing: 2 },
  nameInput: {
    fontFamily: 'Viral-Black',
    fontSize: 28,
    color: '#fff',
    textAlign: 'center',
    width: '100%',
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    includeFontPadding: false,
  },
  nameUnderline: { height: 3, width: 60, borderRadius: 2, marginTop: 12 },

  copyBlock: { width: '100%', alignItems: 'center', paddingHorizontal: 8, marginTop: 8 },
  eyebrowPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, marginBottom: 14 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowText: { fontFamily: 'Viral-Black', fontSize: 11, letterSpacing: 1.5 },
  title: { color: '#fff', fontFamily: 'Viral-Black', fontSize: 30, lineHeight: 36, textAlign: 'center', marginBottom: 10, letterSpacing: -0.3 },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 22, textAlign: 'center', fontWeight: '500', paddingHorizontal: 12 },

  bottomControls: { position: 'absolute', left: 24, right: 24, bottom: 0, gap: 18 },
  indicators: { flexDirection: 'row', justifyContent: 'center', gap: 6, height: 8, alignItems: 'center' },
  indicator: { height: 8, borderRadius: 999 },

  navRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  backBtn: {
    height: 60,
    width: 60,
    borderRadius: 18,
    overflow: 'hidden',
  },
  backBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  cta: {
    height: 60,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',

    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { color: '#fff', fontFamily: 'Viral-Black', fontSize: 17, letterSpacing: 0.5 },
  ctaPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  ctaDisabled: { opacity: 0.4 },
});
