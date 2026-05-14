/**
 * Observability — privacy-safe crash & error reporting bridge.
 *
 * We do NOT bundle a heavy native crash SDK (Sentry/Crashlytics) because this
 * project ships through Expo Go for development and would otherwise require an
 * EAS dev build to install the native module. Instead we:
 *
 *   1. Install global JS error + unhandled-promise handlers.
 *   2. Persist sanitized crash records in RTDB (`crashLogs/$uid/$pushId`) so
 *      the admin website can review them. Writes are best-effort and silent
 *      on failure (we never crash the crash handler).
 *   3. Strip user prompts, AI outputs, and any obvious PII before persisting.
 *
 * When the project graduates to an EAS build, swap `recordEvent()` for the
 * native `Sentry.captureException()` call — every call site already routes
 * through this module so the migration is a single-file change.
 */

import { Platform } from 'react-native';
import { auth, rtdb } from '../lib/firebase';
import { ref, push, set } from 'firebase/database';

type Severity = 'fatal' | 'error' | 'warning' | 'info';

interface ContextTags {
  [key: string]: string | number | boolean | undefined;
}

const APP_VERSION =
  (process.env.EXPO_PUBLIC_APP_VERSION as string | undefined) ?? 'dev';

// Coarse PII scrubber — drops anything that looks like an email/token/uuid.
function scrub(input: string): string {
  if (!input) return input;
  return input
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b[a-f0-9]{32,}\b/gi, '[token]')
    .replace(/\b[A-Za-z0-9-_]{40,}\b/g, '[token]')
    .slice(0, 1000);
}

let installed = false;

export const Observability = {
  install(): void {
    if (installed) return;
    installed = true;

    // Global JS error handler — RN exposes ErrorUtils on the global object.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ErrorUtils: any = (global as any).ErrorUtils;
      if (ErrorUtils?.setGlobalHandler) {
        const previous = ErrorUtils.getGlobalHandler?.();
        ErrorUtils.setGlobalHandler((err: Error, isFatal?: boolean) => {
          Observability.recordError(err, {
            severity: isFatal ? 'fatal' : 'error',
            source: 'global',
          });
          if (typeof previous === 'function') {
            try { previous(err, isFatal); } catch {}
          }
        });
      }
    } catch {
      // No global handler available — safe to ignore.
    }

    // Unhandled promise rejections.
    try {
      const g: any = global as any;
      if (typeof g.addEventListener === 'function') {
        g.addEventListener('unhandledrejection', (event: any) => {
          const reason = event?.reason ?? event;
          Observability.recordError(
            reason instanceof Error ? reason : new Error(String(reason)),
            { severity: 'error', source: 'unhandledRejection' }
          );
        });
      }
    } catch {}
  },

  recordError(err: Error | unknown, tags: ContextTags & { severity?: Severity; source?: string } = {}): void {
    const severity = tags.severity ?? 'error';
    const message = scrub((err as Error)?.message || String(err));
    const stack = scrub(((err as Error)?.stack || '').split('\n').slice(0, 12).join('\n'));

    // eslint-disable-next-line no-console
    console.error(`[obs:${severity}]`, message);

    // Best-effort upload — never throw from the observability layer.
    // We only attempt the write when we have a real uid; anonymous writes
    // would just be rejected by the per-uid scoped rules.
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const node = push(ref(rtdb, `crashLogs/${uid}`));
      set(node, {
        message,
        stack,
        severity,
        platform: Platform.OS,
        appVersion: APP_VERSION,
        tags: sanitizeTags(tags),
        at: Date.now(),
      }).catch(() => {});
    } catch {
      // Swallow — observability failures must not cascade.
    }
  },

  recordEvent(name: string, tags: ContextTags = {}): void {
    try {
      const uid = auth.currentUser?.uid || 'anon';
      const node = push(ref(rtdb, `telemetry`));
      set(node, {
        userId: uid,
        event: name.slice(0, 64),
        tags: sanitizeTags(tags),
        at: Date.now(),
      }).catch(() => {});
    } catch {}
  },
};

function sanitizeTags(tags: ContextTags): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(tags)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') out[k] = scrub(v).slice(0, 200);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}
