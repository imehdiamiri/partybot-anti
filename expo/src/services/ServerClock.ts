class ServerClock {
  private offsetMs: number = 0;
  private unsubscribe: (() => void) | null = null;
  private isListening: boolean = false;
  private isReady: boolean = false;
  private readyListeners: Array<(ready: boolean) => void> = [];

  public start(): void {
    if (this.isListening) return;
    try {
      // Lazy require so module can load in mock/unit-test environments without throwing on env vars
      const { rtdb } = require('../lib/firebase');
      const { ref, onValue } = require('firebase/database');
      if (rtdb) {
        const offsetRef = ref(rtdb, '.info/serverTimeOffset');
        this.unsubscribe = onValue(offsetRef, (snap: any) => {
          const val = snap && typeof snap.val === 'function' ? snap.val() : snap;
          if (typeof val === 'number') {
            this.offsetMs = val;
            this.isReady = true;
            this.notifyReady();
          }
        });
      }
      this.isListening = true;
    } catch {
      // Graceful fallback for offline, testing, or uninitialized environments
      this.isListening = true;
    }
  }

  public stop(): void {
    if (this.unsubscribe) {
      try {
        this.unsubscribe();
      } catch {}
      this.unsubscribe = null;
    }
    this.isListening = false;
    this.isReady = false;
    this.readyListeners = [];
  }

  public setOffset(offsetMs: number): void {
    this.offsetMs = offsetMs;
    this.isReady = true;
    this.notifyReady();
  }

  public getOffset(): number {
    return this.offsetMs;
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  public async waitUntilReady(timeoutMs: number = 1000): Promise<boolean> {
    if (this.isReady) return true;
    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cb = (ready: boolean) => {
        if (timer) clearTimeout(timer);
        resolve(ready);
      };

      timer = setTimeout(() => {
        const idx = this.readyListeners.indexOf(cb);
        if (idx !== -1) this.readyListeners.splice(idx, 1);
        resolve(this.isReady);
      }, timeoutMs);

      this.readyListeners.push(cb);
    });
  }

  private notifyReady(): void {
    const listeners = [...this.readyListeners];
    this.readyListeners = [];
    for (const listener of listeners) {
      try {
        listener(true);
      } catch {}
    }
  }

  public now(): number {
    return Date.now() + this.offsetMs;
  }
}

export const serverClock = new ServerClock();
export const getServerNow = () => serverClock.now();
