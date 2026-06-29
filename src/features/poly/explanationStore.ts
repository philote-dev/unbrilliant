import {
  addDoc,
  collection,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore"

export interface ExplanationRecord {
  conceptId: string
  explanation: string
}

/** Persist a raw teach-back explanation under the signed-in learner. Callers must
 * only invoke this with a real uid (anonymous play skips storage). */
export async function saveExplanation(
  db: Firestore,
  uid: string,
  rec: ExplanationRecord,
): Promise<void> {
  await addDoc(collection(db, "users", uid, "teachbackExplanations"), {
    conceptId: rec.conceptId,
    explanation: rec.explanation,
    createdAt: serverTimestamp(),
  })
}
