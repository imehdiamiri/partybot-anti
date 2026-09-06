const React = require('react');
const {act, create} = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('react-native',()=>({View:'View',Text:'Text',TouchableOpacity:'Button',StyleSheet:{create:s=>s},Platform:{OS:'web'},Share:{share:jest.fn()}}));
jest.mock('@/components/ui/icon-symbol',()=>({IconSymbol:'Icon'}));
jest.mock('@/src/components/games/GameStartGuide',()=>({useReplayGuide:()=>f=>f()}));
jest.mock('@/src/services/AudioManager',()=>({AudioManager:{play:jest.fn()}}));
jest.mock('@/src/components/games/GameActivity',()=>({GameActivityProvider:({children})=>children}));
const {ResultsScoreboard}=require('@/src/components/games/ResultsScoreboard');
const {GameSkipProvider,useSkipState,useRegisterSkip,useRegisterHandoffSkip}=require('@/src/contexts/GameSkipContext');
test('results preserve caller rank and replay, show skipped separately without emoji',async()=>{
 let screen;const replay=jest.fn();
 const entries=[{id:'a',name:'Alice',primary:'10 ms'},{id:'b',name:'Bob',primary:'20 ms'},{id:'c',name:'Chris',primary:'Skipped',isSkipped:true}];
 await act(async()=>{screen=create(React.createElement(ResultsScoreboard,{entries,onPlayAgain:replay}));});
 expect(screen.root.findByProps({testID:'results-winner'}).findAllByType('Text').map(n=>n.props.children)).toContain('Alice');
 expect(JSON.stringify(screen.toJSON())).not.toContain('👑');
 await act(async()=>screen.root.findByType('Button').props.onPress());expect(replay).toHaveBeenCalledTimes(1);
 await act(async()=>screen.update(React.createElement(ResultsScoreboard,{entries:[entries[2]]})));
 expect(screen.root.findAllByProps({testID:'results-winner'})).toHaveLength(0);
 expect(JSON.stringify(screen.toJSON())).toContain('No completed scores');
 await act(async()=>screen.unmount());
});
test('handoff skip takes priority over parent phase registration and restores normal skip',async()=>{
 let screen,state;const normal=jest.fn(),handoff=jest.fn();
 function Read(){state=useSkipState();return null;}
 function Parent(){const register=useRegisterSkip();React.useEffect(()=>{register(normal,'Alice');return()=>register(null);},[register]);return null;}
 function Handoff(){const register=useRegisterHandoffSkip();React.useEffect(()=>{register(handoff,'Bob');return()=>register(null);},[register]);return null;}
 const tree=show=>React.createElement(GameSkipProvider,null,React.createElement(Read),React.createElement(Parent),show&&React.createElement(Handoff));
 await act(async()=>{screen=create(tree(true));});
 expect(state.skipLabel).toBe('Skip this player');expect(state.skipPlayerName).toBe('Bob');state.skipHandler();expect(handoff).toHaveBeenCalledTimes(1);expect(normal).not.toHaveBeenCalled();
 await act(async()=>screen.update(tree(false)));
 expect(state.skipLabel).toBe('Skip');expect(state.skipPlayerName).toBe('Alice');state.skipHandler();expect(normal).toHaveBeenCalledTimes(1);
 await act(async()=>screen.unmount());
});
