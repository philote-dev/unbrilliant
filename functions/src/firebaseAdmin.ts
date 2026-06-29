import { getApps, initializeApp } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

let db: Firestore | undefined

export function getAdminDb(): Firestore {
  if (!db) {
    if (getApps().length === 0) initializeApp()
    db = getFirestore()
  }
  return db
}
