/**
 * The once-per-session gate for the branded load-in. Pure and storage-injected
 * so it is unit-testable without rendering. The real call sites pass
 * `sessionStorage`; the splash plays at most once per browser session.
 */
const SPLASH_KEY = "willow.splashShown"

type SplashStorage = Pick<Storage, "getItem" | "setItem">

/** True the first time this session; false once `markSplashShown` has run. */
export function shouldShowSplash(storage: SplashStorage): boolean {
  try {
    return storage.getItem(SPLASH_KEY) !== "1"
  } catch {
    // Storage can throw (private mode). Degrade to never showing the beat.
    return false
  }
}

/** Record that the load-in has played for this session. */
export function markSplashShown(storage: SplashStorage): void {
  try {
    storage.setItem(SPLASH_KEY, "1")
  } catch {
    // Storage unavailable: no-op. The splash simply will not gate this session.
  }
}
