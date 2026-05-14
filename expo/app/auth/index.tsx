import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../../src/theme/Colors';
import { AppBackgroundView } from '../../src/components/AppBackgroundView';
import { useAuthStore } from '../../src/store/useAuthStore';
import { AppConstants } from '../../src/constants/AppConstants';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Platform-safe BlurView (conditional require, iOS only)
let BlurView: any = null;
if (Platform.OS === 'ios') {
  try { BlurView = require('expo-blur').BlurView; } catch {} // eslint-disable-line @typescript-eslint/no-require-imports
}

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const {
    isBusy,
    errorMessage,
    signIn,
    signUp,
    signInWithApple,
    signInWithGoogle,
  } = useAuthStore();

  const handleSubmit = () => {
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();
    if (!trimmedUser || !trimmedPass || isBusy) return;

    Keyboard.dismiss();
    if (isLogin) {
      signIn(trimmedUser, trimmedPass).catch(() => {});
    } else {
      signUp(trimmedUser, trimmedPass).catch(() => {});
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <AppBackgroundView variant="simple" />

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Close button */}
            <View style={styles.closeRow}>
              <TouchableOpacity 
                style={styles.closeBtn}
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace('/');
                }}
                activeOpacity={0.7}
              >
                <IconSymbol name="xmark" size={14} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            {/* Hero Section */}
            <View style={styles.heroSection}>
              <Image source={require('@/assets/images/partybot-logo.png')} style={{ width: 220, height: 52 }} resizeMode="contain" />
              <Text style={styles.appSubtitle}>
                Sign in to unlock all games,{'\n'}earn rewards & play with friends
              </Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              <View style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: 'hidden' }]}>
                {Platform.OS === 'ios' && BlurView ? (
                  <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.surface2 }]} />
                )}
              </View>

              {/* Inputs */}
              <View style={styles.inputGroup}>
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Username or email"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="username"
                    value={username}
                    onChangeText={setUsername}
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.inputDivider} />
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry
                    textContentType={isLogin ? 'password' : 'newPassword'}
                    value={password}
                    onChangeText={setPassword}
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit}
                  />
                </View>
              </View>

              {errorMessage && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color={Colors.red} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Primary Action */}
              <TouchableOpacity
                style={[styles.primaryBtn, (!username || !password || isBusy) && styles.primaryBtnDisabled]}
                disabled={!username || !password || isBusy}
                onPress={handleSubmit}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#0A84FF', '#0066CC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={styles.primaryBtnText}>
                  {isLogin ? 'Sign In' : 'Create Account'}
                </Text>
              </TouchableOpacity>

              {/* Toggle */}
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleRow}>
                <Text style={styles.toggleTextLeft}>
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                </Text>
                <Text style={styles.toggleTextRight}>
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Buttons */}
            <View style={styles.socialBlock}>
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.socialBtn}
                  disabled={isBusy}
                  onPress={() => signInWithApple().catch(() => {})}
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-apple" size={20} color={Colors.white} />
                  <Text style={styles.socialBtnText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.socialBtn}
                disabled={isBusy}
                onPress={() => signInWithGoogle().catch(() => {})}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#4285F4' }}>G</Text>
                <Text style={styles.socialBtnText}>Continue with Google</Text>
              </TouchableOpacity>
            </View>

            {/* Legal */}
            <View style={styles.footerSection}>
              <View style={styles.legalRow}>
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

          {/* Busy Overlay */}
          {isBusy && (
            <View style={styles.busyOverlay}>
              {Platform.OS === 'ios' && BlurView ? (
                <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]} />
              )}
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color={Colors.white} />
                <Text style={styles.busyText}>Signing in…</Text>
              </View>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  scrollContent: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  closeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Hero ───
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 12,
  },
  appIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.15)',
  },
  appIconGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  appTitle: {
    fontFamily: Typography.viralTitle.fontFamily,
    fontSize: 32,
    color: Colors.white,
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 21,
  },

  // ─── Form Card ───
  formCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    overflow: 'hidden',
    marginBottom: 24,
  },
  inputGroup: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: Colors.white,
    fontSize: 16,
  },
  inputDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: 42,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  errorText: {
    color: Colors.red,
    fontSize: 13,
    flex: 1,
  },
  primaryBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  toggleTextLeft: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 14,
  },
  toggleTextRight: {
    color: Colors.blue,
    fontSize: 14,
    fontWeight: '600',
  },

  // ─── Divider ───
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 16,
  },

  // ─── Social ───
  socialBlock: {
    gap: 10,
    marginBottom: 32,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
  },
  socialBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // ─── Footer ───
  footerSection: {
    alignItems: 'center',
    gap: 10,
    marginTop: 'auto',
    paddingTop: 8,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  guestText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 15,
    fontWeight: '500',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 12,
  },
  legalRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  legalLink: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 12,
    fontWeight: '500',
  },
  legalDot: {
    color: 'rgba(255, 255, 255, 0.2)',
    fontSize: 12,
  },

  // ─── Busy ───
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  progressContainer: {
    padding: 28,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    gap: 12,
  },
  busyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
});
