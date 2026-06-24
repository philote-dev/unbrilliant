import { useState, type Dispatch } from "react"
import { useReducedMotion } from "motion/react"

import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout, type CostWord } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { RewireSurface } from "@/components/rewire/RewireSurface"
import type { LessonAction } from "@/features/lesson/engine"
import {
  canCheckHash,
  chainAfter,
  currentPartHash,
  isDragPart,
  isTapPart,
  isTerminalHash,
  legalBuckets,
  partQuotaHash,
  searchTrail,
  type HashCost,
  type HashQuestion,
  type HashTablesState,
} from "@/features/lesson/hashTablesEngine"
import { HashBox } from "./HashBox"
import { HashTable } from "./HashTable"

/** The id of the draggable key tile on drag beats. */
const KEY_SOURCE = "hash-key"

export function HashTablesStage({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const part = currentPartHash(state)
  // Key each part so per-beat local state (a teach step, a lookup trace cursor)
  // resets cleanly when the beat changes; two lookup beats render back to back.
  if (part === "demo" || part === "teach-hash" || part === "teach-collision") {
    return <IntroPart key={part} state={state} dispatch={dispatch} />
  }
  if (isDragPart(part)) return <DragPart key={part} state={state} dispatch={dispatch} />
  if (isTapPart(part)) return <LocatePart key={part} state={state} dispatch={dispatch} />
  return <CollisionPart key={part} state={state} dispatch={dispatch} />
}

/* --------------------------- intro / teach beats --------------------------- */

function IntroPart({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  // teach-collision: the second key joins the SAME bucket's chain on a step.
  const [joined, setJoined] = useState(false)
  if (!q) return null
  const isCollision = q.kind === "teach-collision"

  // Split the colliding bucket's chain into the keys already there and the one
  // that joins, so the step button animates only the newcomer (snaps if reduced).
  const collideBucket = 4
  const fullChain = q.table[collideBucket] ?? []
  const baseChain = fullChain.slice(0, -1)
  const joiningKey = fullChain[fullChain.length - 1]
  const collisionTable = joined
    ? { [collideBucket]: fullChain }
    : { [collideBucket]: baseChain }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">
          {q.kind === "teach-collision"
            ? "Two keys, one bucket"
            : "Hash Tables: jump, don't search"}
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
        {isCollision ? (
          <>
            <HashTable
              bucketCount={q.bucketCount}
              table={collisionTable}
              mode="display"
              highlightBucket={collideBucket}
              newestBucket={joined ? collideBucket : undefined}
              appendingBucket={joined ? collideBucket : undefined}
            />
            {joined ? (
              <p className="max-w-xs text-center text-sm font-medium text-foreground">
                {joiningKey} collides with {baseChain.join(", ")}, so it chains onto
                the end of bucket {collideBucket}.
              </p>
            ) : (
              <Button variant="soft" size="sm" onClick={() => setJoined(true)}>
                Drop the second key
              </Button>
            )}
          </>
        ) : (
          <>
            {q.key && <HashBox question={q} revealBucket={q.kind === "demo"} />}
            <HashTable bucketCount={q.bucketCount} table={q.table} mode="display" />
          </>
        )}
      </div>

      <div className="mt-auto">
        <Button
          variant="tactile"
          size="lg"
          className="w-full"
          onClick={() => dispatch({ type: "continue" })}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------- shared header ------------------------------ */

function BinHeader({ state }: { state: HashTablesState }) {
  const q = state.question
  const quota = partQuotaHash(state)
  const binLabel =
    q?.bin === "hash" ? "Hash" : q?.bin === "collision" ? "Collision" : "Lookup"
  return (
    <div className="mt-7">
      {quota && (
        <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
          {binLabel} · {quota.done} / {quota.total} correct
        </p>
      )}
      <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">
        {q?.prompt}
      </h2>
    </div>
  )
}

function feedbackCopy(q: HashQuestion) {
  return { prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }
}

/* ------------------------------- drag beats -------------------------------- */

function DragPart({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q || q.key == null) return null
  const { feedback, showWhy } = state
  const correct = feedback === "correct"
  // On a correct drop, show the key landed in its bucket (the table is "given",
  // so append for the confirmation view only).
  const view = correct
    ? { ...q.table, [q.bucket]: chainAfter(q.table[q.bucket] ?? [], q.key) }
    : q.table

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col justify-center py-5">
        <RewireSurface
          legalTargets={legalBuckets(state)}
          onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
          label={`Run the hash, then drag ${q.key} into its ${q.contacts ? "slot" : "bucket"}`}
          className="flex flex-col items-center gap-5"
        >
          <HashBox question={q} dragSourceId={KEY_SOURCE} />
          <HashTable
            bucketCount={q.bucketCount}
            table={view}
            mode={correct ? "display" : "drag"}
            highlightBucket={correct ? q.bucket : undefined}
            newestBucket={correct ? q.bucket : undefined}
            appendingBucket={correct ? q.bucket : undefined}
            contacts={q.contacts}
          />
        </RewireSurface>
      </div>

      {correct && q.cost && (
        <div className="mb-4 flex justify-center">
          <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
        </div>
      )}

      <FeedbackFooter
        feedback={feedback}
        selected={null}
        canCheck={canCheckHash(state)}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}

/* ------------------------- tap-locate beats (lookup) ------------------------ */

function LocatePart({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  // A LOCAL trace cursor over the bucket's chain (illustration only; the verdict
  // still comes from the engine). -1 means "not started".
  const [cursor, setCursor] = useState(-1)
  const [announce, setAnnounce] = useState("")
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const correct = feedback === "correct"
  const terminal = isTerminalHash(state)

  const trail = searchTrail(q.key ?? "", q.table, q.bucketCount)
  const canTrace = q.bin === "lookup" && trail.chain.length > 0
  // Stop at the hit, or at the chain's end when absent.
  const stopIndex = trail.foundIndex >= 0 ? trail.foundIndex : trail.chain.length - 1
  const traceDone = cursor >= stopIndex
  const showFound = trail.foundIndex >= 0 && cursor >= trail.foundIndex

  // The cumulative readout up to `upto`: "checking owl, checking fox, found fox in
  // bucket 0" on a hit, or "...checking elk, not in bucket 3, absent" when absent.
  const describe = (upto: number): string => {
    const parts: string[] = []
    for (let i = 0; i <= upto && i < trail.chain.length; i++) {
      parts.push(`checking ${trail.chain[i]}`)
      if (trail.foundIndex === i) {
        parts.push(`found ${q.key} in bucket ${trail.bucket}`)
        return parts.join(", ")
      }
    }
    if (trail.foundIndex < 0 && upto >= trail.chain.length - 1) {
      parts.push(`not in bucket ${trail.bucket}, absent`)
    }
    return parts.join(", ")
  }

  const trace = () => {
    const target = reduced ? stopIndex : Math.min(stopIndex, cursor + 1)
    setCursor(target)
    setAnnounce(describe(target))
  }

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-5">
        <HashBox question={q} />
        <HashTable
          bucketCount={q.bucketCount}
          table={q.table}
          mode={terminal ? "display" : "tap"}
          selected={selected}
          highlightBucket={correct ? q.bucket : undefined}
          correctTarget={q.answer}
          searchBucket={canTrace ? q.bucket : undefined}
          searchActiveIndex={cursor}
          foundIndex={showFound ? trail.foundIndex : undefined}
          onTap={(id) => dispatch({ type: "select", letter: id })}
        />
        {canTrace && (
          <div className="flex flex-col items-center gap-2">
            <Button variant="soft" size="sm" disabled={traceDone} onClick={trace}>
              Trace the lookup
            </Button>
            <p
              role="status"
              aria-live="polite"
              className="min-h-5 max-w-xs text-center text-sm text-muted-foreground"
            >
              {announce}
            </p>
          </div>
        )}
        {correct && (
          <p className="text-center text-sm font-medium text-foreground">
            {q.present
              ? `${q.key} is here — bucket ${q.bucket}.`
              : `${q.key} is not in bucket ${q.bucket} — absent.`}
          </p>
        )}
      </div>

      {correct && q.cost && (
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          <LabeledCost label="Hash lookup" cost={q.cost} />
          {q.scanCost && <LabeledCost label="List scan" cost={q.scanCost} />}
        </div>
      )}

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        canCheck={canCheckHash(state)}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}

/* ----------------------- collision beats (predict MCQ) --------------------- */

function CollisionPart({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q || q.key == null) return null
  const { feedback, selected, showWhy } = state
  const correct = feedback === "correct"
  const terminal = isTerminalHash(state)

  const view = correct
    ? { ...q.table, [q.bucket]: chainAfter(q.table[q.bucket] ?? [], q.key) }
    : q.table

  const cardState = (id: string): AnswerState => {
    if (feedback === "correct") return id === q.answer ? "correct" : "default"
    if (feedback === "nudge") return id === selected ? "nudge" : "default"
    if (feedback === "fail") {
      if (showWhy && id === q.answer) return "correct"
      if (id === selected) return "fail"
      return "default"
    }
    return id === selected ? "selected" : "default"
  }

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex justify-center py-4">
        <HashTable
          bucketCount={q.bucketCount}
          table={view}
          mode="display"
          highlightBucket={q.bucket}
          newestBucket={correct ? q.bucket : undefined}
          appendingBucket={correct ? q.bucket : undefined}
        />
      </div>

      <div className="flex flex-col gap-3">
        {q.options.map((opt, i) => (
          <AnswerCard
            key={opt.id}
            letter={String.fromCharCode(65 + i)}
            label={opt.label}
            state={cardState(opt.id)}
            disabled={terminal}
            answerMarker={opt.id === q.answer}
            onSelect={() => dispatch({ type: "select", letter: opt.id })}
          />
        ))}
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        canCheck={canCheckHash(state)}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}

/* --------------------------------- shared --------------------------------- */

function LabeledCost({ label, cost }: { label: string; cost: HashCost }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <CostReadout
        word={cost.word as CostWord}
        count={cost.count}
        unit={cost.unit}
      />
    </div>
  )
}
