import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Action = { title: string; message: string; label: string; run: () => void | Promise<void> };
/** Rendered confirmation works in browsers/webviews as well as native apps. */
export function useActionConfirmation() {
  const [action, setAction] = useState<Action | null>(null);
  const current = useRef<Action | null>(null);
  const busy = useRef(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const dismiss = () => {
    if (busy.current) return;
    current.current = null; setAction(null); setError('');
  };
  const ask = (next: Action) => {
    if (busy.current) return;
    current.current = next; setAction(next); setError('');
  };
  const confirm = async () => {
    const next = current.current;
    if (!next || busy.current) return;
    busy.current = true; setWorking(true);
    try {
      await next.run();
      current.current = null; setAction(null);
    } catch {
      setError('This action could not finish. Please try again.');
    } finally { busy.current = false; setWorking(false); }
  };
  const dialog = <Modal visible={!!action} transparent animationType="fade" onRequestClose={dismiss}>
    <View style={s.backdrop}>
      <View style={s.card} accessibilityViewIsModal testID="action-confirmation">
        <Text accessibilityRole="header" style={s.title}>{action?.title}</Text>
        <Text style={s.message}>{action?.message}</Text>
        {!!error && <Text style={s.error}>{error}</Text>}
        <View style={s.buttons}>
          <Pressable accessibilityRole="button" testID="action-cancel" disabled={working} onPress={dismiss} style={[s.button,s.cancel]}>
            <Text style={s.text}>Cancel</Text>
          </Pressable>
          <Pressable accessibilityRole="button" testID="action-confirm" disabled={working} onPress={confirm} style={[s.button,s.confirm]}>
            <Text style={s.text}>{working ? 'Please wait…' : action?.label}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
  return { ask, dismiss, dialog };
}
const s = StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.7)',justifyContent:'center',alignItems:'center',padding:20},
  card:{width:'100%',maxWidth:420,backgroundColor:'#1B1E2B',borderRadius:24,padding:24,borderWidth:1,borderColor:'#353B50'},
  title:{color:'white',fontSize:22,fontWeight:'700',marginBottom:12},
  message:{color:'#CFD5E3',fontSize:16,lineHeight:24,marginBottom:24},
  error:{color:'#FF9E98',marginBottom:16},buttons:{flexDirection:'row',gap:12},
  button:{flex:1,minHeight:50,alignItems:'center',justifyContent:'center',borderRadius:14},
  cancel:{backgroundColor:'#343A4D'},confirm:{backgroundColor:'#B63143'},text:{color:'white',fontSize:16,fontWeight:'600'},
});
