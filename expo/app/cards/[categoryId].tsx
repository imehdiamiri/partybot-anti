import { SCREEN_LAYOUT } from '@/src/theme/ScreenLayout';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CardCategoryInfo } from '@/src/models/CardModels';
import { CardsDeckRenderer } from '@/src/components/tools/CardsDeckRenderer';

export function generateStaticParams(): { categoryId: string }[] {
  return Object.keys(CardCategoryInfo).map(categoryId => ({ categoryId }));
}

export default function CardsDeckScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const category = categoryId ? CardCategoryInfo[categoryId as keyof typeof CardCategoryInfo] : undefined;

  if (!category) {
    return (
      <View style={styles.container}>
        <AppBackgroundView />
        <Text style={{ color: 'white', marginTop: 100, textAlign: 'center' }}>Category not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      <ScreenHeader title={category.title} maxWidth={SCREEN_LAYOUT.form}
        leftLabel="Back" leftIcon="chevron.left" leftColor={category.accentColor}
        leftTestID="cards-back-btn" onLeftPress={() => {
          if (Platform.OS !== 'web' && router.canGoBack()) router.back();
          else router.replace('/tools' as any);
        }} />

      <CardsDeckRenderer categoryId={categoryId as any} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
});
