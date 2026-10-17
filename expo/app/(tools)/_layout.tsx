import { Stack, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { ScreenHeader } from '@/src/components/ScreenHeader';

export default function ToolsLayout() {
  const router = useRouter();
  return (
    <Stack screenOptions={{
      headerShown: true, gestureEnabled: false, statusBarStyle: 'light',
      contentStyle: { backgroundColor: '#111' },
      header: ({ options }) => (
        <ScreenHeader title={options.title || 'Tools'} leftLabel="Back" leftIcon="chevron.left"
          leftTestID="tool-header-back-btn" onLeftPress={() => {
            if (Platform.OS !== 'web' && router.canGoBack()) router.back();
            else router.replace('/tools' as any);
          }} />
      ),
    }}>
      <Stack.Screen name="dice" options={{ title: 'Dice' }} />
      <Stack.Screen name="bottle" options={{ title: 'Bottle' }} />
      <Stack.Screen name="hourglass" options={{ title: 'Hourglass' }} />
      <Stack.Screen name="coin" options={{ title: 'Coin Flip' }} />
      <Stack.Screen name="teams" options={{ title: 'Team Splitter' }} />
      <Stack.Screen name="wheel" options={{ title: 'Wheel' }} />
    </Stack>
  );
}
