import { Colors } from '@/src/theme/Colors';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { CurrentTurnPill, BeerBottleView } from '@/src/components/games/SharedGameComponents';

interface Props { session: GameSession; }
type Phase = 'idle' | 'spinning' | 'landed' | 'choosing' | 'prompt';
type Choice = 'truth' | 'dare';
type Difficulty = 'mild' | 'classic' | 'bold';

const PLAYER_COLORS = [Colors.red,Colors.orange,Colors.yellow,Colors.green,'#00C7BE','#5AC8FA','#007AFF','#5856D6','#AF52DE','#FF2D55','#A2845E','#30B0C7'];

// All content from SpinBottleContent (iOS)
const TRUTHS: Record<Difficulty, string[]> = {
  mild: ["What's the silliest thing you believed as a kid?","What's your guilty pleasure song?","What's the weirdest food combination you secretly love?","What's a small habit you can't break?","What's your most-used emoji and why?","What's a movie you can watch over and over?","What's the worst gift you've ever received?","What's the last lie you told today?","Who in this room makes you laugh the most?","What's something you're proud of but never talk about?","What was your most embarrassing school moment?","What's a talent you wish you had?","What's your biggest pet peeve?","What's the longest you've gone without sleep?","What's a fear you had as a child that you still kind of have?","What's the most useless thing you know how to do?","What's your dream vacation spot?","What show do you secretly love but won't admit?","What's the most childish thing you still do?","What was your worst haircut?"],
  classic: ["Who in this room would you trust with your phone unlocked?","What's the biggest lie you've told your parents?","Who was your first crush?","What's the most embarrassing thing in your search history?","Have you ever pretended to like a gift?","What's a secret you've kept from your best friend?","Who in this room do you find most attractive?","What's the worst date you've ever been on?","What's the meanest thing you've ever done?","Have you ever ghosted someone? Why?","What's a rumor about you that's actually true?","What's the most trouble you've ever been in?","Who's the last person you stalked online?","What's something you've Googled but would be embarrassed to admit?","Have you ever lied to get out of plans? With who?","What's the longest you've held a grudge?","Who's the worst kisser you've ever kissed?","What's the most awkward text you've ever sent?","What's a moment you wish you could redo?","What's the boldest thing you've done for love?"],
  bold: ["Who in this room would you kiss if you had to?","What's your wildest fantasy you'd actually try?","Who in this room have you thought about more than once?","What's the most scandalous text you've ever sent?","Have you ever been attracted to a friend's partner?","What's something you want in a partner but never asked for?","What's the most risky place you've kissed someone?","Who's the last person you flirted with that wasn't your partner?","What's a deal-breaker that secretly turns you on?","Have you ever lied about how many people you've kissed?","Who in this room would you consider dating?","What's the boldest thing you've done to get someone's attention?","What's a secret about your dating life nobody knows?","Have you ever sent a message you immediately regretted?","What's something you've done that you'd never tell your parents?","Who's the last person you thought about before sleeping?","What's the most jealous you've ever felt?","Have you ever cheated, even just emotionally?","What's a thought you've had about someone here that surprised you?","What's the most you've ever lied about yourself to impress someone?"],
};

const DARES: Record<Difficulty, string[]> = {
  mild: ["Do your best impression of someone in the room.","Sing the chorus of the last song you played.","Speak in an accent until your next turn.","Do 10 jumping jacks right now.","Tell a joke. If no one laughs, tell another.","Do your best runway walk across the room.","Show the last photo in your camera roll.","Let the group pick your next selfie pose. Take it.","Dance for 15 seconds with no music.","Speak only in questions for one minute.","Do your best superhero landing.","Whisper a compliment to everyone in the room.","Eat or drink something in the most dramatic way possible.","Pretend to be a news anchor reporting this party.","Balance something on your head for 30 seconds.","Do your best evil villain laugh.","Talk like a baby until your next turn.","Make up a song about the person on your left.","Do 5 push-ups. Now.","Give a TED talk about a random object in the room."],
  classic: ["Send a flirty emoji to the last person in your messages.","Let the group post a one-word status on your socials.","Show the last 3 people you texted to the room.","Call someone in your contacts and sing them happy birthday.","Let the group pick a contact — send them 'I was just thinking about you.'","Show your most recent search history.","Read the last DM you sent out loud.","Let the player on your left write your next Instagram caption.","Do a slow-motion hair flip on command.","Try to make someone in the room laugh in 10 seconds.","Whisper a secret to the player on your right.","Hold eye contact with someone for 30 seconds without speaking.","Imitate the voice of the person across from you.","Let the group give you a new ringtone for the next round.","Confess one thing you Googled this week.","Send a heart emoji to your 5th contact.","Take a goofy selfie and set it as your lock screen for the night.","Trade phones with someone for 30 seconds. No peeking allowed.","Let the group pick an emoji to text your last contact.","Tell the group the most awkward DM you've ever sent."],
  bold: ["Whisper something flirty to the player on your left.","Slow dance with someone in the room for 15 seconds.","Send a risky text to your crush — the group helps write it.","Sit on the lap of the person to your right for one round.","Give the player across from you a 5-second back massage.","Take a sultry selfie. Show it to the group.","Whisper your type out loud to someone here.","Hold hands with the player on your right until your next turn.","Pick someone here and describe what you'd do on a perfect date with them.","Lock eyes with someone for 20 seconds without smiling.","Let someone in the room write a flirty message and send it from your phone.","Compliment someone here in the most seductive voice you can.","Bite your lip and stare at the player of your choice for 5 seconds.","Reveal which player here you'd swipe right on.","Whisper a confession to the group that would surprise them.","Text your ex one word of the group's choosing.","Take off one accessory and give it to the player you find most attractive.","Pick someone and tell them what you noticed first about them.","Give your most dramatic, slow wink to someone of your choice.","Tell the player on your left exactly what you're thinking right now."],
};

export function SpinBottleSession({ session }: Props) {
  const players = session.players;
  const [phase, setPhase] = useState<Phase>('idle');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [choice, setChoice] = useState<Choice>('truth');
  const [promptText, setPromptText] = useState('');
  const [rerolls, setRerolls] = useState(2);
  const difficulty: Difficulty = (session.gameConfig?.difficulty as Difficulty) || 'classic';
  const [usedTruths, setUsedTruths] = useState<Set<string>>(new Set());
  const [usedDares, setUsedDares] = useState<Set<string>>(new Set());

  const bottleAnim = useSharedValue(0);
  const bottleAngleRef = useRef(0);
  const bottleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${bottleAnim.value}deg` }] }));

  const sw = Dimensions.get('window').width;
  const circleSize = sw - 64;
  const radius = circleSize / 2 - 48;

  const anglePerPlayer = 360 / players.length;

  const spin = () => {
    if (players.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase('spinning');

    const target = Math.floor(Math.random() * players.length);
    const baseRotations = (10 + Math.floor(Math.random() * 5)) * 360;
    const targetAngle = anglePerPlayer * target;
    const jitter = (Math.random() - 0.5) * anglePerPlayer * 0.5;
    const currentAngle = bottleAngleRef.current;
    const newAngle = currentAngle + baseRotations + targetAngle + jitter;

    bottleAngleRef.current = newAngle;

    const onSpinDone = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedIdx(target);
      setPhase('landed');
    };
    bottleAnim.value = withTiming(
      newAngle,
      { duration: 4000, easing: Easing.out(Easing.cubic) },
      (done) => { if (done) runOnJS(onSpinDone)(); },
    );
  };

  const handleChoose = (c: Choice) => {
    setChoice(c);
    generatePrompt(c, true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('prompt');
  };

  const generatePrompt = (c: Choice, reset: boolean) => {
    const pool = c === 'truth' ? TRUTHS[difficulty] : DARES[difficulty];
    const used = c === 'truth' ? usedTruths : usedDares;
    let remaining = pool.filter(p => !used.has(p) && p !== promptText);
    if (remaining.length === 0) {
      if (c === 'truth') setUsedTruths(new Set());
      else setUsedDares(new Set());
      remaining = pool.filter(p => p !== promptText);
    }
    const next = remaining[Math.floor(Math.random() * remaining.length)] || pool[0];
    setPromptText(next);
    if (reset) setRerolls(2);
    if (c === 'truth') {
      setUsedTruths(prev => { const s = new Set(prev); s.add(next); return s; });
    } else {
      setUsedDares(prev => { const s = new Set(prev); s.add(next); return s; });
    }
  };

  const handleReroll = () => {
    if (rerolls <= 0) return;
    Haptics.selectionAsync();
    setRerolls(r => r - 1);
    generatePrompt(choice, false);
  };

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPromptText('');
    setRerolls(2);
    setPhase('idle');
  };

  const handleRestart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    bottleAngleRef.current = 0;
    bottleAnim.value = 0;
    setPhase('idle');
  };

  const selectedPlayer = players[selectedIdx];
  const accentColor = PLAYER_COLORS[selectedIdx % PLAYER_COLORS.length];

  // ═══ PROMPT SCREEN ═══
  if (phase === 'prompt') {
    const promptColor = choice === 'truth' ? '#007AFF' : Colors.red;
    return (
      <View style={st.container}>
        <View style={st.promptWrap}>
          <View style={[st.choicePill, { backgroundColor: promptColor }]}>
            <IconSymbol name={choice === 'truth' ? 'bubble.left.and.bubble.right.fill' as any : 'flame.fill'} size={14} color="#fff" />
            <Text style={st.choicePillTx}>{choice.toUpperCase()}</Text>
          </View>
          <Text style={st.promptPlayer}>{selectedPlayer?.displayName}</Text>

          <View style={[st.promptCard, { borderColor: promptColor + '73' }]}>
            <LinearGradient colors={[promptColor + '6B', promptColor + '2E', 'rgba(0,0,0,0.2)']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={st.promptCardInner}>
              <Text style={st.promptTx}>{promptText}</Text>
              {rerolls > 0 && (
                <Pressable style={st.rerollBtn} onPress={handleReroll}>
                  <IconSymbol name="arrow.clockwise" size={12} color="#fff" />
                  <Text style={st.rerollTx}>Reroll · {rerolls} left</Text>
                </Pressable>
              )}
            </LinearGradient>
          </View>

          <Pressable onPress={handleDone}>
            <LinearGradient colors={['rgba(52,199,89,0.9)', 'rgba(52,199,89,0.6)']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={st.doneBtn}>
              <IconSymbol name="checkmark" size={16} color="#fff" />
              <Text style={st.doneBtnTx}>Done · Next Spin</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  // ═══ CIRCLE SCREEN (idle/spinning/landed/choosing) ═══
  return (
    <View style={st.container}>
      <AppBackgroundView />
      {/* Header */}
      <View style={st.header}>
        <View>
          <Text style={st.headerTitle}>
            {phase === 'idle' ? 'Truth or Dare' : phase === 'spinning' ? 'Spinning...' :
             phase === 'landed' ? `It's ${selectedPlayer?.displayName}!` : `${selectedPlayer?.displayName}'s turn`}
          </Text>
          <Text style={st.headerSub}>
            {phase === 'idle' ? 'Tap Spin to start' : phase === 'spinning' ? 'Where will it land?' :
             phase === 'landed' ? 'Get ready to choose' : 'Pick your fate'}
          </Text>
        </View>
        <View style={st.vibePill}>
          <IconSymbol name="flame.fill" size={11} color={Colors.red} />
          <Text style={st.vibeTx}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</Text>
        </View>
      </View>

      {/* Player banner when landed/choosing */}
      <View style={{ position: 'absolute', top: 80, left: 0, right: 0, zIndex: 20 }}>
        {(phase === 'landed' || phase === 'choosing') && selectedPlayer && (
          <View style={[st.banner, { borderColor: accentColor + '73' }]}>
            <View style={[st.avatar, { backgroundColor: accentColor }]}>
              <Text style={st.avatarTx}>{selectedPlayer.displayName.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.bannerLabel}>SELECTED PLAYER</Text>
              <Text style={st.bannerName}>{selectedPlayer.displayName}</Text>
            </View>
            <IconSymbol name="sparkles" size={16} color={accentColor} />
          </View>
        )}
      </View>

      {/* Circle */}
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={[st.circleWrap, { width: circleSize, height: circleSize }]}>
        {/* Player ring */}
        {players.map((p, i) => {
          const angle = (anglePerPlayer * i - 90) * Math.PI / 180;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const isSelected = (phase === 'landed' || phase === 'choosing') && i === selectedIdx;
          return (
            <View key={p.id} style={[st.playerNode, {
              transform: [{ translateX: x }, { translateY: y }],
            }]}>
              {isSelected ? (
                <CurrentTurnPill playerName={p.displayName} accent={Colors.green} />
              ) : (
                <Text style={st.playerNodeTx}>{p.displayName}</Text>
              )}
            </View>
          );
        })}

        {/* Bottle */}
        <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, bottleStyle]} accessible accessibilityLabel="Spinning bottle">
          <BeerBottleView width={circleSize * 0.38} />
        </Animated.View>

        {/* Restart */}
        <Pressable style={st.restartBtn} onPress={handleRestart}>
          <IconSymbol name="arrow.counterclockwise" size={15} color="#fff" />
        </Pressable>
      </View>
      </View>

      {/* Action area */}
      <View style={st.actionArea}>
        {phase === 'idle' && (
          <Pressable onPress={spin}>
            <LinearGradient colors={['rgba(255,59,48,0.9)', 'rgba(255,45,85,0.7)']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={st.spinBtn}>
              <IconSymbol name="arrow.trianglehead.2.clockwise.rotate.90" size={18} color="#fff" />
              <Text style={st.spinBtnTx}>Spin</Text>
            </LinearGradient>
          </Pressable>
        )}
        {phase === 'spinning' && (
          <Text style={st.spinningTx}>Spinning...</Text>
        )}
        {phase === 'landed' && (
          <Pressable onPress={() => setPhase('choosing')}>
            <LinearGradient colors={['rgba(0,122,255,0.9)', 'rgba(0,122,255,0.6)']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={st.spinBtn}>
              <Text style={st.spinBtnTx}>Continue</Text>
            </LinearGradient>
          </Pressable>
        )}
        {phase === 'choosing' && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable style={{ flex: 1 }} onPress={() => handleChoose('truth')}>
              <LinearGradient colors={['rgba(0,122,255,0.85)', 'rgba(0,122,255,0.55)']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={st.choiceBtn}>
                <IconSymbol name={"bubble.left.and.bubble.right.fill" as any} size={22} color="#fff" />
                <Text style={st.choiceBtnTx}>Truth</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={{ flex: 1 }} onPress={() => handleChoose('dare')}>
              <LinearGradient colors={['rgba(255,59,48,0.85)', 'rgba(255,59,48,0.55)']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={st.choiceBtn}>
                <IconSymbol name="flame.fill" size={22} color="#fff" />
                <Text style={st.choiceBtnTx}>Dare</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  vibePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,59,48,0.14)', borderRadius: 20 },
  vibeTx: { color: Colors.red, fontSize: 12, fontWeight: 'bold' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.2 },
  bannerLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  bannerName: { color: '#fff', fontSize: 17, fontWeight: '800' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarTx: { color: '#fff', fontSize: 12, fontWeight: '800' },
  circleWrap: { alignSelf: 'center', position: 'relative', alignItems: 'center', justifyContent: 'center' },
  playerNode: { position: 'absolute', alignItems: 'center' },
  playerNodeTx: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', maxWidth: 90 },
  restartBtn: { position: 'absolute', top: 8, right: 8, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  actionArea: { paddingHorizontal: 20, paddingBottom: 24, marginTop: 'auto' },
  spinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16 },
  spinBtnTx: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  spinningTx: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 16 },
  choiceBtn: { alignItems: 'center', gap: 6, paddingVertical: 18, borderRadius: 18 },
  choiceBtnTx: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  // Prompt screen
  promptWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 16 },
  choicePill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  choicePillTx: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  promptPlayer: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  promptCard: { width: '100%', borderRadius: 28, overflow: 'hidden', borderWidth: 1.5 },
  promptCardInner: { padding: 32, alignItems: 'center', gap: 20 },
  promptTx: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', lineHeight: 34 },
  rerollBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  rerollTx: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  doneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, width: '100%', paddingHorizontal: 40 },
  doneBtnTx: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
