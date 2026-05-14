import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { SurfaceCard } from '@/src/components/SurfaceCard';
import { Colors } from '@/src/theme/Colors';
import { InviteService } from '@/src/services/InviteService';
import { AudioManager } from '@/src/services/AudioManager';

export default function InviteScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [stats, setStats] = useState({ totalInvites: 0, starsEarned: 0 });
  const [redeemCode, setRedeemCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const fetchedCode = await InviteService.getMyInviteCode();
      const fetchedStats = await InviteService.getInviteStats();
      setCode(fetchedCode);
      setStats(fetchedStats);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', 'Invite code copied to clipboard.');
  };

  const shareCode = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Join me on PartyBot! Use my invite code: ${code} to get +10 Stars when you sign up.`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    setIsRedeeming(true);
    try {
      await InviteService.redeemCode(redeemCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AudioManager.play('success');
      Alert.alert('Success!', 'You have successfully redeemed the code and earned +10 Stars!');
      setRedeemCode('');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', e.message);
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite Friends</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Card */}
        <SurfaceCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.giftIconBox}>
              <Ionicons name="gift" size={24} color={Colors.pink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Invite a friend</Text>
              <Text style={styles.heroSub}>Earn +30 ★ when a new friend joins.</Text>
            </View>
          </View>
          
          <Text style={styles.codeLabel}>YOUR CODE</Text>
          <View style={styles.codeBox}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.codeText}>{code || '------'}</Text>
            )}
          </View>
        </SurfaceCard>

        {/* Share Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.blue }]} onPress={copyCode}>
            <Ionicons name="copy" size={20} color="#fff" />
            <Text style={styles.actionTx}>Copy Code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.purple }]} onPress={shareCode}>
            <Ionicons name="share-outline" size={20} color="#fff" />
            <Text style={styles.actionTx}>Share Link</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Card */}
        <SurfaceCard style={styles.statsCard}>
          <View style={styles.statCell}>
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(52, 199, 89, 0.16)' }]}>
              <Ionicons name="people" size={20} color={Colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statValue}>{stats.totalInvites}</Text>
              <Text style={styles.statLabel}>Friends Joined</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.statCell}>
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(255, 149, 0, 0.16)' }]}>
              <Ionicons name="star" size={20} color={Colors.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statValue}>{stats.starsEarned}</Text>
              <Text style={styles.statLabel}>Stars Earned</Text>
            </View>
          </View>
        </SurfaceCard>

        {/* Redeem Card */}
        <SurfaceCard style={styles.redeemCard}>
          <Text style={styles.sectionTitle}>Got an invite code?</Text>
          <Text style={styles.sectionSub}>New accounts can redeem for +10 ★.</Text>
          
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="ABC123"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="characters"
              autoCorrect={false}
              value={redeemCode}
              onChangeText={setRedeemCode}
            />
            <TouchableOpacity 
              style={[styles.redeemBtn, (!redeemCode.trim() || isRedeeming) && { opacity: 0.5 }]} 
              onPress={handleRedeem}
              disabled={!redeemCode.trim() || isRedeeming}
            >
              {isRedeeming ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.redeemTx}>Redeem</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.ruleNote}>Codes can only be redeemed once per account.</Text>
        </SurfaceCard>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16 },
  closeBtn: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 20 },
  
  heroCard: { padding: 20, borderRadius: 20 },
  heroHeader: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  giftIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255, 45, 85, 0.16)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
  codeLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', marginBottom: 8, letterSpacing: 1 },
  codeBox: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  codeText: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: 6 },
  
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 8 },
  actionTx: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  
  statsCard: { flexDirection: 'row', padding: 20, borderRadius: 20, alignItems: 'center' },
  statCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 14 },
  
  redeemCard: { padding: 20, borderRadius: 20 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  sectionSub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 4, marginBottom: 16 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, color: '#fff', fontSize: 17, fontFamily: 'monospace', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  redeemBtn: { backgroundColor: Colors.blue, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12 },
  redeemTx: { color: '#fff', fontSize: 15, fontWeight: '600' },
  ruleNote: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
});
