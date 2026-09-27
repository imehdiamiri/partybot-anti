import { installWebZoomGuards } from '@/src/utils/webZoomGuards';
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { usePathname } from 'expo-router';

interface ResponsiveWebContainerProps {
  children: React.ReactNode;
}

/**
 * Targeted reset of container scroll offsets for the shell and document nodes.
 * Does not scan arbitrary DOM nodes to avoid interfering with intentional game/modal scrollers.
 */
export function resetWebScrollOffsets(rootEl?: HTMLElement | null, contentEl?: HTMLElement | null) {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  try {
    window.scrollTo(0, 0);

    if (document.documentElement) {
      if (document.documentElement.scrollTop !== 0) document.documentElement.scrollTop = 0;
      if (document.documentElement.scrollLeft !== 0) document.documentElement.scrollLeft = 0;
    }
    if (document.body) {
      if (document.body.scrollTop !== 0) document.body.scrollTop = 0;
      if (document.body.scrollLeft !== 0) document.body.scrollLeft = 0;
    }

    const appRoot = document.getElementById('root');
    if (appRoot) {
      if (appRoot.scrollTop !== 0) appRoot.scrollTop = 0;
      if (appRoot.scrollLeft !== 0) appRoot.scrollLeft = 0;
    }

    if (rootEl) {
      if (rootEl.scrollTop !== 0) rootEl.scrollTop = 0;
      if (rootEl.scrollLeft !== 0) rootEl.scrollLeft = 0;
    }
    if (contentEl) {
      if (contentEl.scrollTop !== 0) contentEl.scrollTop = 0;
      if (contentEl.scrollLeft !== 0) contentEl.scrollLeft = 0;
    }
  } catch (_) {
    // Ignore non-critical DOM access exceptions
  }
}

/**
 * ResponsiveWebContainer
 * Provides a rigid, non-scrolling responsive shell for web:
 * - Mobile (390px): 100% width, native-feeling full screen, zero clipping.
 * - Tablet (768px): readable responsive layout with comfortable spacing.
 * - Desktop (1440px): centered responsive web application with max-width containment.
 * - Actively clamps shell/root scroll to (0,0) across route changes and same-route phase changes.
 * - Disables CSS scroll anchoring on root shell nodes.
 */
export function ResponsiveWebContainer({ children }: ResponsiveWebContainerProps) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return <WebContainer>{children}</WebContainer>;
}

function WebContainer({ children }: ResponsiveWebContainerProps) {

  useEffect(() => installWebZoomGuards(document), []);
  const pathname = usePathname();
  const rootRef = useRef<any>(null);
  const contentRef = useRef<any>(null);

  const performReset = () => {
    resetWebScrollOffsets(rootRef.current, contentRef.current);
  };

  // Immediate reset on route navigation
  useLayoutEffect(() => {
    performReset();
    const rafId = requestAnimationFrame(performReset);
    return () => cancelAnimationFrame(rafId);
  }, [pathname]);

  useEffect(() => {
    performReset();
  }, [pathname]);

  // Attach direct scroll clamping listeners and disable scroll anchoring on shell nodes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const clampTarget = (el: HTMLElement | null) => {
      if (!el) return;
      if (el.scrollTop !== 0) el.scrollTop = 0;
      if (el.scrollLeft !== 0) el.scrollLeft = 0;
    };

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const appRoot = document.getElementById('root');
      if (
        target === rootRef.current ||
        target === contentRef.current ||
        target === appRoot ||
        target === document.body ||
        target === document.documentElement
      ) {
        clampTarget(target);
      }
    };

    const rootEl = rootRef.current as HTMLElement | null;
    const contentEl = contentRef.current as HTMLElement | null;
    const appRoot = document.getElementById('root');

    if (rootEl) {
      rootEl.addEventListener('scroll', handleScroll, { passive: true });
      try {
        (rootEl.style as any).overflowAnchor = 'none';
      } catch (_) {}
    }
    if (contentEl) {
      contentEl.addEventListener('scroll', handleScroll, { passive: true });
      try {
        (contentEl.style as any).overflowAnchor = 'none';
      } catch (_) {}
    }
    if (appRoot) {
      appRoot.addEventListener('scroll', handleScroll, { passive: true });
      try {
        (appRoot.style as any).overflowAnchor = 'none';
      } catch (_) {}
    }
    if (document.documentElement) {
      try {
        (document.documentElement.style as any).overflowAnchor = 'none';
      } catch (_) {}
    }
    if (document.body) {
      try {
        (document.body.style as any).overflowAnchor = 'none';
      } catch (_) {}
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (rootEl) rootEl.removeEventListener('scroll', handleScroll);
      if (contentEl) contentEl.removeEventListener('scroll', handleScroll);
      if (appRoot) appRoot.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <View ref={rootRef} style={styles.webRoot}>
      <View ref={contentRef} style={styles.webContentWrapper}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#050508',
    overflow: 'hidden',
    // @ts-ignore
    overflowAnchor: 'none',
  },
  webContentWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
    // @ts-ignore
    overflowAnchor: 'none',
  },
});
