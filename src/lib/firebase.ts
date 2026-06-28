import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app"
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth"
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore"
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions"

import { emulatorConfigFromEnv } from "@/lib/firebaseEmulatorConfig"

/**
 * Firebase wiring. In development we ALWAYS talk to the local emulators using a
 * `demo-` project id — the Firebase SDK treats demo projects as offline-only, so
 * the app/dev/tests can never reach a real Firebase project (a hard
 * requirement). Production builds read real config from VITE_ env.
 */
const useEmulator =
  import.meta.env.DEV || import.meta.env.VITE_USE_EMULATOR === "true"
const emulatorConfig = emulatorConfigFromEnv(import.meta.env)

const firebaseConfig = useEmulator
  ? {
      apiKey: "demo-key",
      authDomain: "localhost",
      projectId: emulatorConfig.projectId,
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }

export const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig)

// Persist the signed-in session durably so it survives a reload (resume across
// sessions). Prefer IndexedDB, fall back to localStorage when it's unavailable
// (e.g. some headless browsers). getAuth() covers HMR re-initialization.
// The popupRedirectResolver is required for signInWithPopup/Redirect when using
// initializeAuth; without it Google sign-in throws auth/argument-error.
function resolveAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    return getAuth(app)
  }
}

export const auth: Auth = resolveAuth()
export const db: Firestore = getFirestore(app)
export const functions: Functions = getFunctions(app)

// Guard against double-connect across Vite HMR / re-imports.
const g = globalThis as unknown as { __willowEmulatorsConnected?: boolean }
if (useEmulator && !g.__willowEmulatorsConnected) {
  connectAuthEmulator(auth, emulatorConfig.authUrl, { disableWarnings: true })
  connectFirestoreEmulator(
    db,
    emulatorConfig.firestoreHost,
    emulatorConfig.firestorePort,
  )
  connectFunctionsEmulator(
    functions,
    emulatorConfig.functionsHost,
    emulatorConfig.functionsPort,
  )
  g.__willowEmulatorsConnected = true
}
