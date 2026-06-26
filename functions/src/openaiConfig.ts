import { defineSecret } from "firebase-functions/params"

export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY")

// Overridable per environment via process.env (functions/.env, .env.local, or
// deploy env vars). Read as a plain env var to avoid the interactive param
// prompt the emulator shows for defineString.
export const DEFAULT_MODEL = "gpt-4o-mini"

export function resolveModel(): string {
  return process.env.OPENAI_MODEL ?? DEFAULT_MODEL
}
