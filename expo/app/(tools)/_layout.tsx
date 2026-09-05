import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Text, Platform, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ToolsLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackVisible: false,
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: '#1A1A1A' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'Viral-Black', fontSize: 20 },
        contentStyle: { backgroundColor: '#111' },
        headerLeft: () => (
          <TouchableOpacity 
            testID="tool-header-back-btn"
            accessibilityRole="button"
            onPress={() => { 
              if (Platform.OS !== 'web' && router.canGoBack()) { 
                router.back(); 
              } else { 
                router.replace('/tools' as any); 
              } 
            }} 
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minWidth: 44,
              minHeight: 44,
              paddingHorizontal: 8,
              paddingVertical: 6,
            }}
          >
            <IconSymbol name="chevron.left" size={18} color="#007AFF" />
            <Text style={{ color: '#007AFF', fontSize: 17, fontWeight: '400', marginLeft: 2 }}>Back</Text>
          </TouchableOpacity>
        ),
        headerRight: () => (
          <View style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 8 }} />
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
