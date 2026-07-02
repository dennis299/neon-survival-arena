// Keeps the screen awake during a run — a 10+ minute survival session would
// otherwise dim/lock mid-fight on mobile. Silently no-ops where unsupported;
// the lock is also released automatically by the browser when the tab is
// hidden, so we re-acquire it on visibilitychange.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sentinel: any = null

export async function acquireWakeLock() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any
    if (nav.wakeLock) {
      sentinel = await nav.wakeLock.request('screen')
    }
  } catch {
    // permission denied, unsupported, or backgrounded — fine either way
  }
}

export function releaseWakeLock() {
  try {
    sentinel?.release?.()
  } catch {
    // already released
  }
  sentinel = null
}

/** Call once; returns a cleanup function. Re-acquires the lock when the tab
 * regains visibility (browsers auto-release it when backgrounded). */
export function watchWakeLockVisibility(): () => void {
  const handler = () => {
    if (document.visibilityState === 'visible' && sentinel === null) {
      void acquireWakeLock()
    }
  }
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}
