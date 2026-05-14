import { Colors } from '@/src/theme/Colors';
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import { LinearGradient } from 'expo-linear-gradient';

interface Props { session: GameSession; }

type Phase = 'guesserAnnounce' | 'passToPlayer' | 'showNumber' | 'scenarioReveal' | 'acting' | 'guesserGuessing' | 'roundReveal' | 'scoreboard' | 'finalResults';

const SCENARIOS = [
  "You just found out your flight is cancelled",
  "Your crush texts you back after 3 months",
  "You meet your ex at a party",
  "You win a free trip but it's tomorrow",
  "Your boss calls you at 2 AM",
  "You get unlimited free food forever",
  "Your phone dies during an important call",
  "A stranger compliments your outfit in public",
  "You realize you left the oven on at home",
  "You find $100 in your old jacket pocket",
  "Your best friend spoils the movie ending",
  "You accidentally send a text to the wrong person",
  "You get promoted but have to move cities",
  "A celebrity follows you on social media",
  "You're stuck in an elevator with your neighbor",
  "You find out your food order was completely wrong",
  "A bird lands on your shoulder in public",
  "You win the lottery but lose the ticket",
  "Your alarm didn't go off on exam day",
  "You discover your pet learned a new trick",
  "Rain starts pouring on your outdoor wedding",
  "You find a secret room in your house",
  "Your favorite song plays at the grocery store",
  "You accidentally call your teacher 'Mom'",
  "You get free VIP tickets to a sold-out concert",
  "Your WiFi goes out during a live presentation",
  "A dog runs up and steals your sandwich",
  "You open a fortune cookie and it's blank",
  "Your childhood hero DMs you on Instagram",
  "You realize you've been wearing your shirt inside out all day",
];

function numberColor(num: number, max: number): string {
  if (max <= 1) return Colors.green;
  const frac = (num - 1) / (max - 1);
  if (frac < 0.34) return Colors.red;
  if (frac < 0.67) return Colors.yellow;
  return Colors.green;
}

function numberLabel(num: number, max: number): string {
  if (num === 1) return 'Disaster 😬';
  if (num === max) return 'Perfect 😍';
  return '';
}

export function TenTangleSession({ session }: Props) {
  const players = session.players;
  const totalRounds = players.length;

  const [phase, setPhase] = useState<Phase>('guesserAnnounce');
  const [round, setRound] = useState(1);
  const [guesserIdx, setGuesserIdx] = useState(0);
  const [assignedNumbers, setAssignedNumbers] = useState<Record<string, number>>({});
  const [scenario, setScenario] = useState('');
  const [passIdx, setPassIdx] = useState(0);
  const [guesses, setGuesses] = useState<Record<string, number | null>>({});
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = {};
    players.forEach(p => { s[p.id] = 0; });
    return s;
  });

  const guesser = players[guesserIdx];
  const nonGuessers = players.filter((_, i) => i !== guesserIdx);
  const maxNumber = nonGuessers.length;

  const usedScenariosRef = useRef<Set<number>>(new Set());

  const startRound = (currentGuesserIdx: number) => {
    // Compute nonGuessers from the passed index (avoids stale closure)
    const roundNonGuessers = players.filter((_, i) => i !== currentGuesserIdx);

    // Assign numbers
    const nums = Array.from({ length: roundNonGuessers.length }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
    const assigned: Record<string, number> = {};
    roundNonGuessers.forEach((p, i) => { assigned[p.id] = nums[i]; });
    setAssignedNumbers(assigned);

    // Pick scenario
    let idx: number;
    const used = usedScenariosRef.current;
    if (used.size >= SCENARIOS.length) used.clear();
    do { idx = Math.floor(Math.random() * SCENARIOS.length); } while (used.has(idx));
    used.add(idx);
    setScenario(SCENARIOS[idx]);

    setPassIdx(0);
    setGuesses({});
    setPhase('guesserAnnounce');
  };

  // Init first round
  React.useEffect(() => { startRound(0); }, []);

  const handleProceedToPass = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPassIdx(0); setPhase('passToPlayer'); };
  const handleShowNumber = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPhase('showNumber'); };
  const handleGotIt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (passIdx + 1 >= nonGuessers.length) { setPhase('scenarioReveal'); }
    else { setPassIdx(passIdx + 1); setPhase('passToPlayer'); }
  };
  const handleStartActing = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPhase('acting'); };
  const handleStartGuessing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const g: Record<string, number | null> = {};
    nonGuessers.forEach(p => { g[p.id] = null; });
    setGuesses(g);
    setPhase('guesserGuessing');
  };

  const handleSubmitGuesses = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    let pts = 0;
    nonGuessers.forEach(p => { if (guesses[p.id] === assignedNumbers[p.id]) pts++; });
    setScores(prev => ({ ...prev, [guesser.id]: (prev[guesser.id] || 0) + pts }));
    setPhase('roundReveal');
  };

  const handleShowScoreboard = () => { setPhase('scoreboard'); };
  const handleNextRound = () => {
    const nextGuesser = guesserIdx + 1;
    if (nextGuesser >= players.length) { setPhase('finalResults'); return; }
    setGuesserIdx(nextGuesser);
    setRound(round + 1);
    // Start with the correct new guesser index directly
    startRound(nextGuesser);
  };

  const allGuessed = Object.values(guesses).every(v => v !== null);
  const sortedScores = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const rankEmojis = ['🥇', '🥈', '🥉'];

  // ═══ GUESSER ANNOUNCE ═══
  if (phase === 'guesserAnnounce') {
    return (
      <View style={st.container}><View style={st.center}>
        <View style={st.iconBox}><IconSymbol name="eye.fill" size={52} color={Colors.orange} /></View>
        <Text style={st.roundLabel}>Round {round} of {totalRounds}</Text>
        <Text style={[st.title, { color: Colors.orange }]}>{guesser.displayName}</Text>
        <Text style={st.sub}>You are the Guesser this round!</Text>
        <Text style={st.hint}>Everyone else will get a secret number. Watch them act and guess their numbers.</Text>
        <Pressable style={st.btn} onPress={handleProceedToPass}><Text style={st.btnTx}>Continue</Text></Pressable>
      </View></View>
    );
  }

  // ═══ PASS TO PLAYER ═══
  if (phase === 'passToPlayer') {
    const p = nonGuessers[passIdx];
    return (
      <View style={st.container}><View style={st.center}>
        <IconSymbol name="hand.raised.fill" size={52} color="#5AC8FA" />
        <Text style={st.title}>Pass to</Text>
        <Text style={[st.title, { color: '#5AC8FA', fontSize: 34 }]}>{p?.displayName}</Text>
        <Text style={st.sub}>Tap below to see your secret number</Text>
        <Text style={st.hint}>{guesser.displayName} should look away!</Text>
        <Pressable style={st.btn} onPress={handleShowNumber}><Text style={st.btnTx}>Show My Number</Text></Pressable>
      </View></View>
    );
  }

  // ═══ SHOW NUMBER ═══
  if (phase === 'showNumber') {
    const p = nonGuessers[passIdx];
    const num = assignedNumbers[p?.id] || 1;
    const col = numberColor(num, maxNumber);
    const lbl = numberLabel(num, maxNumber);
    return (
      <View style={st.container}><View style={st.center}>
        <Text style={[st.bigNumber, { color: col }]}>{num}</Text>
        {lbl ? <Text style={[st.numLabel, { color: col }]}>{lbl}</Text> : null}
        <Text style={st.sub}>Remember this number, {p?.displayName}!</Text>
        <Text style={[st.hint, { marginTop: 20 }]}>1 = Disaster 😬 · {maxNumber} = Perfect 😍</Text>
        <Pressable style={st.btn} onPress={handleGotIt}><Text style={st.btnTx}>Got it!</Text></Pressable>
      </View></View>
    );
  }

  // ═══ SCENARIO REVEAL ═══
  if (phase === 'scenarioReveal') {
    return (
      <View style={st.container}><View style={st.center}>
        <IconSymbol name="theatermask.and.paintbrush.fill" size={52} color={Colors.yellow} />
        <Text style={st.roundLabel}>Scenario</Text>
        <View style={st.scenarioCard}>
          <Text style={st.scenarioText}>{scenario}</Text>
        </View>
        <Text style={st.hint}>Each player acts out this scenario at their number&apos;s intensity level.</Text>
        <Pressable style={st.btn} onPress={handleStartActing}><Text style={st.btnTx}>Start Acting!</Text></Pressable>
      </View></View>
    );
  }

  // ═══ ACTING ═══
  if (phase === 'acting') {
    return (
      <View style={st.container}><View style={st.center}>
        <IconSymbol name="person.3.fill" size={52} color={Colors.green} />
        <Text style={st.title}>Acting Time!</Text>
        <View style={st.scenarioCard}><Text style={st.scenarioText}>{scenario}</Text></View>
        <Text style={st.sub}>{guesser.displayName} — watch everyone carefully!</Text>
        <Pressable style={st.btn} onPress={handleStartGuessing}><Text style={st.btnTx}>{guesser.displayName}, Start Guessing</Text></Pressable>
      </View></View>
    );
  }

  // ═══ GUESSER GUESSING ═══
  if (phase === 'guesserGuessing') {
    return (
      <View style={st.container}>
        <ScrollView contentContainerStyle={st.scrollPad}>
          <Text style={[st.title, { textAlign: 'center' }]}>{guesser.displayName}&apos;s Guesses</Text>
          <Text style={[st.sub, { textAlign: 'center', marginBottom: 20 }]}>Assign each player their number</Text>
          {nonGuessers.map(p => (
            <View key={p.id} style={st.guessRow}>
              <Text style={st.guessName}>{p.displayName}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {Array.from({ length: maxNumber }, (_, i) => i + 1).map(n => {
                    const sel = guesses[p.id] === n;
                    return (
                      <Pressable key={n} onPress={() => { Haptics.selectionAsync(); setGuesses(prev => ({ ...prev, [p.id]: n })); }}
                        style={[st.numBtn, sel && { backgroundColor: Colors.orange, borderColor: Colors.orange }]}>
                        <Text style={[st.numBtnTx, sel && { color: '#fff' }]}>{n}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ))}
          <Pressable style={[st.btn, !allGuessed && { opacity: 0.4 }]} onPress={handleSubmitGuesses} disabled={!allGuessed}>
            <Text style={st.btnTx}>Submit Guesses</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ═══ ROUND REVEAL ═══
  if (phase === 'roundReveal') {
    let correct = 0;
    return (
      <View style={st.container}>
        <ScrollView contentContainerStyle={st.scrollPad}>
          <Text style={[st.title, { textAlign: 'center' }]}>Results</Text>
          {nonGuessers.map(p => {
            const actual = assignedNumbers[p.id];
            const guess = guesses[p.id];
            const ok = guess === actual;
            if (ok) correct++;
            return (
              <View key={p.id} style={[st.revealRow, ok ? st.revealOk : st.revealWrong]}>
                <Text style={st.revealName}>{p.displayName}</Text>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Text style={st.revealGuess}>Guess: {guess}</Text>
                  <Text style={[st.revealActual, { color: ok ? Colors.green : Colors.red }]}>Actual: {actual}</Text>
                  {ok && <IconSymbol name="checkmark.circle.fill" size={18} color={Colors.green} />}
                </View>
              </View>
            );
          })}
          <Text style={[st.sub, { textAlign: 'center', marginTop: 16 }]}>{guesser.displayName} got {correct}/{nonGuessers.length} correct!</Text>
          <Pressable style={st.btn} onPress={handleShowScoreboard}><Text style={st.btnTx}>Scoreboard</Text></Pressable>
        </ScrollView>
      </View>
    );
  }

  // ═══ SCOREBOARD ═══
  if (phase === 'scoreboard') {
    return (
      <View style={st.container}>
        <ScrollView contentContainerStyle={st.scrollPad}>
          <Text style={[st.title, { textAlign: 'center' }]}>Scoreboard</Text>
          <Text style={[st.sub, { textAlign: 'center', marginBottom: 20 }]}>Round {round} of {totalRounds}</Text>
          {sortedScores.map((p, i) => (
            <View key={p.id} style={[st.scoreRow, i === 0 && st.scoreFirst]}>
              <Text style={st.scoreRank}>{rankEmojis[i] || `#${i+1}`}</Text>
              <Text style={st.scoreName}>{p.displayName}</Text>
              <Text style={st.scoreVal}>{scores[p.id] || 0}</Text>
            </View>
          ))}
          <Pressable style={st.btn} onPress={handleNextRound}>
            <Text style={st.btnTx}>{round >= totalRounds ? 'Final Results' : 'Next Round'}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ═══ FINAL RESULTS ═══
  const handlePlayAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRound(1);
    setGuesserIdx(0);
    setScores(() => {
      const s: Record<string, number> = {};
      players.forEach(p => { s[p.id] = 0; });
      return s;
    });
    usedScenariosRef.current.clear();
    startRound(0);
  };

  return (
    <View style={st.container}>
      <ScrollView contentContainerStyle={st.scrollPad}>
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <IconSymbol name="trophy.fill" size={44} color={Colors.yellow} />
          <Text style={st.title}>Final Results</Text>
        </View>
        {sortedScores.map((p, i) => (
          <View key={p.id} style={[st.scoreRow, i === 0 && st.scoreFirst]}>
            <Text style={st.scoreRank}>{rankEmojis[i] || `#${i+1}`}</Text>
            <Text style={st.scoreName}>{p.displayName}</Text>
            <Text style={st.scoreVal}>{scores[p.id] || 0} pts</Text>
          </View>
        ))}
        <Pressable style={[st.btn, { backgroundColor: Colors.green }]} onPress={handlePlayAgain}>
          <Text style={st.btnTx}>Play Again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scrollPad: { padding: 16, paddingBottom: 40 },
  iconBox: { width: 100, height: 100, borderRadius: 28, backgroundColor: 'rgba(255,149,0,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 8, textAlign: 'center' },
  hint: { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 12, textAlign: 'center', paddingHorizontal: 20 },
  roundLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  btn: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 16, width: '100%', alignItems: 'center', marginTop: 32 },
  btnTx: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  bigNumber: { fontSize: 96, fontWeight: '800' },
  numLabel: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  scenarioCard: { backgroundColor: 'rgba(255,204,0,0.12)', borderRadius: 20, padding: 24, marginTop: 20, borderWidth: 1, borderColor: 'rgba(255,204,0,0.3)', width: '100%' },
  scenarioText: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', lineHeight: 28 },
  guessRow: { marginBottom: 16 },
  guessName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  numBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  numBtnTx: { color: 'rgba(255,255,255,0.7)', fontSize: 17, fontWeight: 'bold' },
  revealRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1 },
  revealOk: { backgroundColor: 'rgba(52,199,89,0.1)', borderColor: 'rgba(52,199,89,0.3)' },
  revealWrong: { backgroundColor: 'rgba(255,59,48,0.08)', borderColor: 'rgba(255,59,48,0.2)' },
  revealName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  revealGuess: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  revealActual: { fontSize: 13, fontWeight: 'bold' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  scoreFirst: { backgroundColor: 'rgba(255,204,0,0.06)', borderColor: 'rgba(255,204,0,0.2)' },
  scoreRank: { fontSize: 20, width: 40, textAlign: 'center' },
  scoreName: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  scoreVal: { color: Colors.orange, fontSize: 17, fontWeight: 'bold' },
});
