import { Platform } from 'react-native';
import { Audio } from '@/src/services/GameAudio';

export async function playSharedSound(type: 'success' | 'fail' | 'game_over'): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    let source;
    if (type === 'success') source = require('@/assets/sounds/success.wav');
    else if (type === 'fail') source = require('@/assets/sounds/fail.wav');
    else if (type === 'game_over') source = require('@/assets/sounds/game_over.wav');

    const { sound } = await Audio.Sound.createAsync(source);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (e) {
    // Ignore errors to not crash the game if sound fails
  }
}
