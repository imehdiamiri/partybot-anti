import { Colors } from '@/src/theme/Colors';
import { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GlowView } from '@/src/components/ui/GlowView';
import { usePaywallStore } from '@/src/store/usePaywallStore';
import { showToast } from '@/src/components/ToastOverlay';
import { AppConstants } from '@/src/constants/AppConstants';

/**
 * PurchaseDetailScreen — detail sheet for a single RevenueCat package.
 *
 * Routing:
 *   router.push({ pathname: '/purchase-detail', params: { identifier: pkg.identifier } })
 *
 * Falls back to the first subscription package if no identifier is passed.
 */

type Kind = 'subscription' | 'starPack' | 'lifetime' | 'donation';

interface Benefit { icon: string; color: string; text: string }

const TIER_ACCENT: Record<string, { color: string; icon: string; label: string }> = {
  WEEKLY:   { color: '#FF6B6B', icon: 'flame.fill', label: 'Weekly' },
  MONTHLY:  { color: '#4ECDC4', icon: 'star.fill',  label: 'Monthly' },
  ANNUAL:   { color: '#FFD93D', icon: 'crown.fill', label: 'Yearly' },
  LIFETIME: { color: '#C084FC', icon: 'infinity',   label: 'Lifetime' },
};

function classifyPackage(pkg: any): { kind: Kind; accent: string; icon: string; title: string } {
  const type = pkg?.packageType ?? 'CUSTOM';
  if (type === 'LIFETIME') {
    return { kind: 'lifetime', accent: TIER_ACCENT.LIFETIME.color, icon: 'infinity', title: 'Lifetime' };
  }
  if (['WEEKLY', 'MONTHLY', 'ANNUAL'].includes(type)) {
    const t = TIER_ACCENT[type];
    return { kind: 'subscription', accent: t.color, icon: t.icon, title: pkg?.product?.title || t.label };
  }
  if (typeof pkg?.identifier === 'string' && /donat/i.test(pkg.identifier)) {
    return { kind: 'donation', accent: Colors.pink, icon: 'heart.fill', title: pkg?.product?.title || 'Support PartyBot' };
  }
  return { kind: 'starPack', accent: Colors.orange, icon: 'star.fill', title: pkg?.product?.title || 'Stars' };
}

function buildBenefits(pkg: any, kind: Kind): Benefit[] {
  if (kind === 'subscription' || kind === 'lifetime') {
    const items: Benefit[] = [
      { icon: 'gamecontroller.fill', color: '#007AFF', text: 'All Premium games unlocked' },
      { icon: 'sparkles', color: Colors.yellow, text: 'AI cards cost 1 Star instead of 5' },
      { icon: 'star.fill', color: Colors.orange, text: 'Bonus Stars credited every period' },
    ];
    if (kind === 'lifetime') items.push({ icon: 'infinity', color: '#FF2D55', text: 'Pay once, keep forever' });
    return items;
  }
  if (kind === 'donation') {
    return [
      { icon: 'heart.fill', color: Colors.pink, text: 'Support ongoing development' },
      { icon: 'sparkles', color: '#AF52DE', text: 'Help us ship more games' },
    ];
  }
  return [
    { icon: 'star.fill', color: Colors.orange, text: `${pkg?.product?.title || 'Stars'} added to your wallet` },
    { icon: 'bolt.fill', color: '#007AFF', text: 'Instant delivery after purchase' },
    { icon: 'sparkles', color: Colors.yellow, text: 'Spend Stars on AI-generated cards' },
  ];
}

export default function PurchaseDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { identifier } = useLocalSearchParams<{ identifier?: string }>();
  const { isPurchasing, restorePurchases, purchasePackage, packages } = usePaywallStore();

  const pkg = useMemo(() => {
    if (identifier) {
      return packages.find((p) => p.identifier === identifier) || null;
    }
    return packages.find((p) => p.packageType === 'ANNUAL') || packages[0] || null;
  }, [identifier, packages]);

  const safeBack = () => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } };

  if (!pkg) {
    return (
      <View style={styles.container}>
        <AppBackgroundView />
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={safeBack} style={styles.closeBtn}>
            <IconSymbol name="xmark" size={14} color="#007AFF" />
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <ActivityIndicator color="#fff" />
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' }}>
            Loading offerings…{'\n'}If this persists, check the App Store / RevenueCat configuration.
          </Text>
        </View>
      </View>
    );
  }

  const { kind, accent, icon, title } = classifyPackage(pkg);
  const price = pkg.product?.priceString || '—';
  const subtitle = kind === 'lifetime'
    ? 'One-time • Forever access'
    : kind === 'subscription'
      ? `Auto-renews ${(pkg.packageType || '').toLowerCase()}`
      : kind === 'donation'
        ? 'One-time tip'
        : 'One-time purchase';
  const benefits = buildBenefits(pkg, kind);
  const buyLabel = kind === 'subscription'
    ? `Subscribe — ${price}`
    : kind === 'lifetime'
      ? `Buy Lifetime — ${price}`
      : kind === 'donation'
        ? `Tip — ${price}`
        : `Buy — ${price}`;
  const legal = kind === 'subscription'
    ? 'Subscriptions auto-renew unless cancelled 24h before period end. Payment is charged to your Apple ID. Stars remain in your wallet after subscription ends.'
    : 'Payment is charged to your Apple ID. Stars and one-time purchases are non-refundable and can only be used in this app.';

  const handlePurchase = async () => {
    const ok = await purchasePackage(pkg);
    if (ok) {
      showToast.success('Purchase complete!');
      safeBack();
    }
  };

  const handleRestore = async () => {
    const ok = await restorePurchases();
    if (ok) {
      showToast.success('Purchases restored!');
      safeBack();
    }
  };

  return (
    <View style={styles.container}>
      <AppBackgroundView />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={safeBack} style={styles.closeBtn}>
          <IconSymbol name="xmark" size={14} color="#007AFF" />
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 50, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <GlowView color={accent} size={180} style={{ position: 'absolute' }} />
            <LinearGradient
              colors={[accent, `${accent}B0`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <IconSymbol name={icon as any} size={42} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceText}>{price}</Text>
          </View>
        </View>

        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsLabel}>WHAT YOU GET</Text>
          {benefits.map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: `${b.color}28` }]}>
                <IconSymbol name={b.icon as any} size={16} color={b.color} />
              </View>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.buyBtn, isPurchasing && styles.buyBtnDisabled]}
          onPress={handlePurchase}
          disabled={isPurchasing}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[accent, `${accent}C0`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buyGradient}
          >
            {isPurchasing ? <ActivityIndicator color="#fff" size="small" /> : null}
            <Text style={styles.buyText}>{buyLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>

        <Text style={styles.legalText}>{legal}</Text>

        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => Linking.openURL(AppConstants.URLs.privacyPolicy)}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>•</Text>
          <TouchableOpacity onPress={() => Linking.openURL(AppConstants.URLs.termsOfService)}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  closeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  closeBtnText: { color: '#007AFF', fontSize: 17, fontWeight: '400', marginLeft: 4 },
  scroll: { paddingHorizontal: 20 },
  hero: { alignItems: 'center', marginBottom: 24 },
  iconCircle: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroSubtitle: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  priceText: { fontSize: 34, fontWeight: '900', color: '#fff' },
  benefitsCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 20,
  },
  benefitsLabel: {
    fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2, marginBottom: 14,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  benefitIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  benefitText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.85)', flex: 1 },
  buyBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  buyBtnDisabled: { opacity: 0.55 },
  buyGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  buyText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  restoreBtn: { alignItems: 'center', marginBottom: 20 },
  restoreText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.35)' },
  legalText: { fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 14, marginBottom: 10 },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  linkText: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.35)' },
  legalDot: { fontSize: 11, color: 'rgba(255,255,255,0.2)' },
});
