import { Colors } from '@/src/theme/Colors';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, PanResponder, PanResponderInstance } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import Svg, { Path } from 'react-native-svg';
import { AudioManager } from '@/src/services/AudioManager';
import { GamePassPhoneView, GameResultsScreen } from './SharedGameComponents';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import { PhaseTransition } from './PhaseTransition';

interface Props { session: GameSession; }
type Phase = 'ready' | 'reveal' | 'drawing' | 'guessing' | 'result' | 'results';

const DRAW_DURATION = 60;

const PRESET_CONCEPTS = [
  // English Proverbs & Idioms
  "Bite the bullet",
  "Spill the beans",
  "Don't cry over spilt milk",
  "Piece of cake",
  "Under the weather",
  "Cat got your tongue?",
  "Break a leg",
  "Once in a blue moon",
  "Barking up the wrong tree",
  "Cry wolf",
  "Kill two birds with one stone",
  "Curiosity killed the cat",
  "Burn the midnight oil",
  "Add fuel to the fire",
  "Blessing in disguise",
  "Skeleton in the closet",
  "A penny for your thoughts",
  "Let the cat out of the bag",
  "Hit the nail on the head",
  
  // Farsi Proverbs & Idioms
  "Dastet dard nakone (Thank you)",
  "Gozashteha gozashte (Let bygones be bygones)",
  "Ba yek gol bahar nemishavad (One flower doesn't make spring)",
  "Shotor didi nadidi (You saw nothing)",
  "Jaye shoma khali (Your place was empty)",
  "Del be del rah dare (Hearts have path to hearts)",
  "Abe pak rooye dast rikhtan (Pouring clean water on hand)",
  "Ba dobe shirdan bazi kardan (Playing with lion's tail)",
  "Koleh poshti ruye doush",
  "Davar-e bi tarafe bazi",
  
  // Situations & Common Phrases
  "Stuck in an elevator",
  "Singing in the shower",
  "Chased by a swarm of bees",
  "Eating a super sour lemon",
  "Stepping on a Lego block",
  "Winning a million dollar lottery",
  "Trying to catch a flight",
  "Proposing in a hot air balloon",
  "Waking up from a nightmare",
  "Walking on a tightrope",
  "Climbing a windy mountain",
  "Getting a bad haircut",
  "Sleeping during a boring lecture",
  "Fighting off a grizzly bear",
  "Cooking in a chaotic kitchen",
  "Dancing on a freezing iceberg",
  "Riding a wild mechanical bull",
  "Trapped inside a giant bubble",
  "Painting a portrait with toes",
  "Lost inside a spooky maze"
];

const BRUSH_COLORS: {name:string;hex:string}[] = [
  {name:'white',hex:'#fff'},
  {name:'red',hex:Colors.red},
  {name:'orange',hex:Colors.orange},
  {name:'yellow',hex:Colors.yellow},
  {name:'green',hex:Colors.green},
  {name:'blue',hex:'#007AFF'},
  {name:'purple',hex:'#AF52DE'},
  {name:'pink',hex:'#FF2D55'},
  {name:'black',hex:'#000'}
];

interface Stroke { color: string; width: number; points: {x:number;y:number}[]; }

function pickConcept(used: Set<string>): string {
  const avail = PRESET_CONCEPTS.filter(c => !used.has(c));
  const pool = avail.length > 0 ? avail : PRESET_CONCEPTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function DrawRushSession({ session }: Props) {
  const players = session.players;
  const registerSkip = useRegisterSkip();
  const conceptMode = session.gameConfig?.conceptMode || 'preset';
  const isFreeMode = conceptMode !== 'preset';

  const [phase, setPhase] = useState<Phase>('ready');
  const [playerIdx, setPlayerIdx] = useState(0);
  const [concept, setConcept] = useState('');
  const [usedConcepts, setUsedConcepts] = useState<Set<string>>(new Set());
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [brushColor, setBrushColor] = useState('#fff');
  const [brushWidth] = useState(6);
  const [timeLeft, setTimeLeft] = useState(DRAW_DURATION);
  const [lastResult, setLastResult] = useState<'success' | 'fail' | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 500 });
  const [round, setRound] = useState(1);

  // Score tracking per player
  const [records, setRecords] = useState<{ playerId: string; score: number }[]>(() =>
    players.map(p => ({ playerId: p.id, score: 0 }))
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Brush setup
  const brushColorRef = useRef(brushColor);
  useEffect(() => { brushColorRef.current = brushColor; }, [brushColor]);
  
  const brushWidthRef = useRef(brushWidth);
  useEffect(() => { brushWidthRef.current = brushWidth; }, [brushWidth]);

  const currentStrokeRef = useRef<Stroke | null>(null);

  const panResponder = useRef<PanResponderInstance>(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (locationX != null && locationY != null && !isNaN(locationX) && !isNaN(locationY)) {
          const newStroke = { color: brushColorRef.current, width: brushWidthRef.current, points: [{ x: locationX, y: locationY }] };
          currentStrokeRef.current = newStroke;
          setCurrentStroke(newStroke);
        }
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (locationX != null && locationY != null && !isNaN(locationX) && !isNaN(locationY) && currentStrokeRef.current) {
          currentStrokeRef.current.points.push({ x: locationX, y: locationY });
          setCurrentStroke({ ...currentStrokeRef.current });
        }
      },
      onPanResponderRelease: () => {
        if (currentStrokeRef.current) {
          const finishedStroke = currentStrokeRef.current;
          setStrokes(prev => [...prev, finishedStroke]);
          currentStrokeRef.current = null;
          setCurrentStroke(null);
        }
      },
      onPanResponderTerminate: () => {
        if (currentStrokeRef.current) {
          currentStrokeRef.current = null;
          setCurrentStroke(null);
        }
      }
    })
  ).current;

  const setupNewTurn = () => {
    if (!isFreeMode) {
      const c = pickConcept(usedConcepts);
      setConcept(c);
      setUsedConcepts(prev => new Set(prev).add(c));
    } else {
      setConcept('');
    }
    setStrokes([]);
    setCurrentStroke(null);
    setLastResult(null);
    setPhase('ready');
  };

  useEffect(() => {
    setupNewTurn();
  }, []);

  // Register skip handler during all turn phases
  useEffect(() => {
    if (phase === 'reveal' || phase === 'drawing' || phase === 'guessing' || phase === 'result') {
      registerSkip(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        const totalTurns = players.length * 2;
        if (round >= totalTurns) {
          AudioManager.play('gameOver');
          setPhase('results');
        } else {
          setRound(r => r + 1);
          setPlayerIdx(prev => (prev + 1) % players.length);
          setupNewTurn();
        }
      }, players[playerIdx]?.displayName);
    } else {
      registerSkip(null);
    }
    return () => registerSkip(null);
  }, [phase, playerIdx, round]);

  useEffect(() => {
    if (phase === 'drawing' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 4 && t > 1) { AudioManager.play('countdown'); }
          if (t <= 1) { 
            clearInterval(timerRef.current!); 
            AudioManager.play('countdownFinal'); 
            handleDoneDrawing();
            return 0; 
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const strokeToPath = (s: Stroke): string => {
    if (s.points.length === 0) return '';
    if (s.points.length === 1) return `M${s.points[0].x},${s.points[0].y} L${s.points[0].x+0.1},${s.points[0].y+0.1}`;
    return s.points.map((p,i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ');
  };

  const handleStartDrawing = () => { 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
    AudioManager.play('buttonTap'); 
    setTimeLeft(DRAW_DURATION); 
    setStrokes([]); 
    setPhase('drawing'); 
  };

  const handleDoneDrawing = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('guessing');
  };

  // Opponent guessed correctly
  const handleGuessCorrect = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    AudioManager.play('success');
    
    // Add point to the drawer
    const drawerId = players[playerIdx].id;
    setRecords(prev => prev.map(r => r.playerId === drawerId ? { ...r, score: r.score + 1 } : r));
    
    setLastResult('success');
    setPhase('result');
  };

  // Opponent didn't guess / wrong
  const handleGuessWrong = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    AudioManager.play('fail');
    setLastResult('fail');
    setPhase('result');
  };

  const handleNextRound = () => {
    const totalTurns = players.length * 2;
    if (round >= totalTurns) {
      AudioManager.play('gameOver');
      setPhase('results');
    } else {
      setRound(r => r + 1);
      setPlayerIdx(prev => (prev + 1) % players.length);
      setupNewTurn();
    }
  };

  const playAgain = () => {
    AudioManager.play('buttonTap');
    setRecords(players.map(p => ({ playerId: p.id, score: 0 })));
    setPlayerIdx(0);
    setRound(1);
    setUsedConcepts(new Set());
    setupNewTurn();
  };

  // ─── READY (PASS PHONE TO DRAWER) ───
  if (phase === 'ready') {
    const currentPlayerName = players[playerIdx]?.displayName ?? 'Player';
    return (
      <PhaseTransition phaseKey={`ready-${playerIdx}-${round}`} style={{ flex: 1 }}>
        <GamePassPhoneView
          playerName={currentPlayerName}
          title="Pass the Phone to"
          subtitle="You will draw a concept. Keep the screen private!"
          accentColor={Colors.orange}
          onReady={() => setPhase('reveal')}
          onSkip={() => {
            // Score stays 0 for this player (no point added)
            const totalTurns = players.length * 2;
            if (round >= totalTurns) {
              AudioManager.play('gameOver');
              setPhase('results');
            } else {
              setRound(r => r + 1);
              setPlayerIdx(prev => (prev + 1) % players.length);
              setupNewTurn();
            }
          }}
        />
      </PhaseTransition>
    );
  }

  // ─── REVEAL (SECRET CONCEPT FOR DRAWER) ───
  if (phase === 'reveal') {
    const currentPlayerName = players[playerIdx]?.displayName ?? 'Player';
    return (
      <PhaseTransition phaseKey={`reveal-${playerIdx}`} style={{ flex: 1 }}>
        <View style={st.center}>
          <View style={st.freeReadyCenter}>
            <View style={st.freeIconWrap}>
              <IconSymbol name="pencil.and.scribble" size={56} color={Colors.orange} />
            </View>
            <Text style={st.freeTitle}>{currentPlayerName}'s Turn</Text>
            
            {isFreeMode ? (
              <>
                <Text style={st.freeSub}>You are in Free Draw mode!{'\n'}Draw whatever you want. Opponents will guess.</Text>
              </>
            ) : (
              <>
                <Text style={st.freeSub}>Your Secret Phrase is:</Text>
                <View style={st.conceptRevealBox}>
                  <Text style={st.conceptRevealText}>{concept}</Text>
                </View>
                <Text style={st.helperRevealTx}>Do not show anyone else!</Text>
              </>
            )}

            <Pressable style={st.btn} onPress={handleStartDrawing}>
              <Text style={st.btnTx}>Start Drawing</Text>
            </Pressable>
          </View>
        </View>
      </PhaseTransition>
    );
  }

  // ─── DRAWING ───
  if (phase === 'drawing') {
    return (
      <PhaseTransition phaseKey={phase} style={st.container}>
        <View style={st.drawHeaderOverlay}>
          <View style={st.timerPill}>
            <IconSymbol name="timer" size={14} color={timeLeft <= 10 ? Colors.red : '#fff'} />
            <Text style={[st.timerTx, timeLeft <= 10 && {color:Colors.red}]}>{timeLeft}s</Text>
          </View>
          {!isFreeMode && (
            <View style={st.conceptPill}>
              <Text style={st.conceptPillTx}>{concept}</Text>
            </View>
          )}
        </View>

        {/* Fullscreen Canvas */}
        <View style={st.canvasContainer}>
          <View 
            style={st.canvas}
            {...panResponder.panHandlers}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) setCanvasSize({ width, height });
            }}
          >
            <Svg width="100%" height="100%">
              {strokes.map((s,i) => s.points.length > 0 ? <Path key={i} d={strokeToPath(s)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null)}
              {currentStroke && currentStroke.points.length > 0 && <Path d={strokeToPath(currentStroke)} stroke={currentStroke.color} strokeWidth={currentStroke.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            </Svg>
          </View>
        </View>

        {/* Tools and Colors Overlay at Bottom */}
        <View style={st.toolsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.colorsScroll}>
            {BRUSH_COLORS.map(c => (
              <Pressable key={c.name} onPress={() => setBrushColor(c.hex)}
                style={[st.colorDot,{backgroundColor:c.hex},brushColor===c.hex&&st.colorDotSel]} />
            ))}
          </ScrollView>

          <View style={st.toolsActions}>
            <Pressable style={st.toolBtn} onPress={() => setStrokes(prev => prev.slice(0,-1))}><IconSymbol name="arrow.uturn.backward" size={18} color="#fff" /></Pressable>
            <Pressable style={st.toolBtn} onPress={() => setStrokes([])}><IconSymbol name="trash" size={18} color={Colors.red} /></Pressable>
            <Pressable style={[st.actionBtn,{backgroundColor:'rgba(52,199,89,0.9)'}]} onPress={handleDoneDrawing}>
              <Text style={[st.toolTx,{color:'#fff'}]}>Done ✓</Text>
            </Pressable>
          </View>
        </View>

      </PhaseTransition>
    );
  }

  // ─── GUESSING PHASE ───
  if (phase === 'guessing') {
    const drawerName = players[playerIdx]?.displayName ?? 'Player';
    const guessers = players.filter((_, i) => i !== playerIdx);
    const guesserNames = guessers.map(p => p.displayName).join(' & ');

    return (
      <PhaseTransition phaseKey={`guessing-${round}`} style={st.container}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}>
          <Text style={st.guessTitle}>Show to {guesserNames}!</Text>
          <Text style={st.guessSub}>
            {drawerName} drew this. Let {guesserNames} look and guess what it is.
          </Text>

          {/* Drawing — fills available space */}
          <View style={{ flex: 1, marginVertical: 12, borderRadius: 20, overflow: 'hidden', maxHeight: '55%' }}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} preserveAspectRatio="xMidYMid meet" style={{backgroundColor:'#1C1C1E', borderRadius: 20}}>
              {strokes.map((s,i) => s.points.length > 0 ? <Path key={i} d={strokeToPath(s)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null)}
            </Svg>
          </View>

          <Text style={st.guessQuestion}>Did {guesserNames} guess correctly?</Text>

          <View style={st.guessButtons}>
            <Pressable style={[st.guessBtn, { backgroundColor: 'rgba(52,199,89,0.15)', borderColor: 'rgba(52,199,89,0.4)' }]} onPress={handleGuessCorrect}>
              <IconSymbol name="checkmark.circle.fill" size={28} color={Colors.green} />
              <Text style={[st.guessBtnTx, { color: Colors.green }]}>Yes!</Text>
            </Pressable>
            <Pressable style={[st.guessBtn, { backgroundColor: 'rgba(255,59,48,0.15)', borderColor: 'rgba(255,59,48,0.4)' }]} onPress={handleGuessWrong}>
              <IconSymbol name="xmark.circle.fill" size={28} color={Colors.red} />
              <Text style={[st.guessBtnTx, { color: Colors.red }]}>No</Text>
            </Pressable>
          </View>
        </View>
      </PhaseTransition>
    );
  }

  // ─── TURN RESULT ───
  if (phase === 'result') {
    const isSuccess = lastResult === 'success';
    const totalTurns = players.length * 2;
    const isGameFinished = round >= totalTurns;
    
    return (
      <PhaseTransition phaseKey={`result-${round}`} style={st.container}>
        <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
          <IconSymbol name={isSuccess ? "star.fill" : "xmark.circle.fill"} size={52} color={isSuccess ? Colors.yellow : Colors.red} />
          <Text style={st.title}>{isSuccess ? 'Correct Guess!' : 'Not Guessed'}</Text>
          
          {!isFreeMode && (
            <Text style={st.sub}>The word was: <Text style={{color: Colors.yellow, fontWeight: 'bold'}}>{concept}</Text></Text>
          )}

          {/* Scoreboard block */}
          <View style={st.roundScoreboard}>
            <Text style={st.scoreboardTitle}>Current Scores</Text>
            {players.map(p => {
              const rec = records.find(r => r.playerId === p.id);
              const isCurrentDrawer = p.id === players[playerIdx].id;
              return (
                <View key={p.id} style={[st.scoreboardRow, isCurrentDrawer && { borderColor: `${Colors.orange}55`, backgroundColor: 'rgba(255,149,0,0.05)' }]}>
                  <Text style={[st.scoreboardName, isCurrentDrawer && { color: Colors.orange }]}>
                    {p.displayName} {isCurrentDrawer && '(Drawer)'}
                  </Text>
                  <Text style={st.scoreboardVal}>{rec?.score ?? 0} pts</Text>
                </View>
              );
            })}
          </View>

          {/* Show drawing snapshot */}
          <View style={[st.snapshotCanvas, { aspectRatio: canvasSize.width / canvasSize.height, maxHeight: 300 }]}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} preserveAspectRatio="xMidYMid meet" style={{backgroundColor:'#1C1C1E', borderRadius:16}}>
              {strokes.map((s,i) => s.points.length > 0 ? <Path key={i} d={strokeToPath(s)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null)}
            </Svg>
          </View>

          <Pressable style={st.btn} onPress={handleNextRound}>
            <Text style={st.btnTx}>{isGameFinished ? 'View Final Results' : 'Next Turn'}</Text>
          </Pressable>
        </ScrollView>
      </PhaseTransition>
    );
  }

  // ─── FINAL RANKINGS ───
  if (phase === 'results') {
    const resultsData = records.map(r => ({
      playerId: r.playerId,
      score: r.score,
      stats: [
        { label: 'Drawings Guessed', value: r.score, color: Colors.green }
      ]
    }));

    return (
      <GameResultsScreen
        players={players}
        results={resultsData}
        onPlayAgain={playAgain}
        title="Draw Rush Results"
      />
    );
  }

  return null;
}

const st = StyleSheet.create({
  container:{flex:1,backgroundColor:'#000'},
  center:{flex:1,justifyContent:'center',alignItems:'center',padding:24,backgroundColor:'#000'},
  title:{color:'#fff',fontSize: 28,fontFamily:'Viral-Black', marginTop: 16, textAlign: 'center'},
  sub:{color:'rgba(255,255,255,0.5)',fontSize:16,marginTop:12,textAlign:'center',lineHeight:22},
  btn:{backgroundColor:'#007AFF',paddingVertical:18,borderRadius:20,width:'100%',alignItems:'center',marginTop:32},
  btnTx:{color:'#fff',fontSize: 18,fontWeight:'bold'},
  
  // Free draw ready screen
  freeReadyCenter: { alignItems: 'center', width: '100%' },
  freeIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,149,0,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,149,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  freeTitle: { color: '#fff', fontSize: 32, fontFamily: 'Viral-Black', textAlign: 'center' },
  freeSub: { color: 'rgba(255,255,255,0.6)', fontSize: 16, textAlign: 'center', marginTop: 10, lineHeight: 24, paddingHorizontal: 12 },
  conceptRevealBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    marginVertical: 24,
    width: '90%',
    alignItems: 'center',
  },
  conceptRevealText: {
    color: Colors.orange,
    fontSize: 24,
    fontFamily: 'Viral-Black',
    textAlign: 'center',
  },
  helperRevealTx: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  canvasContainer: {flex: 1, backgroundColor: '#1C1C1E'},
  canvas:{flex: 1},
  
  drawHeaderOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
    pointerEvents: 'none'
  },
  timerPill:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'rgba(0,0,0,0.6)',paddingHorizontal:16,paddingVertical:10,borderRadius:24},
  timerTx:{color:'#fff',fontSize:28,fontFamily:'Viral-Black',fontVariant:['tabular-nums']},
  conceptPill:{backgroundColor:'rgba(0,0,0,0.6)',paddingHorizontal:16,paddingVertical:10,borderRadius:24},
  conceptPillTx:{color:'#fff',fontSize:18,fontFamily:'Viral-Black'},
  
  toolsWrapper: { 
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(28,28,30,0.85)', 
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  colorsScroll: {paddingHorizontal:16, alignItems: 'center', gap: 12, paddingBottom: 12},
  colorDot:{width:48,height:48,borderRadius:24,borderWidth:2,borderColor:'transparent'},
  colorDotSel:{borderColor:'#fff',transform:[{scale:1.2}]},
  
  toolsActions: {flexDirection:'row',gap:12,paddingHorizontal:16},
  toolBtn:{alignItems:'center',justifyContent:'center',width:56,height:56,borderRadius:16,backgroundColor:'rgba(255,255,255,0.1)'},
  actionBtn:{flex:1,alignItems:'center',justifyContent:'center',height:56,borderRadius:16},
  toolTx:{fontSize:16,fontFamily:'Viral-Black'},
  
  snapshotCanvas: { width: '100%', marginTop: 20, borderRadius: 24, overflow: 'hidden' },

  // Guessing phase
  guessTitle: { color: '#fff', fontSize: 26, fontFamily: 'Viral-Black', textAlign: 'center', marginBottom: 8 },
  guessSub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  guessQuestion: { color: '#fff', fontSize: 18, fontFamily: 'Viral-Black', marginTop: 20, textAlign: 'center' },
  guessButtons: { flexDirection: 'row', gap: 14, marginTop: 16, width: '100%' },
  guessBtn: {
    flex: 1, paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, gap: 6,
  },
  guessBtnTx: { fontSize: 17, fontWeight: 'bold' },

  // Scoreboard inside result
  roundScoreboard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginTop: 20,
    gap: 8,
  },
  scoreboardTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  scoreboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scoreboardName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreboardVal: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Viral-Black',
  }
});
