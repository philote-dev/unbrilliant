import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useAuth } from "@/lib/auth"
import { db } from "@/lib/firebase"
import { createFirestoreProgressRepository } from "@/features/progress/firestoreProgressRepository"
import {
  applyReview,
  newReview,
  type ConceptReview,
} from "@/features/progress/conceptReview"
import { reinforceCheckpoint } from "@/features/trials/reinforceCheckpoint"
import type { ConceptId } from "@/features/progress/concepts"

/**
 * Owns the per-user ConceptReview cache and the SINGLE write path. Sits below
 * AuthProvider and above LessonRunProvider so the recovery hook (and the later
 * drill) can record reviews, and so deprogression can read them. Signed-in only:
 * recordReview is a no-op while signed out (anonymous runs are transient).
 */
interface ConceptReviewValue {
  reviews: ReadonlyMap<ConceptId, ConceptReview>
  recordReview: (conceptId: ConceptId, correct: boolean) => void
  /**
   * Trial checkpoint boost: promotes a concept one rung on a clean pass (else
   * refreshes recency), bypassing the massed-practice rule. Signed-in only.
   */
  reinforce: (conceptId: ConceptId, cleanPass: boolean) => void
}

const ConceptReviewContext = createContext<ConceptReviewValue | null>(null)

export function ConceptReviewProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const repo = useMemo(() => createFirestoreProgressRepository(db), [])
  const [reviews, setReviews] = useState<Map<ConceptId, ConceptReview>>(
    () => new Map(),
  )
  const loadedUid = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      loadedUid.current = null
      setReviews(new Map())
      return
    }
    if (loadedUid.current === user.uid) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await repo.getConceptReviews(user.uid)
        if (cancelled) return
        setReviews(new Map(rows.map((r) => [r.conceptId, r])))
        loadedUid.current = user.uid
      } catch {
        // Optimistic: a failed load just leaves the cache empty (all fresh).
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, repo])

  const recordReview = useCallback(
    (conceptId: ConceptId, correct: boolean) => {
      const uid = user?.uid
      if (!uid) return // signed-in only
      const now = Date.now()
      setReviews((prev) => {
        const base = prev.get(conceptId) ?? newReview(conceptId, now)
        const nextRow = applyReview(base, { correct, at: now })
        // Optimistic, idempotent (merge setDoc); fire-and-forget like saveProgress.
        void repo.saveConceptReview(uid, nextRow).catch(() => {})
        const next = new Map(prev)
        next.set(conceptId, nextRow)
        return next
      })
    },
    [user, repo],
  )

  const reinforce = useCallback(
    (conceptId: ConceptId, cleanPass: boolean) => {
      const uid = user?.uid
      if (!uid) return // signed-in only
      const now = Date.now()
      setReviews((prev) => {
        const base = prev.get(conceptId) ?? newReview(conceptId, now)
        const nextRow = reinforceCheckpoint(base, { at: now, cleanPass })
        // Optimistic, idempotent (merge setDoc); fire-and-forget like recordReview.
        void repo.saveConceptReview(uid, nextRow).catch(() => {})
        const next = new Map(prev)
        next.set(conceptId, nextRow)
        return next
      })
    },
    [user, repo],
  )

  const value = useMemo<ConceptReviewValue>(
    () => ({ reviews, recordReview, reinforce }),
    [reviews, recordReview, reinforce],
  )

  return (
    <ConceptReviewContext value={value}>{children}</ConceptReviewContext>
  )
}

export function useConceptReviews(): ConceptReviewValue {
  const ctx = useContext(ConceptReviewContext)
  if (!ctx)
    throw new Error("useConceptReviews must be used within ConceptReviewProvider")
  return ctx
}
