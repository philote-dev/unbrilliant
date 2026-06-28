type Env = Record<string, string | boolean | undefined>

export interface FirebaseEmulatorConfig {
  authUrl: string
  firestoreHost: string
  firestorePort: number
  functionsHost: string
  functionsPort: number
  projectId: string
}

function envString(env: Env, key: string, fallback: string): string {
  const value = env[key]
  return typeof value === "string" && value.length > 0 ? value : fallback
}

function envPort(env: Env, key: string, fallback: number): number {
  const raw = envString(env, key, String(fallback))
  const port = Number(raw)
  return Number.isInteger(port) && port > 0 ? port : fallback
}

export function emulatorConfigFromEnv(env: Env): FirebaseEmulatorConfig {
  return {
    authUrl: envString(
      env,
      "VITE_FIREBASE_AUTH_EMULATOR_URL",
      "http://127.0.0.1:9099",
    ),
    firestoreHost: envString(env, "VITE_FIRESTORE_EMULATOR_HOST", "127.0.0.1"),
    firestorePort: envPort(env, "VITE_FIRESTORE_EMULATOR_PORT", 8080),
    functionsHost: envString(env, "VITE_FUNCTIONS_EMULATOR_HOST", "127.0.0.1"),
    functionsPort: envPort(env, "VITE_FUNCTIONS_EMULATOR_PORT", 5001),
    projectId: envString(env, "VITE_FIREBASE_DEMO_PROJECT_ID", "demo-willow"),
  }
}
