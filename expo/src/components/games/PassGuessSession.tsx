import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import { GamePassPhoneView } from './SharedGameComponents';
import { PhaseTransition } from './PhaseTransition';

import * as Haptics from '@/src/utils/safeHaptics';

interface Props {
  session: GameSession;
}

type Phase = 'intro' | 'answering' | 'hostGuessing' | 'leaderboard' | 'finished';
type PlayMode = 'classic' | 'whoSaidIt';

interface PassGuessAnswer {
  id: string;
  playerID: string;
  text: string;
}

const PREDEFINED_QUESTIONS = [
  "What is your most irrational fear?",
  "What is the weirdest snack combo you would actually eat?",
  "What would be your secret superpower in real life?",
  "What is the most embarrassing song you know all the words to?",
  "If you had to get a useless tattoo right now, what would it be?",
  "What is your villain origin story?",
  "What is the most overrated thing in life?",
  "If you could only eat one meal for the rest of your life, what would it be?",
  "What is the pettiest reason you stopped talking to someone?",
  "What's a hill you're willing to die on?",
  "If you were a ghost, who would you haunt first?",
  "What is the biggest lie you've ever told and gotten away with?",
  "What's the most embarrassing thing in your search history?",
  "If you could swap lives with someone for a day, who would it be?",
  "What is something you pretend to like but secretly hate?",
  "What would your autobiography be called?",
  "What's the dumbest thing you believed as a kid?",
  "If animals could talk, which would be the rudest?",
  "What is your toxic trait?",
  "If you were famous, what would you be famous for?",
  "What is the most chaotic thing you've done at a party?",
  "What is your hot take that would get you cancelled?",
];

const COLORS = [
  '#FF2D55',
  '#007AFF',
  Colors.green,
  Colors.orange,
  '#AF52DE',
  Colors.yellow,
  '#5AC8FA',
  '#5856D6',
];

function getPlayerColor(index: number) {
  return COLORS[index % COLORS.length];
}

export function PassGuessSession({ session }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [roundNumber, setRoundNumber] = useState(1);
  const totalRounds = (session.gameConfig?.rounds as number) || 1;
  const [playMode, setPlayMode] = useState<PlayMode>('classic');

  const answerTime = (session.gameConfig?.answerTime as number) || 60;
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  useEffect(() => { return () => clearTimer(); }, []);

  const [question, setQuestion] = useState(PREDEFINED_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const [answers, setAnswers] = useState<PassGuessAnswer[]>([]);
  /** allPlayerGuesses[voterPlayerId][answerId] = guessedPlayerId */
  const [allPlayerGuesses, setAllPlayerGuesses] = useState<Record<string, Record<string, string>>>({});
  /** Guesses the current active guesser has made */
  const [currentGuesses, setCurrentGuesses] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, number>>({});

  const [showPrivacyScreen, setShowPrivacyScreen] = useState(false);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');

  const currentPlayer = session.players[activePlayerIndex];
  const activeQuestion = useCustom ? customQuestion : question;

  // Filter out the active guesser's own answer so they only see and guess on others
  const visibleAnswers = answers.filter(ans => ans.playerID !== currentPlayer?.id);
  const allCurrentAnswersAssigned = visibleAnswers.length > 0 && visibleAnswers.every(a => currentGuesses[a.id]);

  useEffect(() => {
    if (Object.keys(scores).length === 0) {
      const initialScores: Record<string, number> = {};
      session.players.forEach(p => initialScores[p.id] = 0);
      setScores(initialScores);
    }
  }, []);

  const handleStartRound = () => {
    if (playMode === 'classic' && useCustom && !customQuestion.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAnswers([]);
    setAllPlayerGuesses({});
    setCurrentGuesses({});
    setActivePlayerIndex(0);
    setShowPrivacyScreen(true);
    setPhase('answering');
  };

  const handlePrivacyReady = () => {
    Haptics.selectionAsync();
    setShowPrivacyScreen(false);
    clearTimer();
    setTimer(answerTime);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearTimer(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (phase === 'answering' && timer === 0 && !showPrivacyScreen) {
      handleSubmitAnswer(true);
    }
  }, [timer, phase, showPrivacyScreen]);

  const advanceAnsweringPhase = (nextPlayerIdx: number) => {
    if (nextPlayerIdx < session.players.length) {
      setActivePlayerIndex(nextPlayerIdx);
      setShowPrivacyScreen(true);
    } else {
      // Start guessing phase
      setActivePlayerIndex(0);
      setCurrentGuesses({});
      setAllPlayerGuesses({});
      setShowPrivacyScreen(true);
      setPhase('hostGuessing');
    }
  };

  const handleSubmitAnswer = (autoSkip = false) => {
    clearTimer();
    if (!autoSkip && !currentAnswer.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const text = currentAnswer.trim() || '(no answer)';
    setAnswers(prev => [...prev, { id: Math.random().toString(), playerID: currentPlayer.id, text }]);
    setCurrentAnswer('');
    advanceAnsweringPhase(activePlayerIndex + 1);
  };

  const handleGuessAssign = (answerId: string, playerId: string) => {
    Haptics.selectionAsync();
    setCurrentGuesses(prev => ({ ...prev, [answerId]: playerId }));
  };

  const handleSubmitCurrentGuesses = () => {
    if (!allCurrentAnswersAssigned) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const guesser = currentPlayer;
    const updatedAllGuesses = { ...allPlayerGuesses, [guesser.id]: currentGuesses };
    setAllPlayerGuesses(updatedAllGuesses);

    const nextGuesserIndex = activePlayerIndex + 1;
    if (nextGuesserIndex < session.players.length) {
      setActivePlayerIndex(nextGuesserIndex);
      setCurrentGuesses({});
      setShowPrivacyScreen(true);
    } else {
      // End of round: update scores (100 points per correct guess)
      const newScores = { ...scores };
      session.players.forEach(p => {
        const guesses = updatedAllGuesses[p.id] || {};
        answers.forEach(answer => {
          if (answer.playerID !== p.id) {
            if (guesses[answer.id] === answer.playerID) {
              newScores[p.id] = (newScores[p.id] || 0) + 100;
            }
          }
        });
      });
      setScores(newScores);
      setPhase('leaderboard');
    }
  };

  const nextPhase = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (phase === 'leaderboard') {
      if (roundNumber >= totalRounds) {
        setPhase('finished');
      } else {
        setRoundNumber(prev => prev + 1);
        setPhase('intro');
      }
    }
  };

  // Helper helper to get stats for leaderboard
  const getPlayerStats = (playerId: string) => {
    const guesses = allPlayerGuesses[playerId] || {};
    let correct = 0;
    let wrong = 0;
    answers.forEach(answer => {
      if (answer.playerID !== playerId) {
        const choice = guesses[answer.id];
        if (choice) {
          if (choice === answer.playerID) correct++;
          else wrong++;
        }
      }
    });
    return { correct, wrong };
  };

  if (showPrivacyScreen) {
    const color = getPlayerColor(activePlayerIndex);
    const isGuessingPhase = phase === 'hostGuessing';
    return (
      <GamePassPhoneView
        playerName={currentPlayer.displayName}
        subtitle={isGuessingPhase
          ? "They will guess who wrote each answer."
          : "They will write their answer privately."
        }
        accentColor={color}
        onReady={() => {
          Haptics.selectionAsync();
          setShowPrivacyScreen(false);
          if (!isGuessingPhase) {
            clearTimer();
            setTimer(answerTime);
            timerRef.current = setInterval(() => {
              setTimer(prev => {
                if (prev <= 1) { clearTimer(); return 0; }
                return prev - 1;
              });
            }, 1000);
          }
        }}
        onSkip={isGuessingPhase ? undefined : () => {
          setAnswers(prev => [...prev, { id: Math.random().toString(), playerID: currentPlayer.id, text: '(skipped)' }]);
          setCurrentAnswer('');
          advanceAnsweringPhase(activePlayerIndex + 1);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <PhaseTransition phaseKey={phase} style={{ flex: 1 }}>

        {/* ══════════════════════════ INTRO ══════════════════════════ */}
        {phase === 'intro' && (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.iconHeader}>
                <View style={styles.iconCircle}>
                  <IconSymbol name="text.bubble.fill" size={36} color={Colors.yellow} />
                </View>
              </View>
              <Text style={styles.title}>Round {roundNumber} of {totalRounds}</Text>
              <Text style={styles.subtitle}>Everyone writes privately. Then each player gets the phone to guess everyone's answers!</Text>

              {/* Redesigned Premium Mode Cards */}
              <Text style={styles.sectionLabel}>Select Game Mode</Text>
              <View style={styles.modeCardsContainer}>
                <Pressable
                  style={[styles.modeCard, playMode === 'classic' && styles.modeCardActiveClassic]}
                  onPress={() => { setPlayMode('classic'); setUseCustom(false); }}
                >
                  <View style={[styles.modeIconCircle, { backgroundColor: 'rgba(255, 214, 10, 0.15)' }]}>
                    <IconSymbol name="questionmark.bubble.fill" size={20} color={Colors.yellow} />
                  </View>
                  <Text style={styles.modeCardTitle}>Classic Q&A</Text>
                  <Text style={styles.modeCardDesc}>Answer funny questions privately and guess who said what.</Text>
                </Pressable>

                <Pressable
                  style={[styles.modeCard, playMode === 'whoSaidIt' && styles.modeCardActiveWhoSaidIt]}
                  onPress={() => setPlayMode('whoSaidIt')}
                >
                  <View style={[styles.modeIconCircle, { backgroundColor: 'rgba(175, 82, 222, 0.15)' }]}>
                    <IconSymbol name="person.fill.questionmark" size={20} color="#AF52DE" />
                  </View>
                  <Text style={styles.modeCardTitle}>Who Said It?</Text>
                  <Text style={styles.modeCardDesc}>Write any free-form fact, secret or story about yourself.</Text>
                </Pressable>
              </View>

              {playMode === 'classic' && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Choose a Question</Text>
                  <View style={styles.tabsRow}>
                    <Pressable style={[styles.tab, !useCustom && styles.tabActive]} onPress={() => setUseCustom(false)}>
                      <Text style={[styles.tabText, !useCustom && styles.tabTextActive]}>Predefined</Text>
                    </Pressable>
                    <Pressable style={[styles.tab, useCustom && styles.tabActive]} onPress={() => setUseCustom(true)}>
                      <Text style={[styles.tabText, useCustom && styles.tabTextActive]}>Custom</Text>
                    </Pressable>
                  </View>
                  {!useCustom ? (
                    <View style={styles.questionsList}>
                      {PREDEFINED_QUESTIONS.map((q, i) => (
                        <Pressable key={i} style={[styles.questionBtn, question === q && styles.questionBtnActive]} onPress={() => setQuestion(q)}>
                          {question === q && <View style={styles.questionActiveDot} />}
                          <Text style={[styles.questionText, question === q && { color: '#5AC8FA' }]}>{q}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <TextInput style={styles.input} placeholder="Write your custom question..." placeholderTextColor="rgba(255,255,255,0.3)" value={customQuestion} onChangeText={setCustomQuestion} multiline />
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.stickyBottom}>
              <Pressable style={[styles.primaryBtn, (playMode === 'classic' && useCustom && !customQuestion.trim()) && { opacity: 0.5 }]} onPress={handleStartRound} disabled={playMode === 'classic' && useCustom && !customQuestion.trim()}>
                <IconSymbol name="play.fill" size={18} color="white" />
                <Text style={styles.primaryBtnText}>Start Round</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ══════════════════════════ ANSWERING ══════════════════════════ */}
        {phase === 'answering' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <IconSymbol name="flag.fill" size={12} color="white" />
                <Text style={styles.badgeText}>Round {roundNumber}/{totalRounds}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <HStack>
                <View style={styles.turnPill}>
                  <Text style={styles.turnPillText}>Now: {currentPlayer.displayName}</Text>
                </View>
                <Text style={styles.progressText}>{answers.length}/{session.players.length} answered</Text>
              </HStack>
              {playMode === 'classic' ? (
                <Text style={styles.questionPrompt}>{activeQuestion}</Text>
              ) : (
                <Text style={styles.questionPrompt}>Write something true about yourself!</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Private Answer</Text>
              <Text style={styles.cardSubtitle}>{playMode === 'classic' ? 'No previous answers are shown.' : 'A fact, confession, memory — anything goes!'}</Text>
              {timer > 0 && (
                <View style={styles.timerRow}>
                  <IconSymbol name="timer" size={14} color={timer <= 10 ? Colors.red : '#5AC8FA'} />
                  <Text style={[styles.timerText, timer <= 10 && { color: Colors.red }]}>{timer}s</Text>
                </View>
              )}
              <TextInput style={styles.input} placeholder={playMode === 'classic' ? "Write your answer" : "Write something about yourself..."} placeholderTextColor="rgba(255,255,255,0.3)" value={currentAnswer} onChangeText={setCurrentAnswer} multiline maxLength={120} autoFocus />
              <Text style={styles.charCount}>{currentAnswer.length}/120</Text>
              <Pressable style={[styles.primaryBtn, !currentAnswer.trim() && { opacity: 0.5 }]} onPress={() => handleSubmitAnswer(false)} disabled={!currentAnswer.trim()}>
                <Text style={styles.primaryBtnText}>Done & Pass</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {/* ══════════════════════════ GUESSING ══════════════════════════ */}
        {phase === 'hostGuessing' && (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Turn header */}
              <View style={styles.card}>
                <HStack>
                  <View style={[styles.turnPill, { backgroundColor: '#AF52DE' }]}>
                    <IconSymbol name="person.fill.questionmark" size={12} color="white" />
                    <Text style={styles.turnPillText}>{currentPlayer.displayName}'s Turn</Text>
                  </View>
                  <Text style={styles.progressText}>
                    Guesser {activePlayerIndex + 1} of {session.players.length}
                  </Text>
                </HStack>
                <Text style={[styles.questionPrompt, { fontSize: 14, marginTop: 10 }]}>
                  {playMode === 'whoSaidIt'
                    ? 'Guess who wrote each statement (yours is hidden).'
                    : 'Guess who wrote each answer (yours is hidden).'}
                </Text>
              </View>

              {/* Progress bar */}
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { flex: Object.keys(currentGuesses).length }]} />
                {visibleAnswers.length - Object.keys(currentGuesses).length > 0 && (
                  <View style={{ flex: visibleAnswers.length - Object.keys(currentGuesses).length }} />
                )}
              </View>
              <Text style={[styles.progressText, { textAlign: 'center', marginBottom: 20 }]}>
                {Object.keys(currentGuesses).length} of {visibleAnswers.length} assigned
              </Text>

              {visibleAnswers.map((ans, idx) => {
                const assigned = currentGuesses[ans.id];
                return (
                  <View key={ans.id} style={[styles.card, assigned ? styles.cardAssigned : null, { padding: 14 }]}>
                    <View style={styles.answerHeaderRow}>
                      <View style={[styles.answerNumBadge, assigned ? styles.answerNumBadgeDone : null]}>
                        {assigned ? <IconSymbol name="checkmark" size={10} color={Colors.green} /> : <Text style={styles.answerNumText}>#{idx + 1}</Text>}
                      </View>
                      <Text style={[styles.cardSubtitle, { flex: 1, marginBottom: 0, marginLeft: 8, fontSize: 12 }]}>
                        {playMode === 'whoSaidIt' ? 'Statement' : 'Answer'}
                      </Text>
                    </View>
                    <Text style={[styles.answerText, { marginTop: 8, marginBottom: 12, fontSize: 15 }]}>{ans.text}</Text>
                    
                    {/* Compact Choice list / Horizontal Wrap */}
                    <View style={styles.compactChipsContainer}>
                      {session.players.map((p, i) => {
                        const isSelected = assigned === p.id;
                        const pColor = getPlayerColor(i);
                        return (
                          <Pressable
                            key={p.id}
                            style={[
                              styles.compactChip,
                              isSelected && {
                                borderColor: pColor,
                                backgroundColor: `${pColor}1A`,
                              },
                            ]}
                            onPress={() => handleGuessAssign(ans.id, p.id)}
                          >
                            <View style={[styles.dotIndicator, { backgroundColor: pColor }]} />
                            <Text style={[styles.compactChipText, { color: isSelected ? 'white' : 'rgba(255,255,255,0.7)' }]}>
                              {p.displayName}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.stickyBottom}>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: '#AF52DE' }, !allCurrentAnswersAssigned && { opacity: 0.4 }]}
                onPress={handleSubmitCurrentGuesses}
                disabled={!allCurrentAnswersAssigned}
              >
                <IconSymbol name="arrow.right.circle.fill" size={18} color="white" />
                <Text style={styles.primaryBtnText}>
                  {activePlayerIndex + 1 < session.players.length ? 'Done — Next Player' : 'See Leaderboard!'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ══════════════════════════ LEADERBOARD + STATISTICS ══════════════════════════ */}
        {phase === 'leaderboard' && (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Leaderboard</Text>
              <Text style={styles.subtitle}>Round results & details · +100 pts per correct guess!</Text>

              {/* Ranks list with correct/wrong stats */}
              <View style={styles.card}>
                {session.players.slice().sort((a, b) => scores[b.id] - scores[a.id]).map((p, i) => {
                  const pColor = getPlayerColor(session.players.findIndex(x => x.id === p.id));
                  const stats = getPlayerStats(p.id);
                  return (
                    <View key={p.id} style={styles.statsLeaderboardRow}>
                      <HStack>
                        <Text style={[styles.rank, i === 0 && { color: Colors.yellow }]}>#{i + 1}</Text>
                        <Text style={[styles.leaderboardName, { color: pColor }]}>{p.displayName}</Text>
                        <Text style={styles.scoreText}>{scores[p.id]} pts</Text>
                      </HStack>
                      <View style={styles.statsSubRow}>
                        <Text style={styles.statsSubText}>
                          Guesses: <Text style={{ color: Colors.green, fontWeight: 'bold' }}>{stats.correct} ✓</Text>  |  <Text style={{ color: Colors.red }}>{stats.wrong} ✗</Text>
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Answer details on the same page */}
              <Text style={styles.sectionLabel}>Answers & Authors</Text>
              {answers.map((ans) => {
                const author = session.players.find(p => p.id === ans.playerID);
                const authorColor = author ? getPlayerColor(session.players.indexOf(author)) : 'white';
                return (
                  <View key={ans.id} style={[styles.card, { padding: 14, marginBottom: 8 }]}>
                    <Text style={[styles.answerText, { fontSize: 14 }]}>{ans.text}</Text>
                    <HStack style={{ marginTop: 8 }}>
                      <View style={styles.revealChip}>
                        <IconSymbol name="pencil" size={10} color="rgba(255,255,255,0.4)" />
                        <Text style={[styles.revealChipText, { color: authorColor, fontSize: 12 }]}>{author?.displayName}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                        {session.players.filter(p => p.id !== ans.playerID && allPlayerGuesses[p.id]?.[ans.id] === ans.playerID).length} players guessed right
                      </Text>
                    </HStack>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.stickyBottom}>
              <Pressable style={styles.primaryBtn} onPress={nextPhase}>
                <Text style={styles.primaryBtnText}>{roundNumber >= totalRounds ? "Finish Game" : "Next Round"}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ══════════════════════════ FINISHED ══════════════════════════ */}
        {phase === 'finished' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ResultsScoreboard
              title="Final Results"
              entries={session.players.slice().sort((a, b) => scores[b.id] - scores[a.id]).map((p): RankEntry => ({
                id: p.id,
                name: p.displayName,
                primary: `${scores[p.id] ?? 0} pts`,
                nameColor: getPlayerColor(session.players.findIndex(x => x.id === p.id)),
              }))}
            />
            <Pressable style={[styles.primaryBtn, { marginTop: 20, backgroundColor: Colors.green }]} onPress={() => { setRoundNumber(1); setPhase('intro'); setPlayMode('classic'); setScores(() => { const s: Record<string, number> = {}; session.players.forEach(p => s[p.id] = 0); return s; }); }}>
              <Text style={styles.primaryBtnText}>Play Again</Text>
            </Pressable>
          </ScrollView>
        )}

      </PhaseTransition>
    </View>
  );
}

const HStack = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { paddingBottom: 20, paddingTop: 16 },
  stickyBottom: { paddingVertical: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(0,0,0,0.4)' },
  iconHeader: { alignItems: 'center', marginBottom: 16 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 214, 10, 0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 214, 10, 0.2)' },
  title: { color: 'white', fontSize: 24, fontFamily: 'Viral-Black', textAlign: 'center', marginBottom: 6 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20, lineHeight: 20 },
  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
  
  // Premium Mode Cards
  modeCardsContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modeCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', justifyContent: 'space-between' },
  modeCardActiveClassic: { borderColor: Colors.yellow, backgroundColor: 'rgba(255, 214, 10, 0.05)' },
  modeCardActiveWhoSaidIt: { borderColor: '#AF52DE', backgroundColor: 'rgba(175, 82, 222, 0.05)' },
  modeIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  modeCardTitle: { color: 'white', fontSize: 15, fontFamily: 'Viral-Black', marginBottom: 4 },
  modeCardDesc: { color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 15 },

  card: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardAssigned: { borderColor: 'rgba(48,209,88,0.25)', backgroundColor: 'rgba(48,209,88,0.04)' },
  cardCorrect: { borderColor: 'rgba(48,209,88,0.3)', backgroundColor: 'rgba(48,209,88,0.06)' },
  cardWrong: { borderColor: 'rgba(255,59,48,0.25)', backgroundColor: 'rgba(255,59,48,0.05)' },
  cardTitle: { color: 'white', fontSize: 15, fontFamily: 'Viral-Black', marginBottom: 10 },
  cardSubtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 14 },
  tabsRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14, padding: 3, marginBottom: 14, gap: 2 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 11, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  tabText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: 'white' },
  questionsList: { gap: 8 },
  questionBtn: { padding: 14, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', gap: 10 },
  questionBtnActive: { backgroundColor: 'rgba(90,200,250,0.08)', borderColor: 'rgba(90,200,250,0.35)' },
  questionActiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5AC8FA', flexShrink: 0 },
  questionText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, flex: 1, lineHeight: 21 },
  input: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 16, color: 'white', fontSize: 16, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  charCount: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'right', marginTop: 6, marginBottom: 14 },
  primaryBtn: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  badgeRow: { flexDirection: 'row', marginBottom: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, gap: 6 },
  badgeText: { color: 'white', fontWeight: '600', fontSize: 13 },
  turnPill: { backgroundColor: Colors.green, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  turnPillText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  progressText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  progressBar: { flexDirection: 'row', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 4, marginBottom: 8, overflow: 'hidden' },
  progressFill: { backgroundColor: Colors.green, borderRadius: 2 },
  questionPrompt: { color: 'white', fontSize: 20, fontFamily: 'Viral-Black', marginTop: 14, lineHeight: 28 },
  answerHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  answerNumBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  answerNumBadgeDone: { backgroundColor: 'rgba(48,209,88,0.15)', borderColor: 'rgba(48,209,88,0.35)' },
  answerNumText: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700' },
  answerText: { color: 'white', fontSize: 16, fontFamily: 'Viral-Black', lineHeight: 24 },
  
  // Compact Choice Chips Grid Style
  compactChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  compactChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  compactChipText: { fontSize: 12, fontFamily: 'Viral-Black' },
  dotIndicator: { width: 6, height: 6, borderRadius: 3 },

  revealRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  revealChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  revealChipText: { fontSize: 13, fontFamily: 'Viral-Black' },
  revealResultBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  revealResultText: { fontSize: 12, fontWeight: '700' },
  guessedAsText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8 },
  
  // Leaderboard statistics row styles
  statsLeaderboardRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  statsSubRow: { paddingLeft: 30, marginTop: 2 },
  statsSubText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  leaderboardRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rank: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontFamily: 'Viral-Black', width: 30 },
  leaderboardName: { fontSize: 16, fontFamily: 'Viral-Black', flex: 1 },
  scoreText: { color: 'white', fontSize: 16, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, alignSelf: 'flex-end' },
  timerText: { color: '#5AC8FA', fontSize: 16, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
});
