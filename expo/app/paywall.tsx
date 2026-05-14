import { Colors } from '@/src/theme/Colors';
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GlowView } from '@/src/components/ui/GlowView';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { usePaywallStore } from '@/src/store/usePaywallStore';
import { useEconomyStore } from '@/src/store/useEconomyStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { PurchasesPackage } from 'react-native-purchases';
import * as Linking from 'expo-linking';
import { AppConstants } from '@/src/constants/AppConstants';

// Types and Enums
enum PaywallTab {
  Subscription = 'Premium',
  Stars = 'Star Packs',
  Support = 'Support'
}

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { 
    isLoading, 
    isPurchasing, 
    error, 
    configure,
    purchasePackage,
    restorePurchases,
    clearError,
    getSubscriptionPackages,
    getLifetimePackage,
    getStarPackages,
    getDonationPackages
  } = usePaywallStore();
  const { isPremium } = useEconomyStore();
  const uid = useAuthStore((s) => s.currentUser?.uid);

  const [tab, setTab] = useState<PaywallTab>(PaywallTab.Subscription);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  useEffect(() => {
    if (uid) configure(uid);
  }, [uid, configure]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error, clearError]);

  useEffect(() => {
    if (isPremium && tab === PaywallTab.Subscription) {
      // If user successfully subscribed, dismiss paywall
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    }
  }, [isPremium, tab, router]);

  // Set default selected package
  useEffect(() => {
    const subs = getSubscriptionPackages();
    const lifetime = getLifetimePackage();
    if (!selectedPackage) {
      const bestValue = subs.find(p => p.packageType === 'ANNUAL') || subs[0] || lifetime;
      if (bestValue) setSelectedPackage(bestValue);
    }
  }, [isLoading]);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    await purchasePackage(pkg);
  };

  const renderTabSelector = () => (
    <View style={styles.tabContainer}>
      {Object.values(PaywallTab).map((t) => (
        <TouchableOpacity 
          key={t}
          style={[styles.tabButton, tab === t && styles.tabButtonActive]}
          onPress={() => setTab(t)}
        >
          <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
            {t}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderHeroSection = () => (
    <View style={styles.heroSection}>
      <View style={styles.iconContainer}>
        {/* Real radial gradient behind icon using SVG GlowView */}
        <GlowView color="rgba(255, 165, 0, 0.5)" size={180} style={{ position: 'absolute' }} />
        <IconSymbol 
          name={isPremium ? "crown.fill" : "sparkles"} 
          size={44} 
          color="#FFA500" 
        />
      </View>
      <Text style={styles.heroTitle}>
        {isPremium ? "You're a Premium Member" : "Unlock All Premium Games"}
      </Text>
      {!isPremium && (
        <Text style={styles.heroSubtitle}>
          Plus cheap AI cards (1 ★ instead of 5) and all games unlocked
        </Text>
      )}
    </View>
  );

  const renderSubscriptionSection = () => {
    const subs = getSubscriptionPackages();
    const lifetime = getLifetimePackage();

    return (
      <View style={styles.sectionContainer}>
        {/* Features Block */}
        <View style={styles.featuresBlock}>
          <FeatureRow icon="gamecontroller.fill" color="#007AFF" text="All 7 Premium games unlocked" />
          <FeatureRow icon="star.fill" color={Colors.orange} text="Star bonus each billing period" />
          <FeatureRow icon="sparkles" color={Colors.yellow} text="AI cards at 1 ★ (instead of 5)" />
          <FeatureRow icon="sparkles" color="#AF52DE" text="Support ongoing development" />
        </View>

        {/* Plans */}
        {subs.length > 0 && (
          <View style={{ gap: 10 }}>
            {subs.map(pkg => (
              <PlanRow 
                key={pkg.identifier} 
                pkg={pkg} 
                isSelected={selectedPackage?.identifier === pkg.identifier}
                onSelect={() => setSelectedPackage(pkg)}
              />
            ))}
          </View>
        )}

        {lifetime && (
          <LifetimeRow 
            pkg={lifetime}
            isSelected={selectedPackage?.identifier === lifetime.identifier}
            onSelect={() => setSelectedPackage(lifetime)}
          />
        )}

        {/* CTA Button */}
        <TouchableOpacity 
          style={[styles.ctaButton, (isPurchasing || !selectedPackage) && styles.ctaButtonDisabled]}
          disabled={isPurchasing || !selectedPackage}
          onPress={() => selectedPackage && handlePurchase(selectedPackage)}
        >
          <LinearGradient
            colors={[Colors.orange, '#E68A00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            {isPurchasing && <ActivityIndicator color="white" style={{ marginRight: 8 }} />}
            <Text style={styles.ctaText}>
              {selectedPackage?.packageType === 'LIFETIME' ? 'Get Lifetime Access' : 
               selectedPackage ? `Start ${selectedPackage.packageType.toLowerCase()}` : 'Continue'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  const renderStarsSection = () => {
    const packs = getStarPackages();
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Star Packs</Text>
          <Text style={styles.sectionDescription}>
            Stars power AI card generation. Subscribers spend just 1 ★ per card.
          </Text>
        </View>

        {packs.length === 0 ? (
          <Text style={styles.loadingText}>Star packs are being loaded...</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {packs.map(pkg => (
              <PackRow 
                key={pkg.identifier} 
                pkg={pkg} 
                icon="star.fill"
                iconColor={Colors.orange}
                onPurchase={() => handlePurchase(pkg)}
                isPurchasing={isPurchasing}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderSupportSection = () => {
    const donations = getDonationPackages();
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Support Development</Text>
          <Text style={styles.sectionDescription}>
            Love the game? Leave a tip to help us keep building.
          </Text>
        </View>

        {donations.length === 0 ? (
          <Text style={styles.loadingText}>Donation tiers are being loaded...</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {donations.map(pkg => (
              <PackRow 
                key={pkg.identifier} 
                pkg={pkg} 
                icon="heart.fill"
                iconColor="#FF2D55"
                onPurchase={() => handlePurchase(pkg)}
                isPurchasing={isPurchasing}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      
      {/* Navigation Bar */}
      <View style={[styles.navBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.closeButton} onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }}>
          <IconSymbol name="xmark.circle.fill" size={28} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
          {renderHeroSection()}
          {renderTabSelector()}

          {tab === PaywallTab.Subscription && renderSubscriptionSection()}
          {tab === PaywallTab.Stars && renderStarsSection()}
          {tab === PaywallTab.Support && renderSupportSection()}

          <TouchableOpacity onPress={restorePurchases} style={styles.restoreButton}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          <View style={styles.legalContainer}>
            <Text style={styles.legalDisclaimer}>
              Subscriptions auto-renew unless cancelled 24h before period end. Payment is charged to your Apple ID. Stars remain in your wallet after subscription ends.
            </Text>
            <View style={styles.legalLinksRow}>
              <TouchableOpacity onPress={() => Linking.openURL(AppConstants.URLs.privacyPolicy)}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>•</Text>
              <TouchableOpacity onPress={() => Linking.openURL(AppConstants.URLs.termsOfService)}>
                <Text style={styles.legalLink}>Terms of Service</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// Subcomponents for better readability
const FeatureRow = ({ icon, color, text }: { icon: string, color: string, text: string }) => (
  <View style={styles.featureRow}>
    <View style={[styles.featureIconBox, { backgroundColor: `${color}22` }]}>
      <IconSymbol name={icon as any} size={16} color={color} />
    </View>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const PlanRow = ({ pkg, isSelected, onSelect }: { pkg: PurchasesPackage, isSelected: boolean, onSelect: () => void }) => {
  const isBest = pkg.packageType === 'ANNUAL';
  return (
    <TouchableOpacity 
      style={[
        styles.planRow, 
        isSelected ? styles.planRowSelected : styles.planRowDefault,
        isSelected && styles.planRowSelectedBorder,
        !isSelected && isBest && styles.planRowBestBorder
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={styles.planInfo}>
        <View style={styles.planHeader}>
          <Text style={styles.planTitle}>{pkg.packageType}</Text>
          {isBest && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>BEST VALUE</Text>
            </View>
          )}
        </View>
        <Text style={styles.planSubtitle}>+ Stars per period</Text>
      </View>
      <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
    </TouchableOpacity>
  );
};

const LifetimeRow = ({ pkg, isSelected, onSelect }: { pkg: PurchasesPackage, isSelected: boolean, onSelect: () => void }) => (
  <TouchableOpacity 
    style={[
      styles.planRow, 
      isSelected ? styles.lifetimeSelected : styles.planRowDefault,
      isSelected && styles.lifetimeSelectedBorder
    ]}
    onPress={onSelect}
    activeOpacity={0.8}
  >
    <View style={[styles.featureIconBox, { backgroundColor: 'rgba(255, 45, 85, 0.14)', width: 44, height: 44, borderRadius: 12 }]}>
      <IconSymbol name="infinity.circle.fill" size={24} color="#FF2D55" />
    </View>
    <View style={styles.planInfo}>
      <Text style={styles.planTitle}>Lifetime</Text>
      <Text style={styles.planSubtitle}>One-time purchase • Forever access</Text>
    </View>
    <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
  </TouchableOpacity>
);

const PackRow = ({ pkg, icon, iconColor, onPurchase, isPurchasing }: { pkg: PurchasesPackage, icon: string, iconColor: string, onPurchase: () => void, isPurchasing: boolean }) => (
  <TouchableOpacity 
    style={styles.packRow}
    onPress={onPurchase}
    disabled={isPurchasing}
    activeOpacity={0.8}
  >
    <View style={[styles.featureIconBox, { backgroundColor: `${iconColor}22`, width: 44, height: 44, borderRadius: 12 }]}>
      <IconSymbol name={icon as any} size={24} color={iconColor} />
    </View>
    <View style={styles.planInfo}>
      <Text style={styles.planTitle}>{pkg.product.title}</Text>
      <Text style={styles.planSubtitle}>One-time purchase</Text>
    </View>
    <Text style={styles.packPrice}>{pkg.product.priceString}</Text>
  </TouchableOpacity>
);


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 10,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 22,
  },
  heroSection: {
    alignItems: 'center',
    gap: 14,
    paddingTop: 4,
  },
  iconContainer: {
    width: 110,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#333',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 4,
  },
  tabText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '600',
  },
  sectionContainer: {
    gap: 16,
  },
  featuresBlock: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  planRowDefault: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  planRowSelected: {
    backgroundColor: 'rgba(255, 165, 0, 0.22)',
  },
  planRowSelectedBorder: {
    borderColor: 'rgba(255, 165, 0, 0.6)',
    borderWidth: 2,
  },
  planRowBestBorder: {
    borderColor: 'rgba(52, 199, 89, 0.5)',
    borderWidth: 1.5,
  },
  lifetimeSelected: {
    backgroundColor: 'rgba(255, 45, 85, 0.22)',
  },
  lifetimeSelectedBorder: {
    borderColor: 'rgba(255, 45, 85, 0.6)',
    borderWidth: 2,
  },
  planInfo: {
    flex: 1,
    gap: 4,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planTitle: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  badgeContainer: {
    backgroundColor: Colors.green,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  planSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  planPrice: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  ctaText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  sectionHeader: {
    gap: 6,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 8,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  packPrice: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  restoreButton: {
    alignSelf: 'center',
    marginTop: 10,
  },
  restoreText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  legalContainer: {
    gap: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  legalDisclaimer: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  legalLink: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  legalDot: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
  }
});
