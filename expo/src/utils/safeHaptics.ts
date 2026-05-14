import { Platform } from 'react-native';
import { AudioManager } from '@/src/services/AudioManager';
import { useSettingsStore } from '@/src/store/useSettingsStore';

/**
 * Safe haptics wrapper that no-ops on web.
 * Also automatically plays corresponding sound effects via AudioManager.
 */

const isNative = Platform.OS !== 'web';

let HapticsModule: any = null;
if (isNative) {
  try {
    HapticsModule = require('expo-haptics');
  } catch {}
}

export const ImpactFeedbackStyle = {
  Light: 'Light' as const,
  Medium: 'Medium' as const,
  Heavy: 'Heavy' as const,
};

export const NotificationFeedbackType = {
  Success: 'Success' as const,
  Warning: 'Warning' as const,
  Error: 'Error' as const,
};

export async function impactAsync(style?: string) {
  if (style === ImpactFeedbackStyle.Heavy) {
    AudioManager.play('buttonTap', 0.8);
  } else if (style === ImpactFeedbackStyle.Medium) {
    AudioManager.play('tileFlip', 0.6);
  } else {
    AudioManager.play('tileFlip', 0.4);
  }
  
  if (HapticsModule && useSettingsStore.getState().isVibrationEnabled) {
    try { await HapticsModule.impactAsync(style); } catch {}
  }
}

export async function notificationAsync(type?: string) {
  if (type === NotificationFeedbackType.Success) {
    AudioManager.play('success');
  } else if (type === NotificationFeedbackType.Error) {
    AudioManager.play('fail');
  } else {
    AudioManager.play('wrong');
  }

  if (HapticsModule && useSettingsStore.getState().isVibrationEnabled) {
    try { await HapticsModule.notificationAsync(type); } catch {}
  }
}

export async function selectionAsync() {
  AudioManager.play('buttonTap', 0.5);
  
  if (HapticsModule && useSettingsStore.getState().isVibrationEnabled) {
    try { await HapticsModule.selectionAsync(); } catch {}
  }
}
