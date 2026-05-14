import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';

export default function ToolsLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#1A1A1A' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'Viral-Black', fontSize: 20 },
        contentStyle: { backgroundColor: '#111' },
        headerRight: () => (
          <TouchableOpacity 
            onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} 
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 8,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Done</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen name="dice" options={{ title: 'Dice' }} />
      <Stack.Screen name="bottle" options={{ title: 'Bottle' }} />
      <Stack.Screen name="hourglass" options={{ title: 'Hourglass' }} />
      <Stack.Screen name="coin" options={{ title: 'Coin Flip' }} />
      <Stack.Screen name="teams" options={{ title: 'Team Splitter' }} />
      <Stack.Screen name="wheel" options={{ title: 'Wheel' }} />
    </Stack>
  );
}
