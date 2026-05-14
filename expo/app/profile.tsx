import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  TextInput,
  Linking,
  Switch,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { Colors } from '@/src/theme/Colors';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useGameStore } from '@/src/store/useGameStore';
import { usePaywallStore } from '@/src/store/usePaywallStore';
import { useEconomyStore } from '@/src/store/useEconomyStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { AppConstants } from '@/src/constants/AppConstants';

// Platform-safe BlurView
let BlurViewComponent: any = null;
if (Platform.OS === 'ios') {
  try { BlurViewComponent = require('expo-blur').BlurView; } catch {}
}
const SurfaceCard = ({ children, style }: { children: React.ReactNode; style?: any }) => {
  if (Platform.OS === 'ios' && BlurViewComponent) {
    return <BlurViewComponent tint="dark" intensity={40} style={[styles.surfaceCard, style]}>{children}</BlurViewComponent>;
  }
  return <View style={[styles.surfaceCard, style, { backgroundColor: 'rgba(20,20,30,0.92)' }]}>{children}</View>;
};

const SectionHeaderView = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
  </View>
);

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { authAccount, signOut } = useAuthStore();
  const safeBack = () => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } };
  const isGuest = authAccount?.provider === 'guest';
  const { activeSession, exitActiveSession } = useGameStore();
  const { restorePurchases, packages, getSubscriptionPackages, getLifetimePackage, getStarPackages } = usePaywallStore();
  const { starsBalance: stars, isPremium } = useEconomyStore();
  const { isSoundEnabled, setSoundEnabled, isVibrationEnabled, setVibrationEnabled } = useSettingsStore();

  const [username, setUsername] = useState(authAccount?.username || 'Guest');
  
  const handleLogout = () => {
    if (activeSession) {
      Alert.alert(
        'Exit active game?',
        'You have an active game session. Logging out will end the game.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Logout & Exit Game', 
            style: 'destructive',
            onPress: () => {
              exitActiveSession();
              signOut();
              safeBack();
            }
          }
        ]
      );
    } else {
      signOut();
      safeBack();
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account?',
      'This will permanently delete your account, wallet, friends, invite history, and any rooms you host. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            // Second confirmation — App Store reviewers expect a deliberate flow.
            Alert.alert(
              'Are you sure?',
              'There is no recovery. Your username, stars, and Premium entitlement will be removed.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete my account',
                  style: 'destructive',
                  onPress: async () => {
                    if (isDeleting) return;
                    setIsDeleting(true);
                    if (activeSession) exitActiveSession();
                    try {
                      // Server-authoritative wipe (friendships, rooms, presence,
                      // wallet, invite stats, RC mirror, auth record).
                      const { httpsCallable } = await import('firebase/functions');
                      const { functions, auth } = await import('@/src/lib/firebase');
                      const fn = httpsCallable(functions, 'deleteAccount');
                      await fn({});
                      // After deleteAccount succeeds the auth record is gone;
                      // signOut clears local state regardless.
                      try { await auth.signOut(); } catch {}
                    } catch (e: any) {
                      Alert.alert('Could not delete account', e?.message || 'Try again in a moment.');
                      setIsDeleting(false);
                      return;
                    }
                    await signOut().catch(() => {});

                    // Treat the device like a fresh install: nuke every
                    // persisted store + cached multiplayer/economy/friend
                    // surface so a future signup doesn't inherit the deleted
                    // user's state.
                    try {
                      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                      const keys = await AsyncStorage.getAllKeys();
                      const drop = keys.filter((k) =>
                        k.startsWith('friends-storage') ||
                        k.startsWith('settings-') ||
                        k.startsWith('paywall-') ||
                        k.startsWith('economy-') ||
                        k.startsWith('game-') ||
                        k.startsWith('multiplayer-') ||
                        k.startsWith('rork-') ||
                        k.startsWith('partybot-')
                      );
                      if (drop.length > 0) await AsyncStorage.multiRemove(drop);
                    } catch {}
                    try {
                      const { useFriendsStore } = await import('@/src/store/useFriendsStore');
                      useFriendsStore.setState({
                        onlineFriends: [], friendRequests: [], searchResults: [],
                        offlineFriends: [], inviteCode: '',
                      });
                    } catch {}
                    try {
                      const { useMultiplayerStore } = await import('@/src/store/useMultiplayerStore');
                      await useMultiplayerStore.getState().leaveRoom().catch(() => {});
                    } catch {}

                    setIsDeleting(false);
                    router.replace('/onboarding');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleLogin = () => {
    if (activeSession) {
      Alert.alert(
        'Exit active game?',
        'You have an active game session. Going to login will end the game.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Go to Login & Exit Game', 
            style: 'destructive',
            onPress: () => {
              exitActiveSession();
              router.replace('/auth');
            }
          }
        ]
      );
    } else {
      router.replace('/auth');
    }
  };

  // Compact Identity Card
  const renderIdentityCard = () => (
    <SurfaceCard>
      <View style={styles.identityRow}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.cameraIconContainer}>
            <Ionicons name="camera" size={10} color={Colors.white} />
          </View>
        </View>

        <View style={styles.identityDetails}>
          <Text style={styles.identityUsername} numberOfLines={1}>
            {isGuest ? 'Guest' : `@${username}`}
          </Text>
          <View style={styles.identityStatusRow}>
            <View style={[styles.statusDot, { backgroundColor: isGuest ? Colors.orange : Colors.green }]} />
            <Text style={styles.identityStatusText}>
              {isGuest ? 'Not logged in' : 'Email account'}
            </Text>
          </View>
          {!isGuest && authAccount?.id && (
            <Text style={styles.identityIdText}>ID #{authAccount.id.substring(0, 8)}</Text>
          )}
        </View>
      </View>
    </SurfaceCard>
  );

  // Login Prompt Card
  const renderLoginPrompt = () => (
    <TouchableOpacity style={styles.primaryActionBtn} onPress={handleLogin}>
      <Text style={styles.primaryActionText}>Login or Sign Up</Text>
    </TouchableOpacity>
  );

  // Wallet Section
  const renderWalletSection = () => (
    <View style={styles.sectionContainer}>
      <SectionHeaderView title="Wallet" subtitle="Stars, membership, and unlocks." />
      
      <SurfaceCard style={styles.walletCardRow}>
        <View style={styles.walletIconContainer}>
          <Ionicons name="star" size={20} color={Colors.orange} />
        </View>
        <View style={styles.walletTextContainer}>
          <Text style={styles.walletBalanceLabel}>Stars balance</Text>
          <Text style={styles.walletBalanceValue}>{stars.toLocaleString()}</Text>
        </View>
        <Text style={styles.walletPublicRooms}>Public Rooms</Text>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.walletCardRow}>
          <View style={[styles.walletIconContainer, { backgroundColor: Colors.whiteOverlay6 }]}>
            <Ionicons name={isPremium ? "star" : "lock-closed"} size={20} color={isPremium ? Colors.orange : Colors.secondary} />
          </View>
          <View style={styles.walletTextContainer}>
            <Text style={styles.walletBalanceLabel}>Membership</Text>
            <Text style={styles.walletMembershipValue}>
              {isPremium ? 'Premium \u2022 Active' : 'Free plan'}
            </Text>
          </View>
        </View>
        
        <View style={styles.plansContainer}>
          {(() => {
            const subs = getSubscriptionPackages();
            const lifetime = getLifetimePackage();
            const subColor: Record<string, string> = { WEEKLY: Colors.blue, MONTHLY: Colors.orange, ANNUAL: Colors.purple };
            if (subs.length === 0 && !lifetime) {
              return <Text style={styles.planSubtitle}>Plans appear here once the App Store finishes loading.</Text>;
            }
            return (
              <>
                {subs.map((p) => (
                  <PlanRow
                    key={p.identifier}
                    title={p.product?.title || p.packageType}
                    price={p.product?.priceString || ''}
                    color={subColor[p.packageType as string] || Colors.blue}
                    badge={p.packageType === 'ANNUAL' ? 'BEST VALUE' : undefined}
                    onPress={() => router.push({ pathname: '/purchase-detail', params: { identifier: p.identifier } })}
                  />
                ))}
                {lifetime && (
                  <PlanRow
                    title={lifetime.product?.title || 'Lifetime'}
                    subtitle="One-time • Forever"
                    price={lifetime.product?.priceString || ''}
                    color={Colors.red}
                    onPress={() => router.push({ pathname: '/purchase-detail', params: { identifier: lifetime.identifier } })}
                  />
                )}
              </>
            );
          })()}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeaderView title="Star Packs" subtitle="Tap to purchase." />
        <View style={styles.plansContainer}>
          {(() => {
            const packs = getStarPackages();
            if (packs.length === 0) {
              return <Text style={styles.planSubtitle}>Star packs appear here once the store loads.</Text>;
            }
            const biggestPriceCents = Math.max(...packs.map((p) => Number(p.product?.price ?? 0)));
            return packs.map((p) => (
              <PackRow
                key={p.identifier}
                title={p.product?.title || p.identifier}
                price={p.product?.priceString || ''}
                isBest={Number(p.product?.price ?? 0) === biggestPriceCents}
                onPress={() => router.push({ pathname: '/purchase-detail', params: { identifier: p.identifier } })}
              />
            ));
          })()}
        </View>
      </SurfaceCard>

      <TouchableOpacity style={styles.restoreBtn} onPress={() => restorePurchases()}>
        <Ionicons name="refresh" size={14} color={Colors.secondary} />
        <Text style={styles.restoreBtnText}>Restore Purchases</Text>
      </TouchableOpacity>
    </View>
  );

  // Invite Section
  const renderInviteSection = () => (
    <SurfaceCard style={{ marginBottom: 16 }}>
      <TouchableOpacity style={styles.prefRow} onPress={() => router.push('/invite')}>
        <View style={styles.prefLeft}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255, 45, 85, 0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="gift" size={16} color={Colors.pink} />
          </View>
          <View>
            <Text style={styles.prefText}>Invite & Earn Stars</Text>
            <Text style={{ color: Colors.secondary, fontSize: 12 }}>Share your code to get +30 ★</Text>
          </View>
        </View>
        <Ionicons name="arrow-forward" size={14} color={Colors.secondary} />
      </TouchableOpacity>
    </SurfaceCard>
  );

  // Preferences Card
  const renderPreferences = () => (
    <SurfaceCard>
      <SectionHeaderView title="Preferences" subtitle="Sound and feedback settings." />
      
      <View style={styles.prefRow}>
        <View style={styles.prefLeft}>
          <Ionicons name="volume-high" size={20} color={Colors.white} />
          <Text style={styles.prefText}>Sound</Text>
        </View>
        <Switch 
          value={isSoundEnabled} 
          onValueChange={setSoundEnabled}
          trackColor={{ false: Colors.whiteOverlay8, true: Colors.green }}
          thumbColor={Colors.white}
        />
      </View>

      <View style={styles.prefRow}>
        <View style={styles.prefLeft}>
          <Ionicons name="phone-portrait-outline" size={20} color={Colors.white} />
          <Text style={styles.prefText}>Vibration</Text>
        </View>
        <Switch 
          value={isVibrationEnabled} 
          onValueChange={setVibrationEnabled}
          trackColor={{ false: Colors.whiteOverlay8, true: Colors.green }}
          thumbColor={Colors.white}
        />
      </View>

      <View style={styles.prefDivider} />

      <TouchableOpacity style={styles.prefRow} onPress={() => Linking.openURL(AppConstants.URLs.privacyPolicy)}>
        <View style={styles.prefLeft}>
          <Ionicons name="hand-right" size={20} color={Colors.white} />
          <Text style={styles.prefText}>Privacy Policy</Text>
        </View>
        <Ionicons name="arrow-forward" size={14} color={Colors.secondary} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.prefRow} onPress={() => Linking.openURL(AppConstants.URLs.termsOfService)}>
        <View style={styles.prefLeft}>
          <Ionicons name="document-text" size={20} color={Colors.white} />
          <Text style={styles.prefText}>Terms of Service</Text>
        </View>
        <Ionicons name="arrow-forward" size={14} color={Colors.secondary} />
      </TouchableOpacity>
      
      {Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.prefRow} onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}>
          <View style={styles.prefLeft}>
            <Ionicons name="card" size={20} color={Colors.white} />
            <Text style={styles.prefText}>Manage Subscription</Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color={Colors.secondary} />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.prefRow} onPress={() => restorePurchases()}>
        <View style={styles.prefLeft}>
          <Ionicons name="refresh" size={20} color={Colors.white} />
          <Text style={styles.prefText}>Restore Purchases</Text>
        </View>
      </TouchableOpacity>
    </SurfaceCard>
  );

  // Danger Zone
  const renderDangerZone = () => (
    <SurfaceCard>
      <SectionHeaderView title="Account" subtitle="Log out or permanently delete your account." />
      
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.white} />
        <Text style={styles.logoutBtnText}>Log Out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} disabled={isDeleting}>
        <Ionicons name="trash" size={20} color={Colors.red} />
        <Text style={styles.deleteBtnText}>{isDeleting ? 'Deleting…' : 'Delete Account'}</Text>
      </TouchableOpacity>
    </SurfaceCard>
  );

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      
      <Stack.Screen 
        options={{
          headerShown: true,
          title: "Profile",
          headerTransparent: true,
          headerBlurEffect: 'systemThinMaterialDark',
          headerTitleStyle: { fontFamily: 'Viral-Black', fontSize: 20, color: Colors.white },
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => safeBack()} 
              style={{ 
                marginRight: Platform.OS === 'ios' ? 0 : 16,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 8,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Done</Text>
            </TouchableOpacity>
          ),
          headerBackVisible: false,
        }}
      />

      <ScrollView 
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40, paddingTop: Platform.OS === 'ios' ? 0 : 80 }]}
      >
        {renderIdentityCard()}
        {isGuest && renderLoginPrompt()}
        {renderPreferences()}
        {renderWalletSection()}
        {!isGuest && renderInviteSection()}
        {!isGuest && renderDangerZone()}
      </ScrollView>
    </View>
  );
}

const PlanRow = ({ title, subtitle, stars, price, color, badge, onPress }: any) => (
  <TouchableOpacity style={styles.planRow} onPress={onPress}>
    <View style={styles.planRowLeft}>
      <View style={[styles.planDot, { backgroundColor: color, borderColor: color }]} />
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.planTitle}>{title}</Text>
          {badge && (
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text style={styles.planSubtitle}>{subtitle}</Text>}
        {stars && <Text style={styles.planSubtitle}>{stars}</Text>}
      </View>
    </View>
    <View style={styles.planRowRight}>
      <Text style={styles.planTitle}>{price}</Text>
      <Ionicons name="chevron-forward" size={14} color={Colors.tertiary} />
    </View>
  </TouchableOpacity>
);

const PackRow = ({ title, subtitle, price, discount, isBest, onPress }: any) => (
  <TouchableOpacity style={[styles.packRow, isBest && styles.packRowBest]} onPress={onPress}>
    <View style={styles.packRowLeft}>
      <View style={styles.packIconContainer}>
        <Ionicons name="star" size={18} color={Colors.orange} />
      </View>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.planTitle}>{title}</Text>
          {isBest && (
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>BEST VALUE</Text>
            </View>
          )}
        </View>
        {discount && <Text style={styles.packDiscount}>{discount}</Text>}
        {subtitle && <Text style={styles.planSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    <Text style={[styles.planTitle, { fontSize: 16 }]}>{price}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteOverlay8,
  },
  headerTitle: {
    fontFamily: 'Viral-Black',
    color: Colors.white,
    fontSize: 20,
  },
  headerDoneBtn: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  headerDoneText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  surfaceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  sectionContainer: {
    gap: 10,
  },
  sectionHeader: {
    marginBottom: 4,
  },
  sectionTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: Colors.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarContainer: {
    width: 58,
    height: 58,
  },
  avatarPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.whiteOverlay8,
  },
  avatarText: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '600',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityDetails: {
    flex: 1,
    gap: 3,
  },
  identityUsername: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  identityStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  identityStatusText: {
    color: Colors.secondary,
    fontSize: 12,
  },
  identityIdText: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  primaryActionBtn: {
    backgroundColor: Colors.primaryAction,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryActionText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  walletCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  walletIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,165,0,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletTextContainer: {
    flex: 1,
    gap: 1,
  },
  walletBalanceLabel: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  walletBalanceValue: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: 'bold',
  },
  walletMembershipValue: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
  walletPublicRooms: {
    color: Colors.tertiary,
    fontSize: 11,
  },
  plansContainer: {
    gap: 8,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  planRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  planTitle: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
  planSubtitle: {
    color: Colors.secondary,
    fontSize: 11,
  },
  planBadge: {
    backgroundColor: Colors.green,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  planBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  planRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  packRowBest: {
    borderColor: 'rgba(76, 175, 80, 0.4)',
    borderWidth: 1.5,
  },
  packRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  packIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,165,0,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packDiscount: {
    color: Colors.green,
    fontSize: 11,
    fontWeight: 'bold',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  restoreBtnText: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prefText: {
    color: Colors.white,
    fontSize: 15,
  },
  prefDivider: {
    height: 1,
    backgroundColor: Colors.whiteOverlay8,
    marginVertical: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  logoutBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  deleteBtnText: {
    color: Colors.red,
    fontSize: 15,
    fontWeight: '600',
  },
});
