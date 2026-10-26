import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hasPendingGoogleRedirect } from '@/src/services/webGoogleAuth';
import { INSTALL_GUIDE_KEY, InstallDevice, installDevice, needsInstallGuide } from '@/src/services/webInstall';
import type { WebInstallGateProps } from './WebInstallGate';

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type InstallStatus = { installed: boolean; seen: boolean; returningFromGoogle: boolean };
const steps: Record<InstallDevice, { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[]> = {
  ios: [
    { icon: 'share-outline', text: 'In Safari, tap Share.' },
    { icon: 'add-circle-outline', text: 'Add to Home Screen → Add.' },
  ],
  android: [
    { icon: 'ellipsis-vertical', text: 'In Chrome, open the ⋮ menu.' },
    { icon: 'add-circle-outline', text: 'Tap Add to Home screen or Install app.' },
  ],
  desktop: [
    { icon: 'download-outline', text: 'Chrome / Edge: click Install in the address bar.' },
    { icon: 'laptop-outline', text: 'Safari on Mac: File → Add to Dock.' },
  ],
};
export function WebInstallGate({ children, onboardingComplete, settingsReady }: WebInstallGateProps) {
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [device, setDevice] = useState<InstallDevice>('ios');
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [hint, setHint] = useState('');
  const [installing, setInstalling] = useState(false);
  const continueInBrowser = () => {
    try { window.localStorage.setItem(INSTALL_GUIDE_KEY, '1'); } catch {}
    setStatus(previous => previous && { ...previous, seen: true });
  };
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const installed = display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let seen = false;
    try { seen = window.localStorage.getItem(INSTALL_GUIDE_KEY) === '1'; } catch {}
    setDevice(installDevice(navigator.userAgent, navigator.maxTouchPoints));
    setStatus({ installed, seen, returningFromGoogle: hasPendingGoogleRedirect() });
    const onInstalled = () => {
      try { window.localStorage.setItem(INSTALL_GUIDE_KEY, '1'); } catch {}
      setStatus(previous => previous && { ...previous, installed: true, seen: true });
    };
    // Defer browser promotion until onboarding is finished; keep an eligible prompt.
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const onDisplayChange = () => { if (display.matches) onInstalled(); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    display.addEventListener('change', onDisplayChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      display.removeEventListener('change', onDisplayChange);
    };
  }, []);
  const install = async () => {
    if (!prompt || installing) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') continueInBrowser();
      else setHint('You can add it later from your browser menu.');
    } catch { setHint('Follow the two steps above to add 8Playo.'); }
    finally { setPrompt(null); setInstalling(false); }
  };
  if (!status || !settingsReady) return <View style={styles.canvas} />;
  if (!needsInstallGuide(status.installed, status.seen, status.returningFromGoogle, onboardingComplete)) return <>{children}</>;
  return <ScrollView style={styles.canvas} contentContainerStyle={styles.page}>
    <Image source={require('@/assets/images/icon.png')} style={styles.appIcon} />
    <Text accessibilityRole="header" style={styles.title}>Add to Home Screen</Text>
    <Text style={styles.subtitle}>Open 8Playo like an app.</Text>
    <View style={styles.devices}>
      {(['ios', 'android', 'desktop'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: device === value }} onPress={() => setDevice(value)} style={[styles.device, device === value && styles.deviceSelected]}>
        <Text style={[styles.deviceText, device === value && styles.deviceTextSelected]}>{value === 'ios' ? 'iPhone / iPad' : value === 'android' ? 'Android' : 'Computer'}</Text>
      </Pressable>)}
    </View>
    <View style={styles.steps}>
      {steps[device].map(step => <View key={step.text} style={styles.step}>
        <Ionicons name={step.icon} size={22} color="#BAA2FF" />
        <Text style={styles.stepText}>{step.text}</Text>
      </View>)}
    </View>
    {!!hint && <Text accessibilityRole="alert" style={styles.hint}>{hint}</Text>}
    {prompt && device !== 'ios' && <Pressable testID="web-install" accessibilityRole="button" disabled={installing} onPress={install} style={styles.install}><Text style={styles.installText}>{installing ? 'Opening installer…' : 'Install 8Playo'}</Text></Pressable>}
    <Pressable testID="web-install-continue" accessibilityRole="button" onPress={continueInBrowser} style={styles.continue}><Text style={styles.continueText}>Continue in browser →</Text></Pressable>
    <Text style={styles.note}>Internet connection required.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: '#08080F' },
  page: { flexGrow: 1, width: '100%', maxWidth: 420, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center' },
  appIcon: { width: 64, height: 64, borderRadius: 16, marginBottom: 20 },
  title: { color: '#FFF', fontFamily: 'Viral-Bold', fontSize: 25, lineHeight: 31, textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#A6A6B5', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  devices: { width: '100%', flexDirection: 'row', backgroundColor: '#171923', borderRadius: 12, padding: 4, marginBottom: 24 },
  device: { flex: 1, minHeight: 44, justifyContent: 'center', borderRadius: 9, paddingHorizontal: 3 },
  deviceSelected: { backgroundColor: '#37304B' },
  deviceText: { color: '#A6A6B5', textAlign: 'center', fontSize: 12, fontWeight: '600' },
  deviceTextSelected: { color: '#FFF' },
  steps: { width: '100%', gap: 20, marginBottom: 28 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepText: { flex: 1, color: '#E0E0E8', fontSize: 15, lineHeight: 22 },
  hint: { color: '#BAA2FF', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  install: { width: '100%', minHeight: 52, backgroundColor: '#087AF5', alignItems: 'center', justifyContent: 'center', borderRadius: 14, marginBottom: 10 },
  installText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  continue: { minHeight: 48, width: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: '#1C202D' },
  continueText: { color: '#DCE1EF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  note: { color: '#757989', fontSize: 11, marginTop: 14 },
});
