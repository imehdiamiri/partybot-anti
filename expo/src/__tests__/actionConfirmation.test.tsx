import React from 'react';
const {create,act}=require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
jest.mock('react-native',()=>({Modal:'Modal',Pressable:'Pressable',View:'View',Text:'Text',StyleSheet:{create:(s:any)=>s}}));
import {useActionConfirmation} from '../components/ActionConfirmation';
let screen:any;
function Harness({run}:{run:()=>void|Promise<void>}) {
 const {ask,dialog}=useActionConfirmation();
 return <>{React.createElement('Open',{onPress:()=>ask({title:'Skip turn?',message:'Skip Alice?',label:'Skip',run})})}{dialog}</>;
}
async function mount(run:()=>void|Promise<void>){await act(async()=>{screen=create(<Harness run={run}/>);});await act(async()=>screen.root.findByType('Open').props.onPress());}
const button=(id:string)=>screen.root.findByProps({testID:id});
afterEach(async()=>{if(screen)await act(async()=>screen.unmount());});
test('confirmation is visible in app; Cancel never invokes the action',async()=>{
 const run=jest.fn();await mount(run);
 expect(screen.root.findByType('Modal').props.visible).toBe(true);
 await act(async()=>button('action-cancel').props.onPress());
 expect(run).not.toHaveBeenCalled();expect(screen.root.findByType('Modal').props.visible).toBe(false);
});
test('double confirm executes a pending async Skip only once',async()=>{
 let finish!:()=>void;const run=jest.fn(()=>new Promise<void>(r=>{finish=r;}));await mount(run);
 await act(async()=>{void button('action-confirm').props.onPress();void button('action-confirm').props.onPress();});
 expect(run).toHaveBeenCalledTimes(1);expect(button('action-confirm').props.disabled).toBe(true);
 await act(async()=>finish());expect(screen.root.findByType('Modal').props.visible).toBe(false);
});
test('failed action stays visible and can be retried',async()=>{
 const run=jest.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(undefined);await mount(run);
 await act(async()=>button('action-confirm').props.onPress());expect(screen.root.findByType('Modal').props.visible).toBe(true);
 expect(JSON.stringify(screen.toJSON())).toContain('could not finish');
 await act(async()=>button('action-confirm').props.onPress());expect(run).toHaveBeenCalledTimes(2);
 expect(screen.root.findByType('Modal').props.visible).toBe(false);
});
