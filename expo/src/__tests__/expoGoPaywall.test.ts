jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'storeClient' } }));
jest.mock('../utils/platform', () => ({ isWeb: false }));
jest.mock('../store/useEconomyStore', () => ({ useEconomyStore: { getState: jest.fn() } }));
jest.mock('react-native-purchases', () => { throw new Error('Native purchases must not load in Expo Go'); });
import { usePaywallStore } from '../store/usePaywallStore';

test('Expo Go starts and configures safely without loading the purchases native module', async () => {
  await usePaywallStore.getState().configure('preview-user');
  expect(usePaywallStore.getState().isConfigured).toBe(false);
  expect(usePaywallStore.getState().packages).toEqual([]);
});
