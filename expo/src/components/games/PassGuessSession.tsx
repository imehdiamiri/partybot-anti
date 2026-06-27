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

type Phase = 'intro' | 'answering' | 'hostGuessing' | 'reveal' | 'leaderboard' | 'finished';
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
  /**
   * allPlayerGuesses[voterPlayerId][answerId] = guessedPlayerId
   * Each player gets their own turn to guess all answers.
   */
  const [allPlayerGuesses, setAllPlayerGuesses] = useState<Record<string, Record<string, string>>>({});
  /** Guesses the current guesser has made so far (answerId → guessedPlayerId) */
  const [currentGuesses, setCurrentGuesses] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, number>>({});

  const [showPrivacyScreen, setShowPrivacyScreen] = useState(false);
  /** In answering phase: index of the player writing. In guessing phase: index of the player guessing. */
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');

  const currentPlayer = session.players[activePlayerIndex];
  const activeQuestion = useCustom ? customQuestion : question;
  const allCurrentAnswersAssigned = answers.length > 0 && answers.every(a => currentGuesses[a.id]);

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
      // All answered — start guessing phase, first guesser
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

  /** Called when the current guesser submits all their guesses. */
  const handleSubmitCurrentGuesses = () => {
    if (!allCurrentAnswersAssigned) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const guesser = currentPlayer;
    const updatedAllGuesses = { ...allPlayerGuesses, [guesser.id]: currentGuesses };
    setAllPlayerGuesses(updatedAllGuesses);

    const nextGuesserIndex = activePlayerIndex + 1;
    if (nextGuesserIndex < session.players.length) {
      // Next player's guessing turn
      setActivePlayerIndex(nextGuesserIndex);
      setCurrentGuesses({});
      setShowPrivacyScreen(true);
    } else {
      // All players have guessed — calculate scores
      const newScores = { ...scores };
      // 100 pts to each player who correctly guessed an answer's author
      session.players.forEach(guesserPlayer => {
        const guesses = updatedAllGuesses[guesserPlayer.id] || {};
        answers.forEach(answer => {
          if (answer.playerID !== guesserPlayer.id) { // can't score on your own answer
            if (guesses[answer.id] === answer.playerID) {
              newScores[guesserPlayer.id] = (newScores[guesserPlayer.id] || 0) + 100;
            }
          }
        });
      });
      setScores(newScores);
      setPhase('reveal');
    }
  };

  const nextPhase = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (phase === 'reveal') {
      setPhase('leaderboard');
    } else if (phase === 'leaderboard') {
      if (roundNumber >= totalRounds) {
        setPhase('finished');
      } else {
        setRoundNumber(prev => prev + 1);
        setPhase('intro');
      }
    }
  };

  // In guessing phase, the privacy screen serves as the pass-to-next-guesser screen
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

        {phase === 'intro' && (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.iconHeader}>
                <View style={styles.iconCircle}>
                  <IconSymbol name="text.bubble.fill" size={36} color={Colors.yellow} />
                </View>
              </View>
              <Text style={styles.title}>Round {roundNumber} of {totalRounds}</Text>
              <Text style={styles.subtitle}>Everyone writes privately. One host reads and the group guesses together.</Text>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Game Mode</Text>
                <View style={styles.tabsRow}>
                  <Pressable style={[styles.tab, playMode === 'classic' && styles.tabActive]} onPress={() => { setPlayMode('classic'); setUseCustom(false); }}>
                    <IconSymbol name="questionmark.bubble.fill" size={13} color={playMode === 'classic' ? Colors.yellow : 'rgba(255,255,255,0.35)'} />
                    <Text style={[styles.tabText, playMode === 'classic' && styles.tabTextActive]}>Classic Q&A</Text>
                  </Pressable>
                  <Pressable style={[styles.tab, playMode === 'whoSaidIt' && styles.tabActive]} onPress={() => setPlayMode('whoSaidIt')}>
                    <IconSymbol name="person.fill.questionmark" size={13} color={playMode === 'whoSaidIt' ? '#AF52DE' : 'rgba(255,255,255,0.35)'} />
                    <Text style={[styles.tabText, playMode === 'whoSaidIt' && styles.tabTextActive]}>Who Said It?</Text>
                  </Pressable>
                </View>
                {playMode === 'whoSaidIt' && (
                  <View style={styles.modeDescBox}>
                    <Text style={styles.modeDescText}>Each player writes anything true about themselves — a confession, memory, random fact, or a secret. Then the host reads them aloud and the group tries to guess who wrote what!</Text>
                  </View>
                )}
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
                <Text style={[styles.questionPrompt, { fontSize: 15, marginTop: 10 }]}>
                  {playMode === 'whoSaidIt'
                    ? 'Assign each statement to the player you think wrote it.'
                    : 'Assign each answer to the player you think wrote it.'}
                </Text>
              </View>

              {/* Progress bar */}
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { flex: Object.keys(currentGuesses).length }]} />
                {answers.length - Object.keys(currentGuesses).length > 0 && (
                  <View style={{ flex: answers.length - Object.keys(currentGuesses).length }} />
                )}
              </View>
              <Text style={[styles.progressText, { textAlign: 'center', marginBottom: 20 }]}>
                {Object.keys(currentGuesses).length} of {answers.length} assigned
              </Text>

              {answers.map((ans, idx) => {
                const assigned = currentGuesses[ans.id];
                return (
                  <View key={ans.id} style={[styles.card, assigned ? styles.cardAssigned : null]}>
                    <View style={styles.answerHeaderRow}>
                      <View style={[styles.answerNumBadge, assigned ? styles.answerNumBadgeDone : null]}>
                        {assigned ? <IconSymbol name="checkmark" size={11} color={Colors.green} /> : <Text style={styles.answerNumText}>#{idx + 1}</Text>}
                      </View>
                      <Text style={[styles.cardSubtitle, { flex: 1, marginBottom: 0, marginLeft: 8 }]}>
                        {playMode === 'whoSaidIt' ? 'Statement' : 'Answer'}
                      </Text>
                    </View>
                    <Text style={[styles.answerText, { marginTop: 10, marginBottom: 16 }]}>{ans.text}</Text>
                    <Text style={[styles.cardSubtitle, { marginBottom: 8 }]}>Who wrote this?</Text>
                    <View style={styles.candidatesList}>
                      {session.players.map((p, i) => {
                        // Can't guess your own answer
                        const isOwn = p.id === ans.playerID;
                        const isSelected = assigned === p.id;
                        const pColor = getPlayerColor(i);
                        return (
                          <Pressable
                            key={p.id}
                            style={[styles.candidateBtn, isSelected && { borderColor: pColor, backgroundColor: `${pColor}22` }]}
                            onPress={() => handleGuessAssign(ans.id, p.id)}
                          >
                            {isSelected && <IconSymbol name="checkmark.circle.fill" size={15} color={pColor} />}
                            <Text style={[styles.candidateText, { color: isSelected ? pColor : 'rgba(255,255,255,0.75)' }]}>
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
                  {activePlayerIndex + 1 < session.players.length ? 'Done — Next Player' : 'Reveal Answers!'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {phase === 'reveal' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>Reveal Time!</Text>
            <Text style={styles.subtitle}>{playMode === 'classic' ? activeQuestion : 'Who said what?'}</Text>

            {answers.map((ans) => {
              const author = session.players.find(p => p.id === ans.playerID);
              const authorColor = author ? getPlayerColor(session.players.indexOf(author)) : 'white';
              // Count how many players guessed correctly for this answer
              const correctGuessers = session.players.filter(p =>
                p.id !== ans.playerID && allPlayerGuesses[p.id]?.[ans.id] === ans.playerID
              );
              const totalGuessers = session.players.filter(p => p.id !== ans.playerID).length;
              const allCorrect = correctGuessers.length === totalGuessers;
              const noneCorrect = correctGuessers.length === 0;

              return (
                <View key={ans.id} style={[styles.card, allCorrect ? styles.cardCorrect : noneCorrect ? styles.cardWrong : null]}>
                  <Text style={styles.answerText}>{ans.text}</Text>
                  <View style={styles.revealRow}>
                    <View style={styles.revealChip}>
                      <IconSymbol name="pencil" size={11} color="rgba(255,255,255,0.45)" />
                      <Text style={[styles.revealChipText, { color: authorColor }]}>{author?.displayName}</Text>
                    </View>
                    <View style={[styles.revealResultBadge, {
                      backgroundColor: noneCorrect ? 'rgba(255,59,48,0.12)' : 'rgba(48,209,88,0.14)',
                      borderColor: noneCorrect ? 'rgba(255,59,48,0.3)' : 'rgba(48,209,88,0.35)',
                    }]}>
                      <IconSymbol
                        name={noneCorrect ? 'xmark.circle.fill' : 'checkmark.circle.fill'}
                        size={13}
                        color={noneCorrect ? Colors.red : Colors.green}
                      />
                      <Text style={[styles.revealResultText, { color: noneCorrect ? Colors.red : Colors.green }]}>
                        {correctGuessers.length}/{totalGuessers} guessed right
                      </Text>
                    </View>
                  </View>
                  {/* Show who got it right */}
                  {correctGuessers.length > 0 && (
                    <Text style={styles.guessedAsText}>
                      Correct: <Text style={{ color: Colors.green }}>{correctGuessers.map(p => p.displayName).join(', ')}</Text>
                    </Text>
                  )}
                </View>
              );
            })}

            <Pressable style={[styles.primaryBtn, { marginTop: 20 }]} onPress={nextPhase}>
              <Text style={styles.primaryBtnText}>See Leaderboard</Text>
            </Pressable>
          </ScrollView>
        )}

        {phase === 'leaderboard' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>Leaderboard</Text>
            <Text style={styles.subtitle}>After round {roundNumber} · +100 pts per correct guess!</Text>

            <View style={styles.card}>
              {session.players.slice().sort((a, b) => scores[b.id] - scores[a.id]).map((p, i) => (
                <HStack key={p.id} style={styles.leaderboardRow}>
                  <Text style={[styles.rank, i === 0 && { color: Colors.yellow }]}>#{i + 1}</Text>
                  <Text style={[styles.leaderboardName, { color: getPlayerColor(session.players.findIndex(x => x.id === p.id)) }]}>{p.displayName}</Text>
                  <Text style={styles.scoreText}>{scores[p.id]} pts</Text>
                </HStack>
              ))}
            </View>

            <Pressable style={[styles.primaryBtn, { marginTop: 20 }]} onPress={nextPhase}>
              <Text style={styles.primaryBtnText}>{roundNumber >= totalRounds ? "Finish Game" : "Next Round"}</Text>
            </Pressable>
          </ScrollView>
        )}

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
  modeDescBox: { backgroundColor: 'rgba(175,82,222,0.1)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(175,82,222,0.2)' },
  modeDescText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 19 },
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
  turnPill: { backgroundColor: Colors.green, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  turnPillText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  progressText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  progressBar: { flexDirection: 'row', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 4, marginBottom: 8, overflow: 'hidden' },
  progressFill: { backgroundColor: Colors.green, borderRadius: 2 },
  questionPrompt: { color: 'white', fontSize: 20, fontFamily: 'Viral-Black', marginTop: 14, lineHeight: 28 },
  answerHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  answerNumBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  answerNumBadgeDone: { backgroundColor: 'rgba(48,209,88,0.15)', borderColor: 'rgba(48,209,88,0.35)' },
  answerNumText: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700' },
  candidatesList: { gap: 8 },
  candidateBtn: { padding: 14, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  candidateText: { fontSize: 15, fontFamily: 'Viral-Black' },
  answerText: { color: 'white', fontSize: 16, fontFamily: 'Viral-Black', lineHeight: 26 },
  revealRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  revealChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  revealChipText: { fontSize: 13, fontFamily: 'Viral-Black' },
  revealResultBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  revealResultText: { fontSize: 12, fontWeight: '700' },
  guessedAsText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8 },
  leaderboardRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rank: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontFamily: 'Viral-Black', width: 30 },
  leaderboardName: { fontSize: 16, fontFamily: 'Viral-Black', flex: 1 },
  scoreText: { color: 'white', fontSize: 16, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, alignSelf: 'flex-end' },
  timerText: { color: '#5AC8FA', fontSize: 16, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
});
