import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';

interface Props {
  session: GameSession;
}

type Phase = 'reveal' | 'ready' | 'discussion' | 'clueGiving' | 'voting' | 'results' | 'leaderboard' | 'finished';

const WORD_BANKS: Record<string, string[]> = {
  animals: ['Dog', 'Cat', 'Elephant', 'Lion', 'Tiger', 'Penguin', 'Giraffe', 'Dolphin', 'Eagle', 'Shark', 'Rabbit', 'Horse', 'Bear', 'Wolf', 'Fox'],
  food: ['Pizza', 'Sushi', 'Burger', 'Pasta', 'Taco', 'Chocolate', 'Ice Cream', 'Pancake', 'Steak', 'Salad', 'Soup', 'Sandwich', 'Cake', 'Cookie', 'Bread'],
  places: ['Hospital', 'Library', 'School', 'Restaurant', 'Bank', 'Airport', 'Museum', 'Beach', 'Stadium', 'Cinema', 'Park', 'Church', 'Mall', 'Gym', 'Zoo'],
  jobs: ['Doctor', 'Teacher', 'Chef', 'Pilot', 'Firefighter', 'Astronaut', 'Detective', 'Farmer', 'Architect', 'Nurse', 'Dentist', 'Lawyer', 'Artist', 'Singer', 'Actor'],
  movies: ['Titanic', 'Jaws', 'Avatar', 'Frozen', 'Batman', 'Shrek', 'Inception', 'Gladiator', 'Rocky', 'Aladdin', 'Jumanji', 'Moana', 'Coco', 'Bolt', 'Cars'],
  random: ['Umbrella', 'Telescope', 'Volcano', 'Diamond', 'Castle', 'Pirate', 'Rainbow', 'Robot', 'Dragon', 'Treasure', 'Compass', 'Candle', 'Bridge', 'Clock', 'Mirror'],
};

function pickWord(category?: string): string {
  const cat = category && WORD_BANKS[category] ? category : 'random';
  const bank = WORD_BANKS[cat];
  return bank[Math.floor(Math.random() * bank.length)];
}

const COLORS = [
  '#FF2D55', '#007AFF', Colors.green, Colors.orange, '#AF52DE', Colors.yellow, '#5AC8FA', '#5856D6'
];

function getPlayerColor(index: number) {
  return COLORS[index % COLORS.length];
}

export function ImposterSession({ session }: Props) {
  const [phase, setPhase] = useState<Phase>('reveal');
  const [roundNumber, setRoundNumber] = useState(1);
  const totalRounds = session.maxRounds ?? session.gameConfig?.rounds ?? 3;
  const gameStyle: 'discussion' | 'clue' = session.gameConfig?.gameStyle ?? 'discussion';
  const category: string = session.gameConfig?.category ?? 'random';

  const [imposterId, setImposterId] = useState('');
  const [secretWord, setSecretWord] = useState('');
  
  const [roundPlayers, setRoundPlayers] = useState([...session.players]);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [isRoleRevealed, setIsRoleRevealed] = useState(false);
  
  const [discussionTimeLeft, setDiscussionTimeLeft] = useState(120);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const [votes, setVotes] = useState<Record<string, string>>({});
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, number>>({});

  // Clue mode state
  const [clues, setClues] = useState<Record<string, string>>({});
  const [currentClue, setCurrentClue] = useState('');

  useEffect(() => {
    if (Object.keys(scores).length === 0) {
      const initialScores: Record<string, number> = {};
      session.players.forEach(p => initialScores[p.id] = 0);
      setScores(initialScores);
    }
    startNewRound();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTimerRunning && discussionTimeLeft > 0) {
      interval = setInterval(() => {
        setDiscussionTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isTimerRunning && discussionTimeLeft <= 0) {
      setIsTimerRunning(false);
      handleMoveToVoting();
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, discussionTimeLeft]);

  const startNewRound = () => {
    const randomImposter = session.players[Math.floor(Math.random() * session.players.length)];
    const randomWord = pickWord(category);
    
    const shuffled = [...session.players].sort(() => Math.random() - 0.5);
    setRoundPlayers(shuffled);

    setImposterId(randomImposter.id);
    setSecretWord(randomWord);
    
    setVotes({});
    setClues({});
    setCurrentClue('');
    setActivePlayerIndex(0);
    setIsRoleRevealed(false);
    setDiscussionTimeLeft(session.gameConfig?.discussionTime ?? 120);
    setIsTimerRunning(false);
    
    setPhase('reveal');
  };

  const handleRevealMyRole = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRoleRevealed(true);
  };

  const handleGotIt = () => {
    Haptics.selectionAsync();
    setIsRoleRevealed(false);
    if (activePlayerIndex + 1 < roundPlayers.length) {
      setActivePlayerIndex(prev => prev + 1);
    } else {
      setPhase('ready');
    }
  };

  const handleStartDiscussion = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (gameStyle === 'clue') {
      setActivePlayerIndex(0);
      setPhase('clueGiving');
    } else {
      setPhase('discussion');
      setIsTimerRunning(true);
    }
  };

  const handleSubmitClue = () => {
    if (!currentClue.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const playerId = roundPlayers[activePlayerIndex].id;
    const trimmed = currentClue.trim().substring(0, 30);
    setClues(prev => ({ ...prev, [playerId]: trimmed }));
    setCurrentClue('');

    if (activePlayerIndex + 1 < roundPlayers.length) {
      setActivePlayerIndex(prev => prev + 1);
    } else {
      handleMoveToVoting();
    }
  };

  const handleMoveToVoting = () => {
    setIsTimerRunning(false);
    setActivePlayerIndex(0);
    setSelectedSuspect(null);
    setPhase('voting');
  };

  const handleSubmitVote = () => {
    if (!selectedSuspect) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const currentPlayerId = roundPlayers[activePlayerIndex].id;
    setVotes(prev => ({ ...prev, [currentPlayerId]: selectedSuspect }));
    setSelectedSuspect(null);

    if (activePlayerIndex + 1 < roundPlayers.length) {
      setActivePlayerIndex(prev => prev + 1);
    } else {
      calculateScores();
      setPhase('results');
    }
  };

  const calculateScores = () => {
    // Count votes for each suspect
    const voteCounts: Record<string, number> = {};
    Object.values(votes).forEach(suspectId => {
      voteCounts[suspectId] = (voteCounts[suspectId] || 0) + 1;
    });

    // Find the suspect with the most votes
    let maxVotes = 0;
    let topSuspectId = '';
    Object.entries(voteCounts).forEach(([suspectId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        topSuspectId = suspectId;
      }
    });

    const imposterCaught = topSuspectId === imposterId;

    // Use functional update to avoid stale closure
    setScores(prev => {
      const newScores = { ...prev };
      if (imposterCaught) {
        Object.entries(votes).forEach(([voterId, suspectId]) => {
          if (suspectId === imposterId && voterId !== imposterId) {
            newScores[voterId] = (newScores[voterId] || 0) + 100;
          }
        });
      } else {
        newScores[imposterId] = (newScores[imposterId] || 0) + 150;
      }
      return newScores;
    });
  };

  const nextPhase = () => {
    Haptics.selectionAsync();
    if (phase === 'results') {
      setPhase('leaderboard');
    } else if (phase === 'leaderboard') {
      if (roundNumber >= totalRounds) {
        setPhase('finished');
      } else {
        setRoundNumber(prev => prev + 1);
        startNewRound();
      }
    }
  };

  const currentPlayer = roundPlayers[activePlayerIndex];

  return (
    <View style={styles.container}>
      {phase === 'reveal' && (
        <ScrollView contentContainerStyle={styles.centerContent}>
          <Text style={styles.title}>Pass the phone to</Text>
          <Text style={[styles.playerName, { color: getPlayerColor(session.players.findIndex(p => p.id === currentPlayer?.id)) }]}>
            {currentPlayer?.displayName}
          </Text>

          <View style={styles.card}>
            {!isRoleRevealed ? (
              <View style={styles.centerItems}>
                <IconSymbol name="eye.slash.fill" size={64} color="rgba(255,255,255,0.2)" />
                <Pressable style={[styles.primaryBtn, { marginTop: 30 }]} onPress={handleRevealMyRole}>
                  <Text style={styles.primaryBtnText}>Reveal My Role</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.centerItems}>
                {currentPlayer?.id === imposterId ? (
                  <>
                    <IconSymbol name="theatermasks.fill" size={64} color="#FF2D55" />
                    <Text style={[styles.roleTitle, { color: '#FF2D55' }]}>You are the Imposter!</Text>
                    <Text style={styles.roleSubtitle}>Blend in. Don&apos;t get caught.</Text>
                  </>
                ) : (
                  <>
                    <IconSymbol name="checkmark.shield.fill" size={64} color={Colors.green} />
                    <Text style={styles.roleSubtitle}>The secret word is:</Text>
                    <View style={styles.wordBadge}>
                      <Text style={styles.wordText}>{secretWord}</Text>
                    </View>
                  </>
                )}
                <Pressable style={[styles.primaryBtn, { marginTop: 30 }]} onPress={handleGotIt}>
                  <Text style={styles.primaryBtnText}>Got it</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {phase === 'ready' && (
        <ScrollView contentContainerStyle={styles.centerContent}>
          <IconSymbol name="person.3.fill" size={64} color="#007AFF" />
          <Text style={styles.title}>Everyone has seen their role</Text>
          <Text style={styles.subtitle}>
            {gameStyle === 'clue' ? 'Get ready to give clues!' : `Get ready for discussion!`}
          </Text>
          
          <Pressable style={[styles.primaryBtn, { marginTop: 40, paddingHorizontal: 60 }]} onPress={handleStartDiscussion}>
            <Text style={styles.primaryBtnText}>{gameStyle === 'clue' ? 'Start Clues' : 'Start Discussion'}</Text>
          </Pressable>
        </ScrollView>
      )}

      {phase === 'discussion' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.centerItems}>
              <Text style={[styles.timerText, discussionTimeLeft <= 10 && { color: '#FF2D55' }]}>
                {Math.floor(discussionTimeLeft / 60)}:{(discussionTimeLeft % 60).toString().padStart(2, '0')}
              </Text>
              <Text style={styles.subtitle}>seconds remaining</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Discuss!</Text>
            <Text style={styles.cardSubtitle}>Talk freely and figure out who the Imposter is.</Text>
            
            <View style={styles.playersList}>
              {session.players.map((p, i) => (
                <View key={p.id} style={styles.playerRow}>
                  <View style={[styles.avatarCircle, { backgroundColor: getPlayerColor(i) }]}>
                    <Text style={styles.avatarInitials}>{p.displayName.substring(0, 1).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.playerRowName}>{p.displayName}</Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable style={styles.secondaryBtn} onPress={handleMoveToVoting}>
            <Text style={styles.secondaryBtnText}>Skip to Voting</Text>
          </Pressable>
        </ScrollView>
      )}

      {phase === 'clueGiving' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.centerItems}>
              <IconSymbol name="magnifyingglass.circle.fill" size={48} color="#AF52DE" />
              <Text style={styles.title}>{currentPlayer?.displayName}&apos;s Clue</Text>
              <Text style={styles.subtitle}>Give a one-word clue about the secret word</Text>
            </View>

            <TextInput
              style={styles.clueInput}
              value={currentClue}
              onChangeText={t => setCurrentClue(t.substring(0, 30))}
              placeholder="Type your clue..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              maxLength={30}
              autoFocus
            />
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'right', marginTop: 4 }}>
              {currentClue.length}/30
            </Text>

            <Pressable
              style={[styles.primaryBtn, { marginTop: 20 }, !currentClue.trim() && { opacity: 0.5 }]}
              onPress={handleSubmitClue}
              disabled={!currentClue.trim()}
            >
              <Text style={styles.primaryBtnText}>Submit Clue</Text>
            </Pressable>
          </View>

          {Object.keys(clues).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Clues Given</Text>
              <View style={{ marginTop: 10, gap: 8 }}>
                {Object.entries(clues).map(([pid, clue]) => {
                  const player = session.players.find(p => p.id === pid);
                  const idx = session.players.findIndex(p => p.id === pid);
                  return (
                    <View key={pid} style={styles.resultRow}>
                      <Text style={[styles.resultName, { color: getPlayerColor(idx) }]}>{player?.displayName}</Text>
                      <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>&quot;{clue}&quot;</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {phase === 'voting' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.centerItems}>
              <IconSymbol name="hand.raised.fill" size={48} color="#FF2D55" />
              <Text style={styles.title}>{currentPlayer?.displayName}&apos;s Vote</Text>
              <Text style={styles.subtitle}>Who do you think is the Imposter?</Text>
            </View>
            
            <View style={{ marginTop: 20, gap: 10 }}>
              {session.players.filter(p => p.id !== currentPlayer.id).map((p, i) => (
                <Pressable 
                  key={p.id}
                  style={[styles.candidateBtn, selectedSuspect === p.id && styles.candidateBtnActive]}
                  onPress={() => setSelectedSuspect(p.id)}
                >
                  <Text style={[styles.candidateText, { color: getPlayerColor(session.players.findIndex(x => x.id === p.id)) }]}>{p.displayName}</Text>
                  {selectedSuspect === p.id && <IconSymbol name="checkmark.circle.fill" size={20} color="#007AFF" />}
                </Pressable>
              ))}
            </View>

            <Pressable 
              style={[styles.primaryBtn, { marginTop: 30 }, !selectedSuspect && { opacity: 0.5 }]} 
              onPress={handleSubmitVote}
              disabled={!selectedSuspect}
            >
              <Text style={styles.primaryBtnText}>Confirm Vote</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {phase === 'results' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {(() => {
            const voteCounts: Record<string, number> = {};
            Object.values(votes).forEach(sid => voteCounts[sid] = (voteCounts[sid] || 0) + 1);
            let maxVotes = 0; let topSuspectId = '';
            Object.entries(voteCounts).forEach(([sid, count]) => {
              if (count > maxVotes) { maxVotes = count; topSuspectId = sid; }
            });
            const imposterCaught = topSuspectId === imposterId;
            const imposterName = session.players.find(p => p.id === imposterId)?.displayName;

            return (
              <>
                <View style={styles.card}>
                  <View style={styles.centerItems}>
                    <IconSymbol name={imposterCaught ? "checkmark.circle.fill" : "xmark.circle.fill"} size={64} color={imposterCaught ? Colors.green : "#FF2D55"} />
                    <Text style={[styles.title, { color: imposterCaught ? Colors.green : "#FF2D55" }]}>
                      {imposterCaught ? "Imposter Caught!" : "Imposter Wins!"}
                    </Text>

                    <Text style={[styles.subtitle, { marginTop: 16 }]}>The Imposter was</Text>
                    <Text style={styles.roleTitle}>{imposterName}</Text>

                    <Text style={[styles.subtitle, { marginTop: 16 }]}>The secret word was</Text>
                    <View style={styles.wordBadge}>
                      <Text style={styles.wordText}>{secretWord}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Vote Results</Text>
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {session.players.map(p => {
                      const count = voteCounts[p.id] || 0;
                      return (
                        <View key={p.id} style={styles.resultRow}>
                          <Text style={[styles.resultName, { color: getPlayerColor(session.players.indexOf(p)) }]}>
                            {p.displayName} {p.id === imposterId ? '(Imposter)' : ''}
                          </Text>
                          <Text style={styles.resultCount}>{count} votes</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <Pressable style={styles.primaryBtn} onPress={nextPhase}>
                  <Text style={styles.primaryBtnText}>Continue</Text>
                </Pressable>
              </>
            );
          })()}
        </ScrollView>
      )}

      {phase === 'leaderboard' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.title, { marginBottom: 20 }]}>Leaderboard</Text>

          <View style={styles.card}>
            {session.players.slice().sort((a,b) => scores[b.id] - scores[a.id]).map((p, i) => (
              <View key={p.id} style={styles.leaderboardRow}>
                <Text style={[styles.rank, i === 0 && { color: Colors.yellow }]}>#{i + 1}</Text>
                <Text style={[styles.leaderboardName, { color: getPlayerColor(session.players.findIndex(x => x.id === p.id)) }]}>{p.displayName}</Text>
                <Text style={styles.scoreText}>{scores[p.id]} pts</Text>
              </View>
            ))}
          </View>

          <Pressable style={[styles.primaryBtn, { marginTop: 20 }]} onPress={nextPhase}>
            <Text style={styles.primaryBtnText}>{roundNumber >= totalRounds ? "Finish Game" : "Next Round"}</Text>
          </Pressable>
        </ScrollView>
      )}

      {phase === 'finished' && (
        <ScrollView contentContainerStyle={[styles.scrollContent, { alignItems: 'center' }]}>
          <IconSymbol name="trophy.fill" size={64} color={Colors.yellow} style={{ marginTop: 40 }} />
          <Text style={[styles.title, { marginTop: 20 }]}>Final Results</Text>

          <View style={[styles.card, { width: '100%', marginTop: 20 }]}>
            {session.players.slice().sort((a,b) => (scores[b.id] || 0) - (scores[a.id] || 0)).map((p, i) => (
              <View key={p.id} style={styles.leaderboardRow}>
                <Text style={[styles.rank, i === 0 && { color: Colors.yellow }]}>#{i + 1}</Text>
                <Text style={[styles.leaderboardName, { color: getPlayerColor(session.players.findIndex(x => x.id === p.id)) }]}>{p.displayName}</Text>
                <Text style={styles.scoreText}>{scores[p.id] || 0} pts</Text>
              </View>
            ))}
          </View>

          <Pressable style={[styles.primaryBtn, { marginTop: 20, width: '100%', backgroundColor: Colors.green }]} onPress={() => {
            setRoundNumber(1);
            setScores({});
            session.players.forEach(p => setScores(prev => ({ ...prev, [p.id]: 0 })));
            startNewRound();
          }}>
            <Text style={styles.primaryBtnText}>Play Again</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { paddingBottom: 40, paddingTop: 20 },
  centerContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 40 },
  centerItems: { alignItems: 'center', width: '100%' },
  
  title: { color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 16, textAlign: 'center' },
  playerName: { fontSize: 34, fontWeight: 'bold', marginBottom: 20 },
  
  card: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, width: '100%', marginBottom: 16 },
  cardTitle: { color: 'white', fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  cardSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 16 },
  
  primaryBtn: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 16, alignItems: 'center', width: '100%' },
  primaryBtnText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 16, borderRadius: 16, alignItems: 'center', width: '100%', marginTop: 10 },
  secondaryBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  
  roleTitle: { fontSize: 28, fontWeight: 'bold', marginTop: 16 },
  roleSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  wordBadge: { backgroundColor: 'rgba(52, 199, 89, 0.2)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 16 },
  wordText: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  
  timerText: { fontSize: 72, fontWeight: 'bold', color: 'white', fontFamily: 'monospace' },
  
  playersList: { gap: 12 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: 'white', fontWeight: 'bold' },
  playerRowName: { color: 'white', fontSize: 16, fontWeight: '600' },
  
  candidateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  candidateBtnActive: { borderColor: '#007AFF', backgroundColor: 'rgba(0,122,255,0.1)' },
  candidateText: { fontSize: 17, fontWeight: 'bold' },
  
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  resultName: { fontSize: 16, fontWeight: '600' },
  resultCount: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rank: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: 'bold', width: 30 },
  leaderboardName: { fontSize: 17, fontWeight: 'bold', flex: 1 },
  scoreText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  clueInput: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, color: 'white', fontSize: 17, marginTop: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }
});
