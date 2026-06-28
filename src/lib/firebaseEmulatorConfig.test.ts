import { describe, expect, it } from "vitest"

import { emulatorConfigFromEnv } from "@/lib/firebaseEmulatorConfig"

describe("emulatorConfigFromEnv", () => {
  it("uses the normal local emulator ports by default", () => {
    expect(emulatorConfigFromEnv({})).toEqual({
      authUrl: "http://127.0.0.1:9099",
      firestoreHost: "127.0.0.1",
      firestorePort: 8080,
      functionsHost: "127.0.0.1",
      functionsPort: 5001,
      projectId: "demo-willow",
    })
  })

  it("accepts dedicated playtest ports from Vite env", () => {
    expect(
      emulatorConfigFromEnv({
        VITE_FIREBASE_DEMO_PROJECT_ID: "demo-willow-playtest",
        VITE_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9197",
        VITE_FIRESTORE_EMULATOR_HOST: "127.0.0.1",
        VITE_FIRESTORE_EMULATOR_PORT: "8197",
        VITE_FUNCTIONS_EMULATOR_HOST: "127.0.0.1",
        VITE_FUNCTIONS_EMULATOR_PORT: "5297",
      }),
    ).toEqual({
      authUrl: "http://127.0.0.1:9197",
      firestoreHost: "127.0.0.1",
      firestorePort: 8197,
      functionsHost: "127.0.0.1",
      functionsPort: 5297,
      projectId: "demo-willow-playtest",
    })
  })
})
