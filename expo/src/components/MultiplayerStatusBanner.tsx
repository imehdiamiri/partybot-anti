import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/src/theme/Colors';
import { useMultiplayerStore } from '@/src/store/useMultiplayerStore';

/**
 * MultiplayerStatusBanner — slim non-blocking pill that surfaces transient
 * room state (reconnecting / host-changed) without hijacking the full screen.
 *
 * Reads `connectionState` from `useMultiplayerStore` (driven by the
 * `.info/connected` watcher) and the live host id to highlight the current
 * host. A separate toast is emitted on host migration; this banner is the
 * persistent affordance while reconnecting.
 *
 * Mount once per multiplayer screen (lobby + game session). It auto-hides
 * when the user is connected and the host hasn't changed.
 */
export function MultiplayerStatusBanner() {
  const insets = useSafeAreaInsets();
  const connectionState = useMultiplayerStore((s) => s.connectionState);
  const currentRoom = useMultiplayerStore((s) => s.currentRoom);
  const localPlayerId = useMultiplayerStore((s) => s.localPlayerId);

  const reconnecting = connectionState === 'reconnecting' && !!currentRoom;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: reconnecting ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [reconnecting, opacity]);

  if (!currentRoom) return null;
  if (!reconnecting) return null;

  const hostId = currentRoom.hostId;
  const hostName = hostId ? currentRoom.players?.[hostId]?.displayName : undefined;
  const isHostMe = hostId && hostId === localPlayerId;

  return (
    <Animated.View
      style={[styles.wrap, { opacity, top: insets.top + 6 }]}
      pointerEvents="none"
    >
      <View style={styles.pill}>
        <ActivityIndicator size="small" color={Colors.yellow} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Reconnecting…</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {isHostMe
              ? 'Holding the room — your players will see your snapshot when you’re back.'
              : `Waiting for ${hostName ?? 'host'} or a new host to take over.`}
          </Text>
        </View>
        <IconSymbol name="wifi.exclamationmark" size={14} color={Colors.yellow} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(40,30,10,0.92)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    color: '#FFD60A',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 1,
  },
});
