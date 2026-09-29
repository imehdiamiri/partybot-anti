export type AdsState = { ready: boolean; privacyRequired: boolean; revision: number };
export interface ConsentAdapter {
  gather(): Promise<unknown>;
  info(): Promise<{ canRequestAds: boolean; privacyOptionsRequirementStatus: string }>;
  privacy(): Promise<unknown>;
  initialize(): Promise<unknown>;
}

/** In-memory only: the CMP, never our storage, owns consent decisions. */
export class AdsController {
  private state: AdsState = { ready: false, privacyRequired: false, revision: 0 };
  private listeners = new Set<() => void>();
  private pending: Promise<void> | null = null;
  private initialized = false;
  private generation = 0;
  private privacyPending: Promise<void> | null = null;
  constructor(private adapter: ConsentAdapter) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(ready: boolean, privacyRequired: boolean) {
    this.state = { ready, privacyRequired, revision: this.state.revision + 1 };
    this.listeners.forEach(listener => listener());
  }
  private async refresh(generation: number) {
    const info = await this.adapter.info();
    if (generation !== this.generation) return;
    if (info.canRequestAds && !this.initialized) {
      await this.adapter.initialize();
      this.initialized = true;
    }
    if (generation === this.generation) {
      this.publish(info.canRequestAds, info.privacyOptionsRequirementStatus === 'REQUIRED');
    }
  }
  start = (): Promise<void> => {
    if (this.privacyPending) return this.privacyPending;
    if (this.pending) return this.pending;
    if (this.state.ready) return Promise.resolve();
    const generation = ++this.generation;
    this.pending = (async () => {
      // On a network error UMP may still have a valid previous-session decision.
      try { await this.adapter.gather(); } catch {}
      try { await this.refresh(generation); } catch {
        if (generation === this.generation) this.publish(false, this.state.privacyRequired);
      }
    })().finally(() => { this.pending = null; });
    return this.pending;
  };
  privacy = (): Promise<void> => {
    if (this.privacyPending) return this.privacyPending;
    // Remove existing banners before displaying the form, including on revocation.
    const generation = ++this.generation;
    this.publish(false, this.state.privacyRequired);
    this.privacyPending = (async () => {
      try { await this.adapter.privacy(); } finally { await this.refresh(generation); }
    })().finally(() => { this.privacyPending = null; });
    return this.privacyPending;
  };
}
