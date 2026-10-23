import React, { PropsWithChildren, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hasPendingGoogleRedirect } from '@/src/services/webGoogleAuth';
import { INSTALL_GUIDE_KEY, InstallDevice, installDevice, needsInstallGuide } from '@/src/services/webInstall';

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const steps: Record<InstallDevice, { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; detail: string }[]> = {
  ios: [
    { icon: 'compass-outline', title: 'Open in Safari', detail: 'Visit 8playo.com in Safari on your iPhone or iPad.' },
    { icon: 'share-outline', title: 'Tap Share', detail: 'Find the square with the upward arrow in the browser toolbar.' },
    { icon: 'add-circle-outline', title: 'Add to Home Screen', detail: 'Choose Add to Home Screen, then tap Add. Open 8Playo from its new icon.' },
  ],
  android: [
    { icon: 'logo-chrome', title: 'Open in Chrome', detail: 'Visit 8playo.com in Chrome on your phone.' },
    { icon: 'ellipsis-vertical', title: 'Open the browser menu', detail: 'Tap the three dots at the top of Chrome.' },
    { icon: 'add-circle-outline', title: 'Install 8Playo', detail: 'Choose Add to Home screen or Install app, then confirm.' },
  ],
  desktop: [
    { icon: 'laptop-outline', title: 'Open in Chrome or Edge', detail: 'Visit 8playo.com in your browser.' },
    { icon: 'download-outline', title: 'Look for Install', detail: 'Use the install icon in the address bar, or Install 8Playo in the browser menu.' },
    { icon: 'apps-outline', title: 'Launch like an app', detail: 'Open 8Playo from your apps. On a Mac in Safari, choose File → Add to Dock.' },
  ],
};
export function WebInstallGate({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);
  const [device, setDevice] = useState<InstallDevice>('ios');
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [hint, setHint] = useState('');
  const [installing, setInstalling] = useState(false);
  const continueInBrowser = () => {
    try { window.localStorage.setItem(INSTALL_GUIDE_KEY, '1'); } catch {}
    setShow(false);
  };
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const installed = display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let seen = false;
    try { seen = window.localStorage.getItem(INSTALL_GUIDE_KEY) === '1'; } catch {}
    setDevice(installDevice(navigator.userAgent, navigator.maxTouchPoints));
    setShow(needsInstallGuide(installed, seen, hasPendingGoogleRedirect()));
    setReady(true);
    const onInstalled = () => {
      try { window.localStorage.setItem(INSTALL_GUIDE_KEY, '1'); } catch {}
      setShow(false);
    };
    window.addEventListener('appinstalled', onInstalled);
    const onDisplayChange = () => { if (display.matches) onInstalled(); };
    display.addEventListener('change', onDisplayChange);
    return () => { window.removeEventListener('appinstalled', onInstalled); display.removeEventListener('change', onDisplayChange); };
  }, []);
  useEffect(() => {
    if (!show) return;
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [show]);
  const install = async () => {
    if (!prompt || installing) return;
    setInstalling(true);
    try {
      // Browser-owned prompt, only after a real tap; never claim installation from a button tap alone.
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') continueInBrowser();
      else setHint('No problem — follow the steps above whenever you’re ready.');
    } catch { setHint('Use your browser menu and follow the steps above to add 8Playo.'); }
    finally { setPrompt(null); setInstalling(false); }
  };
  if (!ready) return <View style={styles.canvas} />;
  if (!show) return <>{children}</>;
  return <ScrollView style={styles.canvas} contentContainerStyle={styles.page}>
    <Image source={require('@/assets/images/8playo-logo.png')} style={styles.logo} resizeMode="contain" />
    <View style={styles.preview}>
      <Image source={require('@/assets/images/icon.png')} style={styles.appIcon} />
      <Text style={styles.previewLabel}>8Playo</Text>
      <View style={styles.badge}><Ionicons name="add" size={16} color="#FFF" /><Text style={styles.badgeText}>YOUR HOME SCREEN</Text></View>
    </View>
    <Text accessibilityRole="header" style={styles.title}>One tap away{'\n'}from your next hangout</Text>
    <Text style={styles.subtitle}>Add 8Playo to your Home Screen.{'\n'}Open it like an app, ready for game night.</Text>
    <View style={styles.devices}>
      {(['ios', 'android', 'desktop'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: device === value }} onPress={() => setDevice(value)} style={[styles.device, device === value && styles.deviceSelected]}>
        <Text style={[styles.deviceText, device === value && styles.deviceTextSelected]}>{value === 'ios' ? 'iPhone / iPad' : value === 'android' ? 'Android' : 'Computer'}</Text>
      </Pressable>)}
    </View>
    <View style={styles.steps}>
      {steps[device].map((step, index) => <View key={step.title} style={styles.step}>
        <View style={styles.stepIcon}><Ionicons name={step.icon} size={22} color="#BAA2FF" /></View>
        <View style={styles.stepCopy}><Text style={styles.stepTitle}>{index + 1}. {step.title}</Text><Text style={styles.stepDetail}>{step.detail}</Text></View>
      </View>)}
    </View>
    {!!hint && <Text accessibilityRole="alert" style={styles.hint}>{hint}</Text>}
    {prompt && device !== 'ios' && <Pressable testID="web-install" accessibilityRole="button" disabled={installing} onPress={install} style={styles.install}><Ionicons name="download-outline" color="#FFF" size={22} /><Text style={styles.installText}>{installing ? 'Opening installer…' : 'Install 8Playo'}</Text></Pressable>}
    <Pressable testID="web-install-continue" accessibilityRole="button" onPress={continueInBrowser} style={styles.continue}><Text style={styles.continueText}>Continue in browser for now →</Text></Pressable>
    <Text style={styles.note}>Free to add. Internet connection required.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: '#08080F' },
  page: { flexGrow: 1, width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, alignItems: 'center' },
  logo: { width: 140, height: 34, marginBottom: 24 },
  preview: { width: '100%', alignItems: 'center', paddingVertical: 22, borderRadius: 24, backgroundColor: '#171326', borderWidth: 1, borderColor: '#302345', marginBottom: 24 },
  appIcon: { width: 72, height: 72, borderRadius: 18 },
  previewLabel: { color: '#FFF', fontSize: 14, fontWeight: '600', marginTop: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14 },
  badgeText: { color: '#BAA2FF', fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: '#FFF', fontFamily: 'Viral-Bold', fontSize: 28, lineHeight: 32, textAlign: 'center', marginBottom: 10 },
  subtitle: { color: '#A6A6B5', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 22 },
  devices: { width: '100%', flexDirection: 'row', backgroundColor: '#171923', borderRadius: 12, padding: 4, marginBottom: 16 },
  device: { flex: 1, minHeight: 44, justifyContent: 'center', borderRadius: 9, paddingHorizontal: 3 },
  deviceSelected: { backgroundColor: '#37304B' },
  deviceText: { color: '#A6A6B5', textAlign: 'center', fontSize: 12, fontWeight: '600' },
  deviceTextSelected: { color: '#FFF' },
  steps: { width: '100%', gap: 18, paddingVertical: 10, marginBottom: 14 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#201B30', alignItems: 'center', justifyContent: 'center' },
  stepCopy: { flex: 1 },
  stepTitle: { color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  stepDetail: { color: '#A6A6B5', fontSize: 13, lineHeight: 19 },
  hint: { color: '#BAA2FF', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  install: { width: '100%', minHeight: 56, backgroundColor: '#087AF5', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 16, marginBottom: 8 },
  installText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  continue: { minHeight: 48, width: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: '#1C202D' },
  continueText: { color: '#DCE1EF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  note: { color: '#757989', fontSize: 11, marginTop: 14 },
});
