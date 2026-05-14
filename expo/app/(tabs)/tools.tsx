import { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';

// Platform-safe BlurView
let BlurView: any = null;
if (Platform.OS === 'ios') {
  try { BlurView = require('expo-blur').BlurView; } catch {}
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useRouter } from 'expo-router';

import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { LiquidGlass } from '@/src/components/LiquidGlass';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CardCategoriesList } from '@/src/models/CardModels';
import { PartyToolsSection } from '@/src/components/tools/PartyToolsSection';

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showSaved, setShowSaved] = useState(false);

  const totalCardsCount = 520; // Mock total count for now

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 6, paddingBottom: 120 }]}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Tools</Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setShowSaved(true)} activeOpacity={0.85}>
            <LiquidGlass variant="mid" radius={20} style={styles.bookmarkButton} shadow={false}>
              <IconSymbol name={showSaved ? 'bookmark.fill' : 'bookmark'} size={18} color="white" />
            </LiquidGlass>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.85}>
            <LiquidGlass variant="mid" radius={20} style={styles.profileButton} shadow={false}>
              <IconSymbol name="person.crop.circle" size={22} color="white" />
            </LiquidGlass>
          </TouchableOpacity>
        </View>

        {/* Tools Section */}
        <PartyToolsSection showsHeader={false} />

        {/* Cards Section — distinct container */}
        <View style={styles.cardsSectionWrapper}>
          <LinearGradient
            colors={['rgba(255,90,140,0.10)', 'rgba(120,80,255,0.06)', 'rgba(255,255,255,0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cardsSectionBorder} pointerEvents="none" />

          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.titleIconBadge}>
                <IconSymbol name="rectangle.fill.on.rectangle.angled.fill" size={14} color="#FF5A8C" weight="bold" />
              </View>
              <Text style={styles.sectionTitle}>Ready to Use Cards</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{totalCardsCount}</Text>
            </View>
          </View>

          <View style={styles.cardsList}>
            {/* Categories */}
            <View style={styles.categoriesContainer}>
              {CardCategoriesList.map((category) => (
                <TouchableOpacity 
                  key={category.id} 
                  style={styles.rowContainer} 
                  activeOpacity={0.8}
                  onPress={() => router.push(`/cards/${category.id}` as any)}
                >
                  {Platform.OS === 'ios' && BlurView ? (
                    <BlurView intensity={25} tint="dark" style={styles.categoryRow}>
                      <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.00)']} style={styles.categoryBackground}>
                        <View style={[styles.categoryIconContainer, { backgroundColor: category.accentColor + '20' }]}>
                          <IconSymbol name={category.icon as any} size={18} color={category.accentColor} />
                        </View>
                        <View style={styles.categoryTextContainer}>
                          <Text style={[styles.categoryTitle, { color: category.accentColor }]}>{category.title}</Text>
                          <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
                        </View>
                        <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.3)" />
                      </LinearGradient>
                    </BlurView>
                  ) : (
                    <View style={[styles.categoryRow, { backgroundColor: 'rgba(20,20,30,0.92)' }]}>
                      <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.00)']} style={styles.categoryBackground}>
                        <View style={[styles.categoryIconContainer, { backgroundColor: category.accentColor + '20' }]}>
                          <IconSymbol name={category.icon as any} size={18} color={category.accentColor} />
                        </View>
                        <View style={styles.categoryTextContainer}>
                          <Text style={[styles.categoryTitle, { color: category.accentColor }]}>{category.title}</Text>
                          <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
                        </View>
                        <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.3)" />
                      </LinearGradient>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  headerTextContainer: {
    gap: 2,
  },
  headerTitle: {
    fontFamily: 'Viral-Black',
    fontSize: 28,
    color: 'white',
  },
  bookmarkButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsSectionWrapper: {
    marginTop: 20,
    padding: 14,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 14,
  },
  cardsSectionBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,90,140,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,140,0.25)',
  },
  sectionTitle: {
    fontFamily: 'Viral-Black',
    fontSize: 16,
    color: 'white',
  },
  totalBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  totalBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.55)',
  },
  cardsList: {
    gap: 10,
  },
  rowContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  categoriesContainer: {
    gap: 8,
  },
  categoryRow: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  categoryBackground: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTextContainer: {
    flex: 1,
    gap: 4,
  },
  categoryTitle: {
    fontFamily: 'Viral-Black',
    fontSize: 17,
    color: 'white',
  },
  categorySubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
});
