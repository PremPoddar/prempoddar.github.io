type Sentinel = { release(): Promise<void>; addEventListener(type: 'release', f: () => void): void };
type Nav = { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } };
type Doc = { visibilityState: string; addEventListener(type: 'visibilitychange', f: () => void): void };

// The Screen Wake Lock API drops the lock whenever the tab is hidden, so this takes it back on return.
export function createWakeLock(nav: Nav, doc: Doc) {
  const api = nav.wakeLock;
  let wanted = false;
  let sentinel: Sentinel | null = null;

  async function acquire(): Promise<boolean> {
    if (!api) return false;
    try {
      const s = await api.request('screen');
      sentinel = s;
      s.addEventListener('release', () => {
        if (sentinel === s) sentinel = null;
      });
      return true;
    } catch {
      sentinel = null;
      return false;
    }
  }

  doc.addEventListener('visibilitychange', () => {
    if (wanted && !sentinel && doc.visibilityState === 'visible') void acquire();
  });

  return {
    supported: !!api,
    async on(): Promise<boolean> {
      wanted = true;
      const ok = await acquire();
      if (!ok) wanted = false;
      return ok;
    },
    async off(): Promise<void> {
      wanted = false;
      const s = sentinel;
      sentinel = null;
      await s?.release();
    },
    isOn: () => wanted && !!sentinel,
  };
}
