import { Colors } from '@/src/theme/Colors';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, TextInput, PanResponder, GestureResponderEvent } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import Svg, { Path } from 'react-native-svg';
import { AudioManager } from '@/src/services/AudioManager';

interface Props { session: GameSession; }
type Phase = 'turnIntro' | 'drawerReveal' | 'drawing' | 'passForGuesses' | 'guessing' | 'drawerJudging' | 'roundResults' | 'finalLeaderboard';

const DRAW_DURATION = 60;
const CONCEPTS = ["Pizza","Elephant","Guitar","Rainbow","Rocket","Banana","Volcano","Sunflower","Penguin","Ice Cream","Dragon","Castle","Camera","Robot","Sandwich","Lighthouse","Octopus","Tornado","Cactus","Basketball","Skateboard","Helicopter","Pirate","Ninja","Mermaid","Alien","Sunglasses","Donut","Umbrella","Clock","Spider","Keyboard","Dinosaur","Astronaut","Snowman","Cupcake","Butterfly","Mountain","Windmill","Telescope","Hamburger","Jellyfish","Lightning","Giraffe","Campfire","Bicycle","Kite","Scarecrow","Anchor","Compass","Treasure Chest","Magic Wand","Crown","Trophy","Pencil","Waterfall","Dragonfly","Cowboy","Wizard","Tiger","Submarine","Eiffel Tower","Pyramid","Popcorn","Watermelon","Backpack","Mushroom","Owl","Vampire","Zombie","Ghost","UFO","Island","Lemon","Strawberry","Toaster","Trumpet","Piano","Drum"];
const BRUSH_COLORS: {name:string;hex:string}[] = [{name:'white',hex:'#fff'},{name:'red',hex:Colors.red},{name:'orange',hex:Colors.orange},{name:'yellow',hex:Colors.yellow},{name:'green',hex:Colors.green},{name:'blue',hex:'#007AFF'},{name:'purple',hex:'#AF52DE'},{name:'pink',hex:'#FF2D55'},{name:'black',hex:'#000'}];

interface Stroke { color: string; width: number; points: {x:number;y:number}[]; }
interface Answer { id: string; playerId: string; playerName: string; text: string; isCorrect: boolean; isJudged: boolean; }

function pickConcept(used: Set<string>): string {
  const avail = CONCEPTS.filter(c => !used.has(c));
  const pool = avail.length > 0 ? avail : CONCEPTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function DrawRushSession({ session }: Props) {
  const players = session.players;
  const [phase, setPhase] = useState<Phase>('turnIntro');
  const [drawerIdx, setDrawerIdx] = useState(0);
  const [concept, setConcept] = useState('');
  const [usedConcepts, setUsedConcepts] = useState<Set<string>>(new Set());
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [brushColor, setBrushColor] = useState('#fff');
  const [brushWidth] = useState(4);
  const [timeLeft, setTimeLeft] = useState(DRAW_DURATION);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [guessIdx, setGuessIdx] = useState(0);
  const [guessText, setGuessText] = useState('');
  const [scores, setScores] = useState<Record<string,number>>(() => {
    const s: Record<string,number> = {}; players.forEach(p => s[p.id] = 0); return s;
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<View>(null);
  const canvasLayout = useRef({x:0,y:0,w:0,h:0});

  const drawer = players[drawerIdx];
  const guessers = players.filter((_,i) => i !== drawerIdx);
  const currentGuesser = guessers[guessIdx];

  const conceptMode = session.gameConfig?.conceptMode || 'preset';

  useEffect(() => {
    if (conceptMode === 'preset') {
      const c = pickConcept(usedConcepts);
      setConcept(c);
      setUsedConcepts(prev => new Set(prev).add(c));
    } else {
      setConcept(''); // freeDraw: drawer picks their own
    }
  }, [drawerIdx]);

  useEffect(() => {
    if (phase === 'drawing' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 4 && t > 1) { AudioManager.play('countdown'); }
          if (t <= 1) { clearInterval(timerRef.current!); AudioManager.play('countdownFinal'); setPhase('passForGuesses'); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const strokeToPath = (s: Stroke): string => {
    if (s.points.length === 0) return '';
    return s.points.map((p,i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ');
  };

  const brushColorRef = useRef(brushColor);
  brushColorRef.current = brushColor;
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const currentStrokeRef = useRef(currentStroke);
  currentStrokeRef.current = currentStroke;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const {locationX, locationY} = e.nativeEvent;
      const newStroke: Stroke = {color: brushColorRef.current, width: 4, points: [{x:locationX, y:locationY}]};
      currentStrokeRef.current = newStroke;
      setCurrentStroke(newStroke);
    },
    onPanResponderMove: (e) => {
      const {locationX, locationY} = e.nativeEvent;
      if (currentStrokeRef.current) {
        const updated = {...currentStrokeRef.current, points: [...currentStrokeRef.current.points, {x:locationX, y:locationY}]};
        currentStrokeRef.current = updated;
        setCurrentStroke(updated);
      }
    },
    onPanResponderRelease: () => {
      if (currentStrokeRef.current) {
        setStrokes(prev => [...prev, currentStrokeRef.current!]);
        currentStrokeRef.current = null;
        setCurrentStroke(null);
      }
    },
  })).current;

  const handleStartDrawing = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); AudioManager.play('buttonTap'); setTimeLeft(DRAW_DURATION); setStrokes([]); setPhase('drawing'); };
  const handleFinishEarly = () => { if (timerRef.current) clearInterval(timerRef.current); AudioManager.play('buttonTap'); setPhase('passForGuesses'); };
  const handleStartGuessing = () => { AudioManager.play('phaseChange'); setGuessIdx(0); setAnswers([]); setGuessText(''); setPhase('guessing'); };

  const handleSubmitGuess = () => {
    const t = guessText.trim();
    if (!t || !currentGuesser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AudioManager.play('buttonTap');
    setAnswers(prev => [...prev, { id: `${Date.now()}`, playerId: currentGuesser.id, playerName: currentGuesser.displayName, text: t, isCorrect: false, isJudged: false }]);
    setGuessText('');
    if (guessIdx + 1 >= guessers.length) { AudioManager.play('phaseChange'); setPhase('drawerJudging'); }
    else setGuessIdx(guessIdx + 1);
  };

  const handleJudge = (id: string, correct: boolean) => {
    Haptics.selectionAsync();
    AudioManager.play('buttonTap');
    setAnswers(prev => prev.map(a => a.id === id ? {...a, isCorrect: correct, isJudged: true} : a));
  };

  const handleFinalizeJudge = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    AudioManager.play('success');
    const newScores = {...scores};
    answers.filter(a => a.isCorrect).forEach(a => { newScores[a.playerId] = (newScores[a.playerId] || 0) + 10; });
    setScores(newScores);
    setPhase('roundResults');
  };

  const handleNextTurn = () => {
    if (drawerIdx + 1 >= players.length) { AudioManager.play('gameOver'); setPhase('finalLeaderboard'); return; }
    AudioManager.play('phaseChange');
    setDrawerIdx(drawerIdx + 1);
    setPhase('turnIntro');
  };

  const sw = Dimensions.get('window').width;
  const canvasSize = sw - 32;
  const sorted = [...players].sort((a,b) => (scores[b.id]||0) - (scores[a.id]||0));
  const allJudged = answers.length > 0 && answers.every(a => a.isJudged);

  // ═══ TURN INTRO ═══
  if (phase === 'turnIntro') {
    return (
      <View style={st.container}><View style={st.center}>
        <View style={[st.iconBox,{backgroundColor:'rgba(0,122,255,0.14)'}]}><IconSymbol name="pencil.and.scribble" size={52} color="#007AFF" /></View>
        <Text style={st.title}>Round {drawerIdx+1} of {players.length}</Text>
        <Text style={[st.sub,{fontSize:22,color:'#007AFF',fontWeight:'bold',marginTop:12}]}>{drawer.displayName} draws!</Text>
        <Text style={st.hint}>Everyone else will guess what&apos;s being drawn. 60s per turn.</Text>
        <Pressable style={st.btn} onPress={() => setPhase('drawerReveal')}><Text style={st.btnTx}>Continue</Text></Pressable>
      </View></View>
    );
  }

  // ═══ DRAWER REVEAL ═══
  if (phase === 'drawerReveal') {
    return (
      <View style={st.container}><View style={st.center}>
        <IconSymbol name="eye.slash.fill" size={40} color={Colors.orange} />
        <Text style={st.title}>{conceptMode === 'preset' ? 'Your Word' : 'Free Draw'}</Text>
        <View style={st.conceptCard}>
          <Text style={st.conceptTx}>{conceptMode === 'preset' ? concept : 'Draw anything!'}</Text>
        </View>
        <Text style={st.hint}>{conceptMode === 'preset' ? `Only ${drawer.displayName} should see this!` : `${drawer.displayName}, think of something and draw it!`}</Text>
        <Pressable style={st.btn} onPress={handleStartDrawing}><Text style={st.btnTx}>Start Drawing</Text></Pressable>
      </View></View>
    );
  }

  // ═══ DRAWING ═══
  if (phase === 'drawing') {
    return (
      <View style={st.container}>
        <View style={st.drawHeader}>
          <Text style={st.drawTitle}>{drawer.displayName} is drawing</Text>
          <View style={st.timerPill}><IconSymbol name="timer" size={14} color={timeLeft<=10?Colors.red:'#5AC8FA'} />
            <Text style={[st.timerTx,timeLeft<=10&&{color:Colors.red}]}>{timeLeft}s</Text>
          </View>
        </View>
        <View style={[st.canvas,{width:canvasSize,height:canvasSize}]} {...panResponder.panHandlers}>
          <Svg width={canvasSize} height={canvasSize} style={{backgroundColor:'#1C1C1E',borderRadius:16}}>
            {strokes.map((s,i) => <Path key={i} d={strokeToPath(s)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
            {currentStroke && <Path d={strokeToPath(currentStroke)} stroke={currentStroke.color} strokeWidth={currentStroke.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          </Svg>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:8,maxHeight:44,paddingHorizontal:16}}>
          <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
            {BRUSH_COLORS.map(c => (
              <Pressable key={c.name} onPress={() => setBrushColor(c.hex)}
                style={[st.colorDot,{backgroundColor:c.hex},brushColor===c.hex&&st.colorDotSel]} />
            ))}
          </View>
        </ScrollView>
        <View style={{flexDirection:'row',gap:12,paddingHorizontal:16,marginTop:8}}>
          <Pressable style={st.toolBtn} onPress={() => setStrokes(prev => prev.slice(0,-1))}><IconSymbol name="arrow.uturn.backward" size={18} color="#fff" /><Text style={st.toolTx}>Undo</Text></Pressable>
          <Pressable style={st.toolBtn} onPress={() => setStrokes([])}><IconSymbol name="trash" size={18} color={Colors.red} /><Text style={[st.toolTx,{color:Colors.red}]}>Clear</Text></Pressable>
          <Pressable style={[st.toolBtn,{flex:1,backgroundColor:'rgba(52,199,89,0.15)'}]} onPress={handleFinishEarly}><Text style={[st.toolTx,{color:Colors.green}]}>Done Early</Text></Pressable>
        </View>
      </View>
    );
  }

  // ═══ PASS FOR GUESSES ═══
  if (phase === 'passForGuesses') {
    return (
      <View style={st.container}><View style={st.center}>
        <IconSymbol name="hand.raised.fill" size={52} color={Colors.orange} />
        <Text style={st.title}>Time&apos;s Up!</Text>
        <Text style={st.sub}>Pass the phone to the guessers.</Text>
        <Text style={st.hint}>Each player will type their guess one at a time.</Text>
        <Pressable style={st.btn} onPress={handleStartGuessing}><Text style={st.btnTx}>Start Guessing</Text></Pressable>
      </View></View>
    );
  }

  // ═══ GUESSING ═══
  if (phase === 'guessing') {
    return (
      <View style={st.container}>
        <View style={{padding:16,flex:1}}>
          <Text style={st.title}>{currentGuesser?.displayName}&apos;s Guess</Text>
          <Text style={[st.sub,{marginBottom:16}]}>Look at the drawing and type your answer</Text>
          <View style={[st.canvas,{width:canvasSize,height:canvasSize*0.6}]}>
            <Svg width={canvasSize} height={canvasSize*0.6} style={{backgroundColor:'#1C1C1E',borderRadius:16}}>
              {strokes.map((s,i) => <Path key={i} d={strokeToPath(s)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
            </Svg>
          </View>
          <TextInput style={st.guessInput} placeholder="Type your guess..." placeholderTextColor="rgba(255,255,255,0.3)" value={guessText} onChangeText={setGuessText} autoFocus returnKeyType="done" onSubmitEditing={handleSubmitGuess} />
          <Pressable style={[st.btn,{marginTop:16}]} onPress={handleSubmitGuess} disabled={!guessText.trim()}><Text style={st.btnTx}>Submit</Text></Pressable>
        </View>
      </View>
    );
  }

  // ═══ DRAWER JUDGING ═══
  if (phase === 'drawerJudging') {
    return (
      <View style={st.container}>
        <ScrollView contentContainerStyle={{padding:16,paddingBottom:40}}>
          <Text style={[st.title,{textAlign:'center'}]}>{drawer.displayName}, Judge the Answers</Text>
          <Text style={[st.sub,{textAlign:'center',marginBottom:4}]}>The word was: <Text style={{color:Colors.yellow,fontWeight:'bold'}}>{concept}</Text></Text>
          <Text style={[st.sub,{textAlign:'center',marginBottom:20}]}>Mark each guess as correct or wrong</Text>
          {answers.map(a => (
            <View key={a.id} style={[st.judgeRow,a.isJudged&&(a.isCorrect?st.judgeOk:st.judgeWrong)]}>
              <View style={{flex:1}}>
                <Text style={st.judgeName}>{a.playerName}</Text>
                <Text style={st.judgeAnswer}>{a.text}</Text>
              </View>
              {!a.isJudged ? (
                <View style={{flexDirection:'row',gap:8}}>
                  <Pressable style={[st.judgeBtn,{backgroundColor:'rgba(52,199,89,0.2)'}]} onPress={() => handleJudge(a.id,true)}><IconSymbol name="checkmark" size={18} color={Colors.green} /></Pressable>
                  <Pressable style={[st.judgeBtn,{backgroundColor:'rgba(255,59,48,0.2)'}]} onPress={() => handleJudge(a.id,false)}><IconSymbol name="xmark" size={18} color={Colors.red} /></Pressable>
                </View>
              ) : (
                <IconSymbol name={a.isCorrect?"checkmark.circle.fill":"xmark.circle.fill"} size={24} color={a.isCorrect?Colors.green:Colors.red} />
              )}
            </View>
          ))}
          <Pressable style={[st.btn,{marginTop:24},!allJudged&&{opacity:0.4}]} onPress={handleFinalizeJudge} disabled={!allJudged}><Text style={st.btnTx}>Continue</Text></Pressable>
        </ScrollView>
      </View>
    );
  }

  // ═══ ROUND RESULTS ═══
  if (phase === 'roundResults') {
    const correct = answers.filter(a => a.isCorrect).length;
    return (
      <View style={st.container}>
        <ScrollView contentContainerStyle={{padding:16,paddingBottom:40}}>
          <Text style={[st.title,{textAlign:'center'}]}>Round Results</Text>
          <Text style={[st.sub,{textAlign:'center'}]}>The word was &quot;{concept}&quot; — {correct}/{answers.length} correct</Text>
          {sorted.map((p,i) => (
            <View key={p.id} style={[st.rankRow,i===0&&st.rankFirst]}>
              <Text style={st.rankNum}>{i+1}</Text>
              <Text style={st.rankName}>{p.displayName}</Text>
              <Text style={st.rankScore}>{scores[p.id]||0}</Text>
            </View>
          ))}
          <Pressable style={[st.btn,{marginTop:24}]} onPress={handleNextTurn}>
            <Text style={st.btnTx}>{drawerIdx+1>=players.length?'Final Results':'Next Round'}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ═══ FINAL LEADERBOARD ═══
  const handlePlayAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDrawerIdx(0);
    setStrokes([]);
    setCurrentStroke(null);
    setAnswers([]);
    setUsedConcepts(new Set());
    setScores(() => { const s: Record<string,number> = {}; players.forEach(p => s[p.id] = 0); return s; });
    setPhase('turnIntro');
  };

  return (
    <View style={st.container}>
      <ScrollView contentContainerStyle={{padding:16,paddingBottom:40}}>
        <View style={{alignItems:'center',gap:8,marginVertical:20}}>
          <IconSymbol name="trophy.fill" size={44} color={Colors.yellow} />
          <Text style={st.title}>Final Results</Text>
        </View>
        {sorted.map((p,i) => (
          <View key={p.id} style={[st.rankRow,i===0&&st.rankFirst]}>
            <Text style={st.rankNum}>{['🥇','🥈','🥉'][i]||`#${i+1}`}</Text>
            <Text style={st.rankName}>{p.displayName}</Text>
            <Text style={st.rankScore}>{scores[p.id]||0} pts</Text>
          </View>
        ))}
        <Pressable style={[st.btn,{marginTop:24,backgroundColor:Colors.green}]} onPress={handlePlayAgain}>
          <Text style={st.btnTx}>Play Again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container:{flex:1,backgroundColor:'#000'},
  center:{flex:1,justifyContent:'center',alignItems:'center',padding:24},
  iconBox:{width:100,height:100,borderRadius:28,alignItems:'center',justifyContent:'center',marginBottom:16},
  title:{color:'#fff',fontSize: 22,fontWeight:'bold'},
  sub:{color:'rgba(255,255,255,0.5)',fontSize:15,marginTop:8,textAlign:'center'},
  hint:{color:'rgba(255,255,255,0.35)',fontSize:13,marginTop:12,textAlign:'center',paddingHorizontal:20},
  btn:{backgroundColor:'#007AFF',paddingVertical:16,borderRadius:16,width:'100%',alignItems:'center',marginTop:32},
  btnTx:{color:'#fff',fontSize: 17,fontWeight:'bold'},
  conceptCard:{backgroundColor:'rgba(255,204,0,0.12)',borderRadius:20,padding:28,marginTop:20,borderWidth:1,borderColor:'rgba(255,204,0,0.3)',width:'100%',alignItems:'center'},
  conceptTx:{color:Colors.yellow,fontSize: 34,fontWeight:'800'},
  drawHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16,paddingTop:8,paddingBottom:8},
  drawTitle:{color:'#fff',fontSize:17,fontWeight:'bold'},
  timerPill:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'rgba(255,255,255,0.08)',paddingHorizontal:14,paddingVertical:8,borderRadius:20},
  timerTx:{color:'#5AC8FA',fontSize:20,fontWeight:'bold',fontVariant:['tabular-nums']},
  canvas:{alignSelf:'center',borderRadius:16,overflow:'hidden'},
  colorDot:{width:32,height:32,borderRadius:16,borderWidth:2,borderColor:'transparent'},
  colorDotSel:{borderColor:'#fff',transform:[{scale:1.15}]},
  toolBtn:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:10,borderRadius:12,backgroundColor:'rgba(255,255,255,0.08)'},
  toolTx:{color:'#fff',fontSize:13,fontWeight:'600'},
  guessInput:{backgroundColor:'rgba(255,255,255,0.08)',borderRadius:14,padding:16,color:'#fff',fontSize:17,marginTop:16,borderWidth:1,borderColor:'rgba(255,255,255,0.1)'},
  judgeRow:{flexDirection:'row',alignItems:'center',padding:14,borderRadius:14,marginBottom:10,backgroundColor:'rgba(255,255,255,0.035)',borderWidth:1,borderColor:'rgba(255,255,255,0.04)'},
  judgeOk:{backgroundColor:'rgba(52,199,89,0.1)',borderColor:'rgba(52,199,89,0.3)'},
  judgeWrong:{backgroundColor:'rgba(255,59,48,0.08)',borderColor:'rgba(255,59,48,0.2)'},
  judgeName:{color:'#fff',fontSize:15,fontWeight:'600'},
  judgeAnswer:{color:'rgba(255,255,255,0.7)',fontSize: 13,marginTop:2},
  judgeBtn:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center'},
  rankRow:{flexDirection:'row',alignItems:'center',padding:14,gap:12,borderRadius:14,marginBottom:10,backgroundColor:'rgba(255,255,255,0.035)',borderWidth:1,borderColor:'rgba(255,255,255,0.04)'},
  rankFirst:{backgroundColor:'rgba(255,204,0,0.06)',borderColor:'rgba(255,204,0,0.2)'},
  rankNum:{fontSize:20,width:40,textAlign:'center',color:'rgba(255,255,255,0.5)'},
  rankName:{color:'#fff',fontSize:16,fontWeight:'600',flex:1},
  rankScore:{color:Colors.orange,fontSize: 17,fontWeight:'bold'},
});
