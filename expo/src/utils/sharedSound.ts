import { AudioManager } from '@/src/services/AudioManager';

export async function playSharedSound(type: 'success' | 'fail' | 'game_over'): Promise<void> {
  await AudioManager.play(type === 'game_over' ? 'gameOver' : type, 0.6);
}
