import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';

import * as Haptics from '@/src/utils/safeHaptics';

interface Props {
  session: GameSession;
}

type Phase = 'intro' | 'answering' | 'guessing' | 'reveal' | 'leaderboard' | 'finished';

interface PassGuessAnswer {
  id: string;
  playerID: string;
  text: string;
}

interface PassGuessVote {
  voterID: string;
  answerID: string;
  guessedPlayerID: string;
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
  '#FF2D55', // Pink/Red
  '#007AFF', // Blue
  Colors.green, // Green
  Colors.orange, // Orange
  '#AF52DE', // Purple
  Colors.yellow, // Yellow
  '#5AC8FA', // Cyan
  '#5856D6', // Indigo
];

function getPlayerColor(index: number) {
  return COLORS[index % COLORS.length];
}

export function PassGuessSession({ session }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [roundNumber, setRoundNumber] = useState(1);
  const totalRounds = (session.gameConfig?.rounds as number) || 1;

  // Timer state
  const answerTime = (session.gameConfig?.answerTime as number) || 60;
  const guessTime = (session.gameConfig?.guessTime as number) || 30;
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  useEffect(() => { return () => clearTimer(); }, []);

  // State
  const [question, setQuestion] = useState(PREDEFINED_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const [answers, setAnswers] = useState<PassGuessAnswer[]>([]);
  const [votes, setVotes] = useState<PassGuessVote[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});

  // Current turn state
  const [showPrivacyScreen, setShowPrivacyScreen] = useState(false);
  const [privacyAction, setPrivacyAction] = useState<'answer' | 'guess'>('answer');
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);

  // Inputs
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [selectedGuess, setSelectedGuess] = useState<string | null>(null);

  // Computed
  const currentPlayer = session.players[activePlayerIndex];
  const activeQuestion = useCustom ? customQuestion : question;

  useEffect(() => {
    // Initialize scores
    if (Object.keys(scores).length === 0) {
      const initialScores: Record<string, number> = {};
      session.players.forEach(p => initialScores[p.id] = 0);
      setScores(initialScores);
    }
  }, []);

  const handleStartRound = () => {
    if (useCustom && !customQuestion.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAnswers([]);
    setVotes([]);
    setActivePlayerIndex(0);
    setPrivacyAction('answer');
    setShowPrivacyScreen(true);
    setTimer(answerTime);
    setPhase('answering');
  };

  const handlePrivacyReady = () => {
    Haptics.selectionAsync();
    setShowPrivacyScreen(false);
    // Start countdown timer
    clearTimer();
    const limit = phase === 'answering' ? answerTime : guessTime;
    setTimer(limit);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Auto-skip on answer timer expiry
  useEffect(() => {
    if (phase === 'answering' && timer === 0 && !showPrivacyScreen) {
      handleSubmitAnswer(true);
    }
  }, [timer, phase, showPrivacyScreen]);

  // Auto-skip on guess timer expiry
  useEffect(() => {
    if (phase === 'guessing' && timer === 0 && !showPrivacyScreen) {
      // skip this guess (no selection)
      handleSkipGuess();
    }
  }, [timer, phase, showPrivacyScreen]);

  const handleSkipGuess = () => {
    clearTimer();
    const nextVoteCount = votes.length;
    if (nextVoteCount >= session.players.length * answers.length) {
      calculateScores();
      setPhase('reveal');
    } else {
      const nextVoterIndex = nextVoteCount % session.players.length;
      setActivePlayerIndex(nextVoterIndex);
      setPrivacyAction('guess');
      setShowPrivacyScreen(true);
    }
  };

  const handleSubmitAnswer = (autoSkip = false) => {
    clearTimer();
    if (!autoSkip && !currentAnswer.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const text = currentAnswer.trim() || '(no answer)';
    setAnswers(prev => [...prev, {
      id: Math.random().toString(),
      playerID: currentPlayer.id,
      text,
    }]);
    
    setCurrentAnswer('');

    if (activePlayerIndex + 1 < session.players.length) {
      setActivePlayerIndex(prev => prev + 1);
      setPrivacyAction('answer');
      setShowPrivacyScreen(true);
    } else {
      // Move to guessing
      setPhase('guessing');
      setActivePlayerIndex(0);
      setPrivacyAction('guess');
      setShowPrivacyScreen(true);
    }
  };

  const handleSubmitGuess = () => {
    if (!selectedGuess) return;
    clearTimer();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const currentAnswerToGuess = answers[Math.floor(votes.length / session.players.length)];

    setVotes(prev => [...prev, {
      voterID: currentPlayer.id,
      answerID: currentAnswerToGuess.id,
      guessedPlayerID: selectedGuess
    }]);

    setSelectedGuess(null);

    const nextVoteCount = votes.length + 1;
    if (nextVoteCount >= session.players.length * answers.length) {
      calculateScores();
      setPhase('reveal');
    } else {
      const nextVoterIndex = nextVoteCount % session.players.length;
      setActivePlayerIndex(nextVoterIndex);
      setPrivacyAction('guess');
      setShowPrivacyScreen(true);
    }
  };

  const calculateScores = () => {
    const newScores = { ...scores };
    votes.forEach(vote => {
      const answer = answers.find(a => a.id === vote.answerID);
      if (answer && answer.playerID === vote.guessedPlayerID) {
        newScores[vote.voterID] += 100; // 100 pts for correct guess
      }
    });
    setScores(newScores);
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

  if (showPrivacyScreen) {
    const color = getPlayerColor(activePlayerIndex);
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <IconSymbol name="eye.slash.fill" size={64} color={color} />
        <Text style={styles.privacyTitle}>Pass the phone to</Text>
        <Text style={[styles.privacyName, { color }]}>{currentPlayer.displayName}</Text>
        <Text style={styles.privacySubtitle}>
          {privacyAction === 'answer' ? "They will write their answer privately." : "They will guess who wrote an answer."}
        </Text>
        
        <Pressable style={[styles.primaryBtn, { backgroundColor: color, marginTop: 40 }]} onPress={handlePrivacyReady}>
          <Text style={styles.primaryBtnText}>I&apos;m Ready</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {phase === 'intro' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.iconHeader}>
            <IconSymbol name="text.bubble.fill" size={48} color={Colors.yellow} />
          </View>
          <Text style={styles.title}>Round {roundNumber} of {totalRounds}</Text>
          <Text style={styles.subtitle}>Everyone writes a private answer first. No reveals until the end.</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Choose a Question</Text>
            <View style={styles.tabsRow}>
              <Pressable style={[styles.tab, !useCustom && styles.tabActive]} onPress={() => setUseCustom(false)}>
                <Text style={styles.tabText}>Predefined</Text>
              </Pressable>
              <Pressable style={[styles.tab, useCustom && styles.tabActive]} onPress={() => setUseCustom(true)}>
                <Text style={styles.tabText}>Custom</Text>
              </Pressable>
            </View>

            {!useCustom ? (
              <View style={styles.questionsList}>
                {PREDEFINED_QUESTIONS.map((q, i) => (
                  <Pressable 
                    key={i} 
                    style={[styles.questionBtn, question === q && styles.questionBtnActive]}
                    onPress={() => setQuestion(q)}
                  >
                    <Text style={styles.questionText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Write your custom question..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={customQuestion}
                onChangeText={setCustomQuestion}
                multiline
              />
            )}
          </View>

          <Pressable 
            style={[styles.primaryBtn, (useCustom && !customQuestion.trim()) && { opacity: 0.5 }]} 
            onPress={handleStartRound}
            disabled={useCustom && !customQuestion.trim()}
          >
            <Text style={styles.primaryBtnText}>Start Round</Text>
          </Pressable>
        </ScrollView>
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
            <Text style={styles.questionPrompt}>{activeQuestion}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Private Answer</Text>
            <Text style={styles.cardSubtitle}>No previous answers are shown.</Text>
            {timer > 0 && <View style={styles.timerRow}>
              <IconSymbol name="timer" size={14} color={timer <= 10 ? Colors.red : '#5AC8FA'} />
              <Text style={[styles.timerText, timer <= 10 && { color: Colors.red }]}>{timer}s</Text>
            </View>}
            <TextInput
              style={styles.input}
              placeholder="Write your answer"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={currentAnswer}
              onChangeText={setCurrentAnswer}
              multiline
              maxLength={120}
              autoFocus
            />
            <Text style={styles.charCount}>{currentAnswer.length}/120</Text>

            <Pressable 
              style={[styles.primaryBtn, !currentAnswer.trim() && { opacity: 0.5 }]} 
              onPress={() => handleSubmitAnswer(false)}
              disabled={!currentAnswer.trim()}
            >
              <Text style={styles.primaryBtnText}>Done & Pass</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {phase === 'guessing' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {(() => {
            const currentAnswerToGuessIndex = Math.floor(votes.length / session.players.length);
            const currentAnswerToGuess = answers[currentAnswerToGuessIndex];
            
            return (
              <>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Answer {currentAnswerToGuessIndex + 1} of {answers.length}</Text>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardSubtitle}>Anonymous Answer</Text>
                  <Text style={styles.questionPrompt}>{currentAnswerToGuess?.text}</Text>
                </View>

                <View style={styles.card}>
                  <HStack>
                    <View>
                      <Text style={[styles.voterName, { color: getPlayerColor(activePlayerIndex) }]}>
                        {currentPlayer.displayName}
                      </Text>
                      <Text style={styles.cardSubtitle}>Who wrote this?</Text>
                    </View>
                    <Text style={styles.progressText}>Vote {(votes.length % session.players.length) + 1}/{session.players.length}</Text>
                  </HStack>

                  <View style={styles.candidatesList}>
                    {session.players.map((p, i) => (
                      <Pressable 
                        key={p.id}
                        style={[styles.candidateBtn, selectedGuess === p.id && styles.candidateBtnActive]}
                        onPress={() => setSelectedGuess(p.id)}
                      >
                        <Text style={[styles.candidateText, { color: getPlayerColor(i) }]}>{p.displayName}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable 
                    style={[styles.primaryBtn, !selectedGuess && { opacity: 0.5 }]} 
                    onPress={handleSubmitGuess}
                    disabled={!selectedGuess}
                  >
                    <Text style={styles.primaryBtnText}>Submit Vote</Text>
                  </Pressable>
                </View>
              </>
            );
          })()}
        </ScrollView>
      )}

      {phase === 'reveal' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Reveal Time</Text>
          <Text style={styles.subtitle}>{activeQuestion}</Text>

          {answers.map((ans, idx) => {
            const author = session.players.find(p => p.id === ans.playerID);
            const authorColor = author ? getPlayerColor(session.players.indexOf(author)) : 'white';
            const correctVotes = votes.filter(v => v.answerID === ans.id && v.guessedPlayerID === ans.playerID).length;
            
            return (
              <View key={ans.id} style={styles.card}>
                <Text style={styles.answerText}>{ans.text}</Text>
                <HStack style={{ marginTop: 12 }}>
                  <Text style={[styles.authorText, { color: authorColor }]}>{author?.displayName}</Text>
                  <Text style={styles.correctText}>{correctVotes} correct guesses</Text>
                </HStack>
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
          <Text style={styles.subtitle}>Scores after round {roundNumber}</Text>

          <View style={styles.card}>
            {session.players.slice().sort((a,b) => scores[b.id] - scores[a.id]).map((p, i) => (
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
            entries={session.players
              .slice()
              .sort((a, b) => scores[b.id] - scores[a.id])
              .map((p): RankEntry => ({
                id: p.id,
                name: p.displayName,
                primary: `${scores[p.id] ?? 0} pts`,
                nameColor: getPlayerColor(session.players.findIndex(x => x.id === p.id)),
              }))}
          />

          <Pressable style={[styles.primaryBtn, { marginTop: 20, backgroundColor: Colors.green }]}
            onPress={() => { setRoundNumber(1); setPhase('intro'); setScores(() => { const s: Record<string,number> = {}; session.players.forEach(p => s[p.id] = 0); return s; }); }}>
            <Text style={styles.primaryBtnText}>Play Again</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const HStack = ({ children, style }: { children: React.ReactNode, style?: any }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 20,
  },
  iconHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginBottom: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tabText: {
    color: 'white',
    fontWeight: '600',
  },
  questionsList: {
    gap: 10,
  },
  questionBtn: {
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  questionBtnActive: {
    backgroundColor: 'rgba(0,122,255,0.15)',
    borderColor: '#007AFF',
  },
  questionText: {
    color: 'white',
    fontSize: 15,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 16,
    color: 'white',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  privacyTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 20,
    marginTop: 20,
  },
  privacyName: {
    fontSize: 34,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  privacySubtitle: {
    color: 'white',
    fontSize: 17,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  badgeText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  turnPill: {
    backgroundColor: Colors.green,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  turnPillText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  progressText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  questionPrompt: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
  },
  voterName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  candidatesList: {
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  candidateBtn: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  candidateBtnActive: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  candidateText: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  answerText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  authorText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  correctText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  leaderboardRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rank: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    fontWeight: 'bold',
    width: 30,
  },
  leaderboardName: {
    fontSize: 17,
    fontWeight: 'bold',
    flex: 1,
  },
  scoreText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    alignSelf: 'flex-end',
  },
  timerText: {
    color: '#5AC8FA',
    fontSize: 17,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
});
