import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  moderationService,
  ReportReason,
  ReportReasonLabels,
} from '../services/ModerationService';
import { showToast } from './ToastOverlay';
import { Colors } from '../theme/Colors';

interface Props {
  visible: boolean;
  targetUid: string;
  targetName?: string;
  onClose: () => void;
  /** Block + report in one go. Defaults to true. */
  alsoBlock?: boolean;
}

const REASONS: ReportReason[] = [
  'harassment',
  'hate_speech',
  'sexual_content',
  'spam',
  'cheating',
  'underage',
  'other',
];

/**
 * ReportUserSheet — App-Store-required UGC report flow.
 *
 * Submits to the `reportUser` Cloud Function which records the report,
 * deduplicates per (reporter, target, day) pair, and (when `alsoBlock` is
 * true) hides the target from the reporter's social surfaces.
 */
export function ReportUserSheet({ visible, targetUid, targetName, onClose, alsoBlock = true }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await moderationService.reportUser(targetUid, reason, context);
      if (alsoBlock) {
        await moderationService.blockUser(targetUid).catch(() => {});
      }
      showToast.success(alsoBlock ? 'Report sent and user blocked.' : 'Thanks — our team will review.');
      setReason(null);
      setContext('');
      onClose();
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message || 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Report {targetName ? `@${targetName}` : 'user'}</Text>
          <Text style={styles.subtitle}>
            Reports are reviewed by our moderation team. False reports may affect your account.
          </Text>

          <View style={styles.reasonList}>
            {REASONS.map((r) => {
              const active = reason === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonRow, active && styles.reasonRowActive]}
                  onPress={() => setReason(r)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={active ? Colors.red : Colors.secondary}
                  />
                  <Text style={styles.reasonLabel}>{ReportReasonLabels[r]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            value={context}
            onChangeText={setContext}
            placeholder="Add context (optional)"
            placeholderTextColor={Colors.tertiary}
            multiline
            maxLength={500}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (!reason || busy) && styles.submitBtnDisabled]}
              onPress={submit}
              disabled={!reason || busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{alsoBlock ? 'Report & Block' : 'Submit Report'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#15151B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18 },
  reasonList: { gap: 4, marginTop: 4 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  reasonRowActive: { backgroundColor: 'rgba(255,59,48,0.12)' },
  reasonLabel: { color: '#fff', fontSize: 15 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flex: 1.4, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', backgroundColor: Colors.red,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
