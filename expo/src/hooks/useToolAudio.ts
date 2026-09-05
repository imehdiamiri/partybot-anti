import { useCallback, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ToolAudio } from '../services/ToolAudio';
import type { ToolKind } from '../services/ToolSoundDesign';

export function useToolAudio(kind: ToolKind) {
  const audio = useMemo(() => new ToolAudio(kind), [kind]);
  useFocusEffect(useCallback(() => {
    audio.prepare();
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') audio.cancel();
    });
    const onVisibility = () => { if (document.hidden) audio.cancel(); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVisibility);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVisibility);
      audio.dispose();
    };
  }, [audio]));
  return audio;
}
