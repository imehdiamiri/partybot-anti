import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rtdb as database, functions } from '../lib/firebase';
import { ref, get as fbGet, set as fbSet, push, update as fbUpdate } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { showToast } from '../components/ToastOverlay';

/**
 * useFriendsStore — matches iOS AppViewModel+Friends + AppViewModel+Invite
 * Online friend search, friend requests, offline friends, invite codes.
 */

export interface Friend {
  id: string;
  name: string;
  isOnline: boolean;
  status: string;
  kind: 'online' | 'offline';
  publicUserID?: string;
  avatarURL?: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export interface FriendSearchResult {
  id: string;
  username: string;
  email?: string;
  publicUserID?: string;
  avatarURL?: string;
  relationshipState: 'none' | 'pendingOutgoing' | 'pendingIncoming' | 'friends';
}

interface FriendsState {
  // Online friends
  onlineFriends: Friend[];
  friendRequests: FriendRequest[];
  searchResults: FriendSearchResult[];
  isSearching: boolean;
  
  // Offline friends
  offlineFriends: Friend[];
  
  // Invite system
  inviteCode: string;
  isRedeemingInvite: boolean;
  
  // Actions — Online
  searchFriends: (queryText: string, currentUserId: string) => Promise<void>;
  sendFriendRequest: (fromUserId: string, toUserId: string) => Promise<void>;
  acceptRequest: (requestId: string, currentUserId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  loadFriends: (userId: string) => Promise<void>;
  loadFriendRequests: (userId: string) => Promise<void>;
  
  // Actions — Offline
  addOfflineFriend: (name: string) => void;
  updateOfflineFriend: (id: string, name: string) => void;
  removeOfflineFriend: (id: string) => void;
  
  // Actions — Invite
  generateInviteCode: (userId: string) => Promise<void>;
  redeemInviteCode: (code: string, userId: string) => Promise<void>;
  getInviteShareMessage: () => string;
}

export const useFriendsStore = create<FriendsState>()(
  persist(
    (set, get) => ({
      onlineFriends: [],
      friendRequests: [],
      searchResults: [],
      isSearching: false,
      offlineFriends: [],
      inviteCode: '',
      isRedeemingInvite: false,

      // ─── Online Friends ───

      searchFriends: async (queryText: string, currentUserId: string) => {
        const trimmed = queryText.trim();
        if (!trimmed) {
          set({ searchResults: [], isSearching: false });
          return;
        }
        set({ isSearching: true });
        // Pre-load the local block list so we can filter blocked users out of
        // search/invite surfaces. App Store moderation requires that blocked
        // users disappear from social entry points.
        let blockedSet = new Set<string>();
        try {
          const { moderationService } = await import('../services/ModerationService');
          blockedSet = new Set(await moderationService.listBlocked());
        } catch {}
        try {
          let rawResults: Array<{ id: string; username: string; email?: string; avatarURL?: string }> = [];

          // Try Cloud Function first (indexed, scalable)
          try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const { app } = await import('../lib/firebase');
            const functions = getFunctions(app);
            const searchUsersFn = httpsCallable(functions, 'searchUsers');
            const response = await searchUsersFn({ query: trimmed.toLowerCase() });
            rawResults = (response.data as any).results || [];
          } catch (fnError: any) {
            // Fallback: client-side search (for dev / functions not deployed)
            console.warn('searchUsers function unavailable, falling back to client scan:', fnError.message);
            const usersRef = ref(database, 'users');
            const snapshot = await fbGet(usersRef);
            if (snapshot.exists()) {
              const data = snapshot.val();
              const lowerQuery = trimmed.toLowerCase();
              for (const [uid, userData] of Object.entries(data as Record<string, any>)) {
                if (uid === currentUserId) continue;
                const username = userData.username || userData.displayName || '';
                const email = userData.email || '';
                if (username.toLowerCase().includes(lowerQuery) || email.toLowerCase().includes(lowerQuery)) {
                  rawResults.push({ id: uid, username, email });
                }
              }
            }
          }

          // Enrich with relationship state (and hide blocked users entirely).
          const results: FriendSearchResult[] = rawResults
            .filter(r => r.id !== currentUserId && !blockedSet.has(r.id))
            .slice(0, 20)
            .map(r => {
              const friends = get().onlineFriends;
              const requests = get().friendRequests;
              let state: FriendSearchResult['relationshipState'] = 'none';
              if (friends.some(f => f.id === r.id)) state = 'friends';
              else if (requests.some(req => req.fromUserId === currentUserId && req.toUserId === r.id && req.status === 'pending')) state = 'pendingOutgoing';
              else if (requests.some(req => req.fromUserId === r.id && req.toUserId === currentUserId && req.status === 'pending')) state = 'pendingIncoming';
              return { id: r.id, username: r.username, email: r.email, avatarURL: r.avatarURL, relationshipState: state };
            });

          set({ searchResults: results, isSearching: false });
        } catch (e: any) {
          set({ searchResults: [], isSearching: false });
          showToast.error(e.message);
        }
      },

      sendFriendRequest: async (fromUserId: string, toUserId: string) => {
        if (fromUserId === toUserId) return;
        try {
          const requestsRef = ref(database, 'friendRequests');
          const newRef = push(requestsRef);
          await fbSet(newRef, {
            fromUserId,
            toUserId,
            status: 'pending',
            createdAt: Date.now(),
          });
          
          set(state => ({
            searchResults: state.searchResults.map(r =>
              r.id === toUserId ? { ...r, relationshipState: 'pendingOutgoing' as const } : r
            ),
          }));
          
          showToast.success('Friend request sent!');
        } catch (e: any) {
          showToast.error(e.message);
        }
      },

      acceptRequest: async (requestId: string, currentUserId: string) => {
        try {
          const reqRef = ref(database, `friendRequests/${requestId}`);
          const snapshot = await fbGet(reqRef);
          if (!snapshot.exists()) return;
          
          const request = snapshot.val();
          await fbUpdate(reqRef, { status: 'accepted' });
          
          const friendshipData = { since: Date.now(), status: 'active' };
          await fbSet(ref(database, `friendships/${currentUserId}/${request.fromUserId}`), friendshipData);
          await fbSet(ref(database, `friendships/${request.fromUserId}/${currentUserId}`), friendshipData);
          
          set(state => ({
            friendRequests: state.friendRequests.filter(r => r.id !== requestId),
          }));
          
          showToast.success('Friend request accepted!');
          await get().loadFriends(currentUserId);
        } catch (e: any) {
          showToast.error(e.message);
        }
      },

      declineRequest: async (requestId: string) => {
        try {
          const reqRef = ref(database, `friendRequests/${requestId}`);
          await fbUpdate(reqRef, { status: 'declined' });
          set(state => ({
            friendRequests: state.friendRequests.filter(r => r.id !== requestId),
          }));
        } catch (e: any) {
          showToast.error(e.message);
        }
      },

      loadFriends: async (userId: string) => {
        try {
          const friendshipsRef = ref(database, `friendships/${userId}`);
          const snapshot = await fbGet(friendshipsRef);
          if (!snapshot.exists()) {
            set({ onlineFriends: [] });
            return;
          }
          
          const friendIds = Object.keys(snapshot.val());
          const friends: Friend[] = [];
          
          for (const fid of friendIds) {
            const userRef = ref(database, `users/${fid}`);
            const userSnap = await fbGet(userRef);
            if (userSnap.exists()) {
              const u = userSnap.val();
              friends.push({
                id: fid,
                name: u.username || u.displayName || 'Unknown',
                isOnline: false,
                status: 'Online friend',
                kind: 'online',
                avatarURL: u.avatarURL,
              });
            }
          }
          
          set({ onlineFriends: friends });
        } catch (e: any) {
          console.warn('Friends: Load failed', e);
        }
      },

      loadFriendRequests: async (userId: string) => {
        try {
          const requestsRef = ref(database, 'friendRequests');
          const snapshot = await fbGet(requestsRef);
          if (!snapshot.exists()) {
            set({ friendRequests: [] });
            return;
          }
          
          const all = snapshot.val();
          const pending: FriendRequest[] = [];
          
          for (const [id, data] of Object.entries(all as Record<string, any>)) {
            if (data.toUserId === userId && data.status === 'pending') {
              pending.push({
                id,
                fromUserId: data.fromUserId,
                fromUsername: data.fromUsername || 'Unknown',
                toUserId: data.toUserId,
                status: data.status,
                createdAt: data.createdAt,
              });
            }
          }
          
          set({ friendRequests: pending });
        } catch (e: any) {
          console.warn('Friends: Load requests failed', e);
        }
      },

      // ─── Offline Friends ───

      addOfflineFriend: (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const state = get();
        if (state.offlineFriends.length >= 12) return;
        if (state.offlineFriends.some(f => f.name.toLowerCase() === trimmed.toLowerCase())) return;
        
        const newFriend: Friend = {
          id: Date.now().toString(),
          name: trimmed,
          isOnline: false,
          status: 'Offline player',
          kind: 'offline',
        };
        
        set(state => ({
          offlineFriends: [...state.offlineFriends, newFriend]
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));
      },

      updateOfflineFriend: (id: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set(state => ({
          offlineFriends: state.offlineFriends
            .map(f => f.id === id ? { ...f, name: trimmed } : f)
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));
      },

      removeOfflineFriend: (id: string) => {
        set(state => ({
          offlineFriends: state.offlineFriends.filter(f => f.id !== id),
        }));
      },

      // ─── Invite System ───

      // Invite code minting + redemption are server-authoritative now.
      // Direct client wallet writes are rejected by RTDB rules.
      generateInviteCode: async (_userId: string) => {
        try {
          const fn = httpsCallable<{}, { code: string }>(functions, 'ensureInviteCode');
          const res = await fn({});
          if (res.data?.code) set({ inviteCode: res.data.code });
        } catch (e: any) {
          console.warn('Invite: ensureInviteCode failed', e?.message);
        }
      },

      redeemInviteCode: async (code: string, _userId: string) => {
        const trimmed = code.trim().toUpperCase();
        if (!trimmed || get().isRedeemingInvite) return;

        set({ isRedeemingInvite: true });
        try {
          const fn = httpsCallable<{ code: string }, { credited: number }>(
            functions,
            'redeemInvite'
          );
          const res = await fn({ code: trimmed });
          showToast.success(`+${res.data?.credited ?? 10} Stars — Welcome bonus from your friend.`);
        } catch (e: any) {
          const msg = e?.message || 'Could not redeem invite code.';
          showToast.error(msg);
        } finally {
          set({ isRedeemingInvite: false });
        }
      },

      getInviteShareMessage: () => {
        const code = get().inviteCode;
        return `Join me on PartyBot 🎮 — use my invite code ${code} to get +10 ★: https://www.partybot.games/invite?code=${code}`;
      },
    }),
    {
      name: 'friends-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        offlineFriends: state.offlineFriends,
        inviteCode: state.inviteCode,
      }),
    }
  )
);
