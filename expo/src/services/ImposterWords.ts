import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImposterWordPicker } from '../utils/imposterWordPicker';

// One queue per app instance, shared by all local Imposter sessions.
export const imposterWordPicker = new ImposterWordPicker(AsyncStorage);

