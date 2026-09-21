const React = require('react');
const {create, act} = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('react-native', () => ({View:'View',Text:'Text',TextInput:'TextInput',ActivityIndicator:'Spinner',Pressable:'Pressable',ScrollView:'ScrollView',Platform:{OS:'ios',select:s=>s.ios||s.default},StyleSheet:{create:s=>s},useWindowDimensions:()=>({width:390,height:844,fontScale:1}),Dimensions:{get:()=>({width:390,height:844})}}));
jest.mock('react-native-reanimated', () => ({__esModule:true,default:{View:'AnimatedView',createAnimatedComponent:x=>x},useSharedValue:v=>React.useRef({value:v}).current,useAnimatedStyle:()=>({}),withTiming:v=>v,withSpring:v=>v,withRepeat:v=>v,withSequence:v=>v,cancelAnimation:()=>{},Easing:{linear:null},runOnJS:f=>f}));
jest.mock('@/components/ui/icon-symbol',()=>({IconSymbol:'Icon'}));
jest.mock('@/src/components/games/PhaseTransition',()=>({PhaseTransition:'Phase'}));
jest.mock('@/src/components/games/SharedGameComponents',()=>({GamePassPhoneView:'Ready',GamePlayerCompleteView:'Complete',GameResultsScreen:'Results',playSharedSound:()=>{}}));
jest.mock('@/src/contexts/GameSkipContext',()=>({useRegisterSkip:()=>()=>{}}));
jest.mock('@/src/utils/safeHaptics',()=>({notificationAsync:()=>{},impactAsync:()=>{},selectionAsync:()=>{},NotificationFeedbackType:{},ImpactFeedbackStyle:{}}));
jest.mock('@/src/services/AudioManager',()=>({AudioManager:{play:jest.fn()}}));
jest.mock('@/src/services/GameAudio',()=>({Audio:{setAudioModeAsync:jest.fn(async()=>{}),Sound:{createAsync:jest.fn()}}}));
jest.mock('@/src/components/games/ResultsScoreboard',()=>({ResultsScoreboard:'Scoreboard'}));
jest.mock('expo-asset',()=>({Asset:{fromModule:()=>({uri:'/whitney.wav'})}}));
jest.mock('@/src/utils/platform',()=>({isWeb:false}));
jest.mock('@/src/utils/browserMediaAdapter',()=>({playWebTick:()=>{},playWebDrumHit:jest.fn()}));
jest.mock('@/src/utils/browserRecordingPlayback',()=>({BrowserRecordingPlayback: class {
  play=jest.fn(async()=>{globalThis.drumPlayCalls=(globalThis.drumPlayCalls||0)+1;return true;}); stop=jest.fn(); clear=jest.fn();
  constructor(){ globalThis.drumAudioMock=this; }
}}));
jest.mock('@/src/components/games/GameIllustrations',()=>({DrumIllustration:'DrumVector'}));
const {DrumChallengeSession}=require('@/src/components/games/DrumChallengeSession');

const {Audio}=require('@/src/services/GameAudio');
const makeSound=()=>({unloadAsync:jest.fn(async()=>{}),playAsync:jest.fn(async()=>{}),stopAsync:jest.fn(async()=>{}),setOnPlaybackStatusUpdate:jest.fn(),setRateAsync:jest.fn(async()=>{})});
const session={players:[{id:'a',displayName:'Alice'}],gameConfig:{drumMode:'whitney'}};
beforeEach(()=>{jest.useFakeTimers();jest.clearAllMocks();Audio.Sound.createAsync.mockReset();});
afterEach(()=>jest.useRealTimers());
test('exiting Drum Challenge unloads the active native track and cancels the attempt timer',async()=>{
 const sounds=[]; Audio.Sound.createAsync.mockImplementation(async()=>{const sound=makeSound();sounds.push(sound);return {sound};});
 let screen;await act(async()=>{screen=create(React.createElement(DrumChallengeSession,{session}));});
 await act(async()=>screen.root.findByType('Ready').props.onReady());
 expect(sounds[2].playAsync).toHaveBeenCalledTimes(1);
 await act(async()=>screen.unmount());
 sounds.forEach(sound=>expect(sound.unloadAsync).toHaveBeenCalledTimes(1));
 jest.runAllTicks();expect(jest.getTimerCount()).toBe(0);
});
test('a native drum preload resolving after Exit is released instead of retained',async()=>{
 let resolve;const sound=makeSound();
 Audio.Sound.createAsync.mockImplementationOnce(()=>new Promise(r=>resolve=r));
 let screen;await act(async()=>{screen=create(React.createElement(DrumChallengeSession,{session}));});
 await act(async()=>screen.unmount());
 await act(async()=>resolve({sound}));
 expect(sound.unloadAsync).toHaveBeenCalledTimes(1);
 expect(sound.playAsync).not.toHaveBeenCalled();
 expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(1);
});
test('exiting during music loading prevents delayed playback',async()=>{
 let resolve;const sounds=[makeSound(),makeSound(),makeSound()];
 Audio.Sound.createAsync.mockResolvedValueOnce({sound:sounds[0]}).mockResolvedValueOnce({sound:sounds[1]}).mockImplementationOnce(()=>new Promise(r=>resolve=r));
 let screen;await act(async()=>{screen=create(React.createElement(DrumChallengeSession,{session}));});
 let start;await act(async()=>{start=screen.root.findByType('Ready').props.onReady();});
 await act(async()=>screen.unmount());
 await act(async()=>{resolve({sound:sounds[2]});await start;});
 expect(sounds[2].unloadAsync).toHaveBeenCalledTimes(1);
 expect(sounds[2].playAsync).not.toHaveBeenCalled();
 jest.runAllTicks();expect(jest.getTimerCount()).toBe(0);
});
