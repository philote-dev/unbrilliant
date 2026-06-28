import {
  addDoc,
  collection,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore"

export interface PlaytestFeedbackInput {
  lessonId: string
  notes: string
  path?: string
  userAgent?: string
}

const MAX_NOTES_LENGTH = 3000
const MAX_PATH_LENGTH = 500
const MAX_USER_AGENT_LENGTH = 500

export async function submitPlaytestFeedback(
  db: Firestore | unknown,
  input: PlaytestFeedbackInput,
): Promise<void> {
  const notes = input.notes.trim()
  if (!notes) throw new Error("Feedback notes are required")

  await addDoc(collection(db as Firestore, "playtestFeedback"), {
    lessonId: input.lessonId,
    notes: notes.slice(0, MAX_NOTES_LENGTH),
    path: (input.path ?? "").slice(0, MAX_PATH_LENGTH),
    userAgent: (input.userAgent ?? "").slice(0, MAX_USER_AGENT_LENGTH),
    source: "playtest",
    createdAt: serverTimestamp(),
  })
}
