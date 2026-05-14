import { Colors } from '@/src/theme/Colors';
import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Share, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { LiquidGlass } from '@/src/components/LiquidGlass';
import { IconSymbol } from '@/components/ui/icon-symbol';

import { useFriendsStore } from '@/src/store/useFriendsStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { showToast } from '@/src/components/ToastOverlay';
import { ReportUserSheet } from '@/src/components/ReportUserSheet';

// Platform-safe BlurView
let BlurViewComponent: any = null;
if (Platform.OS === 'ios') {
  try { BlurViewComponent = require('expo-blur').BlurView; } catch {}
}
const SurfaceBlur = ({ style, children, intensity = 25 }: any) => {
  if (Platform.OS === 'ios' && BlurViewComponent) {
    return <BlurViewComponent intensity={intensity} tint="dark" style={style}>{children}</BlurViewComponent>;
  }
  return <View style={[style, { backgroundColor: 'rgba(20,20,30,0.92)' }]}>{children}</View>;
};

type TabKey = 'offline' | 'online' | 'rooms';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { offlineFriends, addOfflineFriend, updateOfflineFriend, removeOfflineFriend,
          onlineFriends, friendRequests: requests,
          searchResults, isSearching, searchFriends,
          sendFriendRequest, acceptRequest, declineRequest,
          loadFriends, loadFriendRequests } = useFriendsStore();
  const { currentUser } = useAuthStore();
  const currentUserId = currentUser?.uid || null;

  const [activeTab, setActiveTab] = useState<TabKey>('offline');

  const [draftFriendName, setDraftFriendName] = useState<string>('');
  const [editingOfflineFriendID, setEditingOfflineFriendID] = useState<string | null>(null);
  const [editingOfflineFriendName, setEditingOfflineFriendName] = useState<string>('');

  const [searchText, setSearchText] = useState<string>('');
  // Reachable App-Store-compliant report/block flow from the only social
  // surface we ship today.
  const [reportTarget, setReportTarget] = useState<{ uid: string; name: string } | null>(null);

  useEffect(() => {
    if (currentUserId) {
      loadFriends(currentUserId);
      loadFriendRequests(currentUserId);
    }
  }, [currentUserId]);

  const handleAddOfflineFriend = () => {
    const trimmed = draftFriendName.trim();
    if (!trimmed) {
      showToast.warning('Please enter a name');
      return;
    }
    if (offlineFriends.length >= 12) {
      showToast.warning('Maximum 12 players reached');
      return;
    }
    if (offlineFriends.some(f => f.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast.warning('This name already exists!');
      return;
    }
    addOfflineFriend(trimmed);
    // Verify it was actually added (store may reject silently)
    const updated = useFriendsStore.getState().offlineFriends;
    if (updated.some(f => f.name.toLowerCase() === trimmed.toLowerCase())) {
      setDraftFriendName('');
      showToast.success(`${trimmed} added!`);
    } else {
      showToast.error('Could not add player');
    }
  };

  const handleSaveEditOfflineFriend = () => {
    const trimmed = editingOfflineFriendName.trim();
    if (!trimmed || !editingOfflineFriendID) return;
    if (offlineFriends.some(f => f.id !== editingOfflineFriendID && f.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast.warning('This name already exists!');
      return;
    }
    updateOfflineFriend(editingOfflineFriendID, trimmed);
    setEditingOfflineFriendID(null);
    setEditingOfflineFriendName('');
  };

  const handleShareInvite = async () => {
    try {
      await Share.share({
        message: "Let's play PartyBot together! Download: https://www.partybot.games",
      });
    } catch (error) {
      console.log(error);
    }
  };

  const Avatar = ({ title, isOnline = false, size = 32 }: { title: string; isOnline?: boolean; size?: number }) => (
    <View style={[styles.avatarContainer, { width: size, height: size }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {title.charAt(0).toUpperCase()}
      </Text>
      {isOnline && (
        <View style={[styles.onlineDot, { width: Math.max(8, size * 0.28), height: Math.max(8, size * 0.28) }]} />
      )}
    </View>
  );

  const tabs: { key: TabKey; label: string; icon: any; count?: number }[] = [
    { key: 'offline', label: 'Local', icon: 'person.crop.circle', count: offlineFriends.length },
    { key: 'online', label: 'Online', icon: 'globe', count: onlineFriends.length },
    { key: 'rooms', label: 'Rooms', icon: 'person.3.fill' },
  ];

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 6, paddingBottom: 120 }]}
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
          <View style={{ flex: 1 }} />
          {requests.length > 0 && (
            <TouchableOpacity 
              style={styles.notificationBadge}
              onPress={() => setActiveTab('online')}
              activeOpacity={0.8}
            >
              <IconSymbol name="bell.badge.fill" size={12} color={Colors.orange} />
              <Text style={styles.notificationText}>{requests.length}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.85}>
            <LiquidGlass variant="mid" radius={20} style={styles.profileButton} shadow={false}>
              <IconSymbol name="person.crop.circle" size={22} color="white" />
            </LiquidGlass>
          </TouchableOpacity>
        </View>

        {/* Quick Join — compact hero */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/lobby/join')}>
          <SurfaceBlur intensity={30} style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <IconSymbol name="number.square.fill" size={20} color={Colors.blue} />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>Join with Code</Text>
              <Text style={styles.heroSubtitle}>Enter a room code</Text>
            </View>
            <View style={styles.heroButton}>
              <IconSymbol name="arrow.right" size={14} color="white" />
            </View>
          </SurfaceBlur>
        </TouchableOpacity>

        {/* Segmented tab bar — pill style matching Games screen */}
        <View style={styles.libraryTabsContainer}>
          <LiquidGlass variant="high" radius={30} style={styles.libraryTabsWrapperOuter} shadow>
            <View style={styles.libraryTabsInner}>
              {tabs.map((t) => {
                const active = activeTab === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.libraryTab, active && styles.libraryTabActive]}
                    onPress={() => setActiveTab(t.key)}
                    activeOpacity={0.85}
                  >
                    <IconSymbol name={t.icon} size={14} color={active ? 'white' : 'rgba(255,255,255,0.6)'} weight="bold" />
                    <Text style={active ? styles.libraryTabTextActive : styles.libraryTabText}>{t.label}</Text>
                    {typeof t.count === 'number' && t.count > 0 && (
                      <View style={[styles.segmentCount, active && styles.segmentCountActive]}>
                        <Text style={[styles.segmentCountText, active && styles.segmentCountTextActive]}>{t.count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </LiquidGlass>
        </View>

        {/* ── OFFLINE TAB ── */}
        {activeTab === 'offline' && (
          <View style={styles.tabContent}>
            <SurfaceBlur style={styles.surfaceCard}>
              <View style={styles.addFriendRow}>
                <TextInput 
                  style={styles.inputField}
                  placeholder="Add a name"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoCapitalize="words"
                  value={draftFriendName}
                  onChangeText={setDraftFriendName}
                  onSubmitEditing={handleAddOfflineFriend}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addBtn} onPress={handleAddOfflineFriend}>
                  <IconSymbol name="plus" size={18} color="white" />
                </TouchableOpacity>
              </View>

              {offlineFriends.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <IconSymbol name="person.crop.circle.badge.plus" size={28} color="rgba(255,255,255,0.35)" />
                  <Text style={styles.emptyStateText}>No names yet</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {offlineFriends.map((friend: any, index: number) => (
                    <View key={friend.id}>
                      {editingOfflineFriendID === friend.id ? (
                        <View style={styles.addFriendRow}>
                          <TextInput 
                            style={styles.inputField}
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            autoCapitalize="words"
                            value={editingOfflineFriendName}
                            onChangeText={setEditingOfflineFriendName}
                            autoFocus
                          />
                          <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.green }]} onPress={handleSaveEditOfflineFriend}>
                            <IconSymbol name="checkmark" size={16} color="white" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.friendRow}>
                          <Avatar title={friend.name} size={30} />
                          <Text style={styles.friendName} numberOfLines={1}>{friend.name}</Text>
                          {friend.id === 'me' && (
                            <View style={styles.meBadge}>
                              <Text style={styles.meBadgeText}>me</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }} />
                          {friend.id !== 'me' && (
                            <View style={styles.friendActions}>
                              <TouchableOpacity 
                                style={styles.iconBtn}
                                onPress={() => {
                                  setEditingOfflineFriendID(friend.id);
                                  setEditingOfflineFriendName(friend.name);
                                }}
                              >
                                <IconSymbol name="pencil" size={13} color="rgba(255,255,255,0.7)" />
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={styles.iconBtn}
                                onPress={() => removeOfflineFriend(friend.id)}
                              >
                                <IconSymbol name="trash" size={13} color="rgba(255, 69, 58, 0.85)" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}
                      {index < offlineFriends.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))}
                </View>
              )}
            </SurfaceBlur>
          </View>
        )}

        {/* ── ONLINE TAB ── */}
        {activeTab === 'online' && (
          <View style={styles.tabContent}>
            {/* Search card */}
            <SurfaceBlur style={styles.surfaceCard}>
              <View style={styles.searchRow}>
                <IconSymbol name="magnifyingglass" size={15} color="rgba(255,255,255,0.5)" />
                <TextInput 
                  style={styles.searchInput}
                  placeholder="Search by username or email"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={searchText}
                  onChangeText={(text) => {
                    setSearchText(text);
                    if (currentUserId && text.trim().length > 1) {
                      searchFriends(text.trim(), currentUserId);
                    }
                  }}
                  returnKeyType="search"
                />
                {searchText.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchText('')}>
                    <IconSymbol name="xmark.circle.fill" size={16} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                )}
              </View>

              {searchText.trim().length > 0 && (
                <View style={styles.searchResultsSection}>
                  {!currentUserId ? (
                    <TouchableOpacity onPress={() => router.push('/auth')}>
                      <Text style={[styles.noMatchesText, { color: Colors.blue }]}>Log in to search</Text>
                    </TouchableOpacity>
                  ) : isSearching ? (
                    <Text style={styles.noMatchesText}>Searching…</Text>
                  ) : searchResults.length === 0 ? (
                    <Text style={styles.noMatchesText}>No users found</Text>
                  ) : (
                    searchResults.map((result) => (
                      <View key={result.id} style={styles.friendRow}>
                        <Avatar title={result.username} size={28} />
                        <Text style={styles.friendName} numberOfLines={1}>{result.username}</Text>
                        <View style={{ flex: 1 }} />
                        {result.relationshipState === 'friends' ? (
                          <Text style={[styles.statusTag, { color: Colors.green }]}>Friends</Text>
                        ) : result.relationshipState === 'pendingOutgoing' ? (
                          <Text style={[styles.statusTag, { color: Colors.orange }]}>Pending</Text>
                        ) : result.relationshipState === 'pendingIncoming' ? (
                          <TouchableOpacity 
                            style={[styles.invitePillButton, { backgroundColor: Colors.green }]}
                            onPress={() => {
                              const req = requests.find(r => r.fromUserId === result.id);
                              if (req && currentUserId) acceptRequest(req.id, currentUserId);
                            }}
                          >
                            <Text style={styles.invitePillButtonText}>Accept</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            style={styles.invitePillButton}
                            onPress={() => currentUserId && sendFriendRequest(currentUserId, result.id)}
                          >
                            <Text style={styles.invitePillButtonText}>Add</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => setReportTarget({ uid: result.id, name: result.username })}
                          style={{ marginLeft: 6, padding: 6 }}
                          accessibilityLabel={`Report ${result.username}`}
                        >
                          <IconSymbol name="flag" size={13} color="rgba(255,255,255,0.45)" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}
            </SurfaceBlur>

            {/* Friend Requests card */}
            {requests.length > 0 && (
              <SurfaceBlur style={[styles.surfaceCard, { marginTop: 12 }]}>
                <View style={styles.cardHeaderRow}>
                  <IconSymbol name="bell.badge.fill" size={14} color={Colors.orange} />
                  <Text style={styles.cardHeaderText}>Requests · {requests.length}</Text>
                </View>
                {requests.map((req, idx) => (
                  <View key={req.id}>
                    <View style={styles.friendRow}>
                      <Avatar title={req.fromUsername} size={30} />
                      <Text style={styles.friendName} numberOfLines={1}>{req.fromUsername}</Text>
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity 
                        style={[styles.invitePillButton, { backgroundColor: Colors.green, marginRight: 6 }]}
                        onPress={() => currentUserId && acceptRequest(req.id, currentUserId)}
                      >
                        <Text style={styles.invitePillButtonText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.invitePillButton, { backgroundColor: 'rgba(255,59,48,0.18)' }]}
                        onPress={() => declineRequest(req.id)}
                      >
                        <Text style={[styles.invitePillButtonText, { color: Colors.red }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                    {idx < requests.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </SurfaceBlur>
            )}

            {/* Friends list card */}
            <SurfaceBlur style={[styles.surfaceCard, { marginTop: 12 }]}>
              <View style={styles.cardHeaderRow}>
                <IconSymbol name="person.2.fill" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.cardHeaderText}>My Friends · {onlineFriends.length}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={handleShareInvite} style={styles.shareSmallBtn}>
                  <IconSymbol name="square.and.arrow.up" size={12} color="white" />
                  <Text style={styles.shareSmallBtnText}>Invite</Text>
                </TouchableOpacity>
              </View>

              {onlineFriends.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <IconSymbol name="person.2.fill" size={26} color="rgba(255,255,255,0.35)" />
                  <Text style={styles.emptyStateText}>No friends yet</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {onlineFriends.map((friend: any, index: number) => (
                    <View key={friend.id}>
                      <View style={styles.friendRow}>
                        <Avatar title={friend.name} isOnline={friend.isOnline} size={30} />
                        <Text style={styles.friendName} numberOfLines={1}>{friend.name}</Text>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity style={styles.invitePillButton} onPress={handleShareInvite}>
                          <Text style={styles.invitePillButtonText}>Invite</Text>
                        </TouchableOpacity>
                      </View>
                      {index < onlineFriends.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))}
                </View>
              )}
            </SurfaceBlur>
          </View>
        )}

        {/* ── ROOMS TAB ── */}
        {activeTab === 'rooms' && (
          <View style={styles.tabContent}>
            {!currentUserId && (
              <TouchableOpacity 
                style={styles.loginCard}
                onPress={() => router.push('/auth')}
                activeOpacity={0.85}
              >
                <View style={styles.loginIconWrap}>
                  <IconSymbol name="person.crop.circle" size={18} color={Colors.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loginTitle}>Sign in</Text>
                  <Text style={styles.loginSub}>Required to join public rooms</Text>
                </View>
                <IconSymbol name="arrow.right" size={14} color={Colors.blue} />
              </TouchableOpacity>
            )}

            <SurfaceBlur style={styles.surfaceCard}>
              <View style={styles.cardHeaderRow}>
                <IconSymbol name="person.3.sequence.fill" size={14} color={Colors.blue} />
                <Text style={styles.cardHeaderText}>Public Rooms</Text>
              </View>
              <View style={styles.emptyStateContainer}>
                <IconSymbol name="person.3.sequence.fill" size={28} color="rgba(10, 132, 255, 0.6)" />
                <Text style={styles.emptyStateText}>No rooms yet</Text>
                <Text style={styles.emptyStateSubText}>Create one from any multiplayer game</Text>
              </View>
            </SurfaceBlur>
          </View>
        )}
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
    marginBottom: 16,
    gap: 10,
  },
  title: {
    fontFamily: 'Viral-Black',
    fontSize: 28,
    color: 'white',
  },
  notificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 149, 0, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  notificationText: {
    color: Colors.orange,
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hero
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.25)',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: Colors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  heroTextContainer: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
  },
  heroButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Segmented tabs — pill style matching Games screen
  libraryTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  libraryTabsWrapperOuter: {
    borderRadius: 30,
    padding: 4,
    width: '100%',
  },
  libraryTabsInner: {
    flexDirection: 'row',
  },
  libraryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  libraryTabActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.95)',
    shadowColor: Colors.blue,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  libraryTabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  libraryTabTextActive: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentCount: {
    minWidth: 18,
    paddingHorizontal: 5,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentCountActive: {
    backgroundColor: Colors.blue,
  },
  segmentCountText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: 'bold',
  },
  segmentCountTextActive: {
    color: 'white',
  },

  tabContent: {
    gap: 0,
  },

  // Cards
  surfaceCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cardHeaderText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },

  addFriendRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inputField: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: 'white',
    fontSize: 14,
  },
  addBtn: {
    width: 44,
    height: 44,
    backgroundColor: Colors.blue,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    paddingVertical: 4,
  },

  searchResultsSection: {
    marginTop: 10,
  },

  listContainer: {
    flexDirection: 'column',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  friendName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  meBadge: {
    backgroundColor: 'rgba(10, 132, 255, 0.18)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  meBadgeText: {
    color: Colors.blue,
    fontSize: 10,
    fontWeight: 'bold',
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 2,
  },
  avatarContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.green,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.7)',
  },

  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 22,
    gap: 6,
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyStateSubText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
  },

  invitePillButton: {
    backgroundColor: Colors.blue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  invitePillButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusTag: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  noMatchesText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    paddingVertical: 4,
  },

  shareSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.blue,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  shareSmallBtnText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },

  loginCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  loginIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 132, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loginSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
  },
});
