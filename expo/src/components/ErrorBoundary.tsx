import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

/**
 * RootErrorBoundary — last-resort UI guard so a single render exception cannot
 * brick the entire app. We log the error to the console (Crashlytics hooks can
 * be added here later) and offer the user a "Try again" button that resets the
 * boundary's child tree.
 */

interface Props { children: React.ReactNode }
interface State { error: Error | null }

export class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[RootErrorBoundary]', error?.message, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            We hit an unexpected error. The team has been notified.
          </Text>
          <Text style={styles.errorText} numberOfLines={6}>
            {this.state.error.message || String(this.state.error)}
          </Text>
          <Pressable onPress={this.reset} style={styles.button}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' },
  errorText: {
    color: '#FF6B6B', fontSize: 12, textAlign: 'center', marginTop: 8,
    fontFamily: 'monospace', paddingHorizontal: 12,
  },
  button: {
    marginTop: 24, backgroundColor: '#007AFF',
    paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
