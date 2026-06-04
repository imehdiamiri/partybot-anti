import { StyleSheet, View, Text, ScrollView, TouchableOpacity, LayoutAnimation, UIManager, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { LiquidGlass } from '@/src/components/LiquidGlass';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AIGeneratorPanel } from '@/src/components/AIGeneratorPanel';
import { useSavedIdeasStore } from '@/src/store/useSavedIdeasStore';
import { Colors } from '@/src/theme/Colors';

export default function FactoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedIdeas, removeIdea } = useSavedIdeasStore();
  const params = useLocalSearchParams();
  const resetAt = params.resetAt as string | undefined;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <AppBackgroundView />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 6, paddingBottom: 120 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Factory</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.85}>
            <LiquidGlass variant="mid" radius={20} style={styles.profileButton} shadow={false}>
              <IconSymbol name="person.crop.circle" size={22} color="white" />
            </LiquidGlass>
          </TouchableOpacity>
        </View>

        <AIGeneratorPanel resetAt={resetAt} />

        {/* Saved Ideas */}
        {savedIdeas.length > 0 && (
          <SavedIdeasSection savedIdeas={savedIdeas} removeIdea={removeIdea} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  scrollContent: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  title: { fontFamily: 'Viral-Black', fontSize: 28, color: 'white' },
  profileButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  savedSection: { marginTop: 24, gap: 12 },
  savedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  savedTitle: { fontFamily: 'Viral-Black', color: 'white', fontSize: 16 },
  savedBadge: { backgroundColor: 'rgba(175,82,222,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  savedBadgeText: { color: '#AF52DE', fontSize: 12, fontWeight: 'bold' },
  savedCard: {
    backgroundColor: 'rgba(25,25,40,0.95)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  savedCardInner: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 10 },
  savedCardTitle: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  savedCardDesc: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  savedTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  savedTag: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  savedTagText: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '600' },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,69,58,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  expandedContent: {
    padding: 14,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 4,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  stepBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.14)',
    justifyContent: 'center', alignItems: 'center',
  },
  stepBadgeText: { color: Colors.blue, fontSize: 11, fontWeight: 'bold' },
  stepText: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 1, lineHeight: 18 },
});

function SavedIdeasSection({ savedIdeas, removeIdea }: { savedIdeas: any[], removeIdea: (id: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View style={styles.savedSection}>
      <View style={styles.savedHeader}>
        <IconSymbol name="bookmark.fill" size={16} color="#AF52DE" />
        <Text style={styles.savedTitle}>Saved Ideas</Text>
        <View style={styles.savedBadge}>
          <Text style={styles.savedBadgeText}>{savedIdeas.length}</Text>
        </View>
      </View>
      {savedIdeas.map((idea) => {
        const isExpanded = expandedId === idea.id;
        return (
          <TouchableOpacity 
            key={idea.id} 
            style={styles.savedCard}
            activeOpacity={0.8}
            onPress={() => toggleExpand(idea.id)}
          >
            <View style={styles.savedCardInner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedCardTitle}>{idea.title}</Text>
                <Text style={styles.savedCardDesc} numberOfLines={isExpanded ? undefined : 2}>
                  {idea.description}
                </Text>
                {!isExpanded && idea.tags && idea.tags.length > 0 && (
                  <View style={styles.savedTagsRow}>
                    {idea.tags.map((tag: string) => (
                      <View key={tag} style={styles.savedTag}>
                        <Text style={styles.savedTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <TouchableOpacity 
                style={styles.deleteBtn} 
                onPress={() => removeIdea(idea.id)}
              >
                <IconSymbol name="trash" size={14} color="rgba(255,69,58,0.8)" />
              </TouchableOpacity>
            </View>
            
            {isExpanded && idea.steps && idea.steps.length > 0 && (
              <View style={styles.expandedContent}>
                {idea.steps.map((step: string, i: number) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
                {idea.tags && idea.tags.length > 0 && (
                  <View style={[styles.savedTagsRow, { marginTop: 12 }]}>
                    {idea.tags.map((tag: string) => (
                      <View key={tag} style={styles.savedTag}>
                        <Text style={styles.savedTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
