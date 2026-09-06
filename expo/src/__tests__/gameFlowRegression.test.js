const React = require('react');
const {create, act} = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('react-native', () => ({View:'View',Text:'Text',TextInput:'TextInput',ActivityIndicator:'Spinner',Pressable:'Pressable',ScrollView:'ScrollView',Platform:{OS:'web',select:s=>s.web||s.default},StyleSheet:{create:s=>s},Dimensions:{get:()=>({width:390,height:844})}}));
jest.mock('react-native-reanimated', () => ({__esModule:true,default:{View:'AnimatedView',createAnimatedComponent:x=>x},useSharedValue:v=>React.useRef({value:v}).current,useAnimatedStyle:()=>({}),withTiming:v=>v,withSpring:v=>v,withRepeat:v=>v,withSequence:v=>v,cancelAnimation:()=>{},Easing:{linear:null},runOnJS:f=>f}));
jest.mock('@/components/ui/icon-symbol',()=>({IconSymbol:'Icon'}));
jest.mock('@/src/components/games/PhaseTransition',()=>({PhaseTransition:'Phase'}));
jest.mock('@/src/components/games/SharedGameComponents',()=>({GamePassPhoneView:'Ready',GamePlayerCompleteView:'Complete',GameResultsScreen:'Results',playSharedSound:()=>{}}));
jest.mock('@/src/contexts/GameSkipContext',()=>({useRegisterSkip:()=>()=>{}}));
jest.mock('@/src/utils/safeHaptics',()=>({notificationAsync:()=>{},impactAsync:()=>{},selectionAsync:()=>{},NotificationFeedbackType:{},ImpactFeedbackStyle:{}}));
jest.mock('@/src/services/AudioManager',()=>({AudioManager:{play:jest.fn()}}));
const {ColorTrapSession}=require('@/src/components/games/ColorTrapSession');
jest.mock('@/src/services/GameAudio',()=>({Audio:{}}));
jest.mock('@/src/components/games/ResultsScoreboard',()=>({ResultsScoreboard:'Scoreboard'}));
jest.mock('expo-asset',()=>({Asset:{fromModule:()=>({uri:'/whitney.wav'})}}));
jest.mock('@/src/utils/platform',()=>({isWeb:true}));
jest.mock('@/src/utils/browserMediaAdapter',()=>({playWebTick:()=>{},playWebDrumHit:jest.fn()}));
jest.mock('@/src/utils/browserRecordingPlayback',()=>({BrowserRecordingPlayback: class {
  play=jest.fn(async()=>{globalThis.drumPlayCalls=(globalThis.drumPlayCalls||0)+1;return true;}); stop=jest.fn(); clear=jest.fn();
  constructor(){ globalThis.drumAudioMock=this; }
}}));
jest.mock('@/src/components/games/GameIllustrations',()=>({DrumIllustration:'DrumVector'}));
const {DrumChallengeSession}=require('@/src/components/games/DrumChallengeSession');
test.each(['whitney','metronome'])('Drum %s plays one web hit for an accepted tap, not two rapid taps', async drumMode => {
 jest.useFakeTimers(); let screen;
 const {playWebDrumHit}=require('@/src/utils/browserMediaAdapter'); playWebDrumHit.mockClear();
 await act(async()=>{screen=create(React.createElement(DrumChallengeSession,{session:{players:[{id:'a',displayName:'Alice'}],gameConfig:{drumMode}}}));});
 await act(async()=>screen.root.findByType('Ready').props.onReady());
 if(drumMode==='metronome') await act(async()=>jest.advanceTimersByTime(require('@/src/utils/metronomeChallenge').metronomePlan('4/4').audibleMs));
 const tap=screen.root.findByProps({testID:'drum-challenge-tap-btn'}).props.onPress;
 await act(async()=>{tap();tap();});
 expect(playWebDrumHit).toHaveBeenCalledTimes(1);
 await act(async()=>screen.unmount()); jest.useRealTimers();
});
test.each(['4/4','3/4','6/8','8/8'])('Metronome %s waits through listening and scores one tap after four silent bars', async rhythm => {
 jest.useFakeTimers(); let screen;
 const {metronomePlan}=require('@/src/utils/metronomeChallenge');
 const plan=metronomePlan(rhythm);
 await act(async()=>{screen=create(React.createElement(DrumChallengeSession,{session:{players:[{id:'a',displayName:'Alice'}],gameConfig:{drumMode:'metronome',metronomeRhythm:rhythm}}}));});
 await act(async()=>screen.root.findByType('Ready').props.onReady());
 const button=()=>screen.root.findByProps({testID:'drum-challenge-tap-btn'});
 expect(button().props.disabled).toBe(true);
 await act(async()=>button().props.onPress());
 expect(screen.root.findAllByProps({testID:'drum-challenge-next-attempt'})).toHaveLength(0);
 await act(async()=>jest.advanceTimersByTime(plan.audibleMs));
 expect(button().props.disabled).toBe(false);
 await act(async()=>jest.advanceTimersByTime(plan.targetMs-plan.audibleMs+125));
 const tap=button().props.onPress;
 await act(async()=>{tap();tap();});
 expect(JSON.stringify(screen.toJSON())).toContain('125 ms late');
 await act(async()=>jest.advanceTimersByTime(5000));
 expect(screen.root.findAllByProps({testID:'drum-challenge-next-attempt'})).toHaveLength(1);
 await act(async()=>screen.unmount());
 jest.runAllTicks(); // React schedules microtasks that are not game timers.
 expect(jest.getTimerCount()).toBe(0);
 jest.useRealTimers();
});
test('Drum plays the web track and credits three auto-finished attempts per player',async()=>{
 jest.useFakeTimers(); let screen; globalThis.drumPlayCalls=0;
 const press=async id=>act(async()=>screen.root.findByProps({testID:id}).props.onPress());
 await act(async()=>{screen=create(React.createElement(DrumChallengeSession,{session:{players:[{id:'a',displayName:'Alice'},{id:'b',displayName:'Bob'}]}}));});
 for(let player=0;player<2;player++){
  expect(screen.root.findByType('Ready').props.playerName).toBe(player===0?'Alice':'Bob');
  await act(async()=>screen.root.findByType('Ready').props.onReady());
  for(let attempt=0;attempt<3;attempt++){
   await act(async()=>jest.advanceTimersByTime(28001));
   await press('drum-challenge-next-attempt');
  }
  if(player===0) await act(async()=>screen.root.findByType('Complete').props.onReady());
 }
 expect(screen.root.findByType('Scoreboard').props.entries).toHaveLength(2);
 expect(globalThis.drumPlayCalls).toBe(6);
 await act(async()=>screen.unmount()); jest.useRealTimers();
});
test('Imposter ties have an explicit escape outcome; final vote can change it',()=>{
 const {getImposterOutcome}=require('@/src/utils/imposterOutcome');
 expect(getImposterOutcome({a:'b',b:'a'},'a')).toMatchObject({tied:true,imposterCaught:false,points:{a:150}});
 expect(getImposterOutcome({a:'b',b:'a',c:'a'},'a')).toMatchObject({tied:false,imposterCaught:true,points:{b:100,c:100}});
});
test('Color Trap completes both players and shows final results',async()=>{
 jest.useFakeTimers();
 let screen;
 await act(async()=>{screen=create(React.createElement(ColorTrapSession,{session:{players:[{id:'p1',displayName:'Alice'},{id:'p2',displayName:'Bob'}],gameConfig:{difficulty:'easy'}}}));});
 await act(async()=>screen.root.findByProps({testID:'color-trap-ready-button'}).props.onPress());
 await act(async()=>jest.advanceTimersByTime(21000));
 expect(screen.root.findByType('Complete').props.nextPlayerName).toBe('Bob');
 await act(async()=>screen.root.findByType('Complete').props.onReady());
 await act(async()=>jest.advanceTimersByTime(21000));
 expect(screen.root.findByType('Complete').props.finalTurn).toBe(true);
 expect(screen.root.findByType('Complete').props.prevPlayerName).toBe('Bob');
 expect(screen.root.findByType('Complete').props.prevResultLine).toContain('forbidden-color taps');
 await act(async()=>screen.root.findByType('Complete').props.onReady());
 expect(screen.root.findAllByType('Complete')).toHaveLength(0);
 expect(screen.root.findAllByType('Results')).toHaveLength(1);
 await act(async()=>screen.unmount());
 jest.useRealTimers();
});
jest.mock('@/src/components/games/ResultsScoreboard',()=>({ResultsScoreboard:'Scoreboard'}));
jest.mock('@/src/components/LiquidGlass',()=>({LiquidGlass:'Glass'}));
jest.mock('@/src/services/ImposterWords',()=>({imposterWordPicker:{draw:async()=> 'Apple'}}));
jest.mock('@/src/components/games/ImposterWordTranslation',()=>({ImposterWordTranslation:'Translation'}));
const {ImposterSession}=require('@/src/components/games/ImposterSession');
test('Imposter awards points to the last correct voter',async()=>{
 const random=jest.spyOn(Math,'random').mockReturnValue(0.999).mockReturnValueOnce(0);
 let screen;
 const press=async id=>act(async()=>screen.root.findByProps({testID:id}).props.onPress());
 await act(async()=>{screen=create(React.createElement(ImposterSession,{session:{players:['p1','p2','p3','p4'].map(id=>({id,displayName:id})),maxRounds:1}}));});
 for(let i=0;i<4;i++){
  expect(screen.root.findAllByType('Translation')).toHaveLength(0);
  await act(async()=>screen.root.findByType('Ready').props.onReady());
  expect(screen.root.findAllByType('Translation')).toHaveLength(i===0?0:1);
  await press('imposter-got-it-button');
 }
 await press('imposter-start-discussion-button');
 await press('imposter-skip-to-voting-button');
 for(const suspect of ['p2','p1','p1','p1']){
  await press('imposter-suspect-'+suspect);
  await press('imposter-confirm-vote-button');
 }
 expect(JSON.stringify(screen.toJSON())).toContain('Imposter Caught!');
 await press('imposter-continue-button');
 const entries=screen.root.findByType('Scoreboard').props.entries;
 expect(entries.find(e=>e.id==='p2').primary).toBe('100 pts');
 expect(entries.find(e=>e.id==='p4').primary).toBe('100 pts');
 await act(async()=>screen.unmount());random.mockRestore();
});
