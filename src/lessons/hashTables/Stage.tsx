import { useState, type Dispatch, type ReactNode } from "react"
import { useReducedMotion } from "motion/react"

import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout, type CostWord } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { RewireSurface } from "@/components/rewire/RewireSurface"
import type { LessonAction } from "@/features/lesson/engine"
import {
  bucketIndexOf,
  canCheckHash,
  chainAfter,
  collisionCount,
  currentPartHash,
  designDistribution,
  distribute,
  isTapPart,
  isTerminalHash,
  legalBuckets,
  partQuotaHash,
  searchTrail,
  type CombineRule,
  type HashCost,
  type HashQuestion,
  type HashTablesState,
} from "@/features/lesson/hashTablesEngine"
import { StageSplit, StageCenter } from "@/components/willow/lesson/StageLayout"
import { AbstractDemo } from "./AbstractDemo"
import { HashBox } from "./HashBox"
import { HashBuilder } from "./HashBuilder"
import { HashFlyReplay } from "./HashFlyReplay"
import { HashTable } from "./HashTable"
import { WarehouseShelf } from "./WarehouseShelf"
import { WarehouseFooter, WarehouseHeader, WarehousePage } from "./warehouseChrome"

/** The id of the draggable key tile on the insert (drag) beats. */
const KEY_SOURCE = "hash-key"

export function HashTablesStage({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const part = currentPartHash(state)
  // Key each part so per-beat local state (a teach step, a lookup scan cursor, the
  // sandbox drop set) resets cleanly when the beat changes.
  if (part === "demo") return <DemoPart key={part} state={state} dispatch={dispatch} />
  if (part === "teach-hash") return <TeachHashPart key={part} state={state} dispatch={dispatch} />
  if (part === "teach-collision") {
    return <TeachCollisionPart key={part} state={state} dispatch={dispatch} />
  }
  if (part === "hash-build-demo") return <SandboxPart key={part} state={state} dispatch={dispatch} />
  if (part === "hash-design") return <DesignPart key={part} state={state} dispatch={dispatch} />
  // The real-world beat transforms the page into the warehouse (full-bleed); the
  // warehouse skin is reserved for this graded payoff only.
  if (part === "realworld") return <StowPart key={part} state={state} dispatch={dispatch} />
  if (isTapPart(part)) return <LocatePart key={part} state={state} dispatch={dispatch} />
  if (part === "hash-cat" || part === "hash-dog") {
    return <DragPart key={part} state={state} dispatch={dispatch} />
  }
  return <CollisionPart key={part} state={state} dispatch={dispatch} />
}

/* -------------------------------- shared bits ------------------------------ */

/** The house teach/intro kicker: a small, wide-tracked lilac eyebrow. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-lilac-strong">
      {children}
    </p>
  )
}

function ContinueButton({ dispatch }: { dispatch: Dispatch<LessonAction> }) {
  return (
    <Button
      variant="tactile"
      size="lg"
      className="w-full"
      onClick={() => dispatch({ type: "continue" })}
    >
      Continue
    </Button>
  )
}

/* --------------------------- abstract demo (beat 1) ------------------------- */

/**
 * Beat 1, the abstract two-scenario demo (ungraded free play). Willow-styled: the
 * learner picks a key and watches a sorted scan (scales) versus a hashed jump
 * (free). No warehouse here; that skin is reserved for the graded realworld beat.
 */
function DemoPart({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <Eyebrow>Hashing</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">
          Find one among many
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">
          You can <span className="concept">scan</span> a list until you reach it, or{" "}
          <span className="concept" style={{ animationDelay: "650ms" }}>
            jump
          </span>{" "}
          straight to where it lives.
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <AbstractDemo />
      </div>

      <div className="mt-auto">
        <ContinueButton dispatch={dispatch} />
      </div>
    </StageCenter>
  )
}

/* ------------------------- teach-hash (interactive) ------------------------ */

/**
 * Beat 2, the interactive teach (wires the built-but-dark `HashBox` reveal): the
 * learner steps the letters, the box computes `sum mod B`, and the key flies to
 * its bin, which then appears in the table below. Animation-driven teaching with
 * concept glow; ungraded. Reduced motion snaps the landing with no timers.
 */
function TeachHashPart({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  const [landed, setLanded] = useState(false)
  if (!q || q.key == null) return null
  const landedTable = landed ? { [q.bucket]: [q.key] } : {}

  return (
    <StageCenter>
      <div className="mt-7 text-center animate-fade-in">
        <Eyebrow>Hashing</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">
          A key knows its own bin
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">
          A hash turns a <span className="concept">key</span> into a{" "}
          <span className="concept" style={{ animationDelay: "450ms" }}>
            location
          </span>
          : add the letters, then{" "}
          <span className="concept" style={{ animationDelay: "900ms" }}>
            mod the bins
          </span>
          .
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
        <HashBox question={q} reveal onResolved={() => setLanded(true)} />
        <HashTable
          bucketCount={q.bucketCount}
          table={landedTable}
          mode="display"
          highlightBucket={landed ? q.bucket : undefined}
          newestBucket={landed ? q.bucket : undefined}
          appendingBucket={landed ? q.bucket : undefined}
          appendEnterOffset={{ y: -28 }}
          reducedMotion={reduced}
        />
      </div>

      <div className="mt-auto">
        <ContinueButton dispatch={dispatch} />
      </div>
    </StageCenter>
  )
}

/* ----------------------- teach-collision (animated) ----------------------- */

/**
 * Beat 6, the collision teach: a second key flies into an occupied bin and chains
 * onto the tail, played over time through the shared `FrameSequence` (the lesson's
 * signature append animation) with a Replay control. Concept glow; ungraded.
 */
function TeachCollisionPart({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  // The fixture chain is { 4: [cat, sun] }; replay sun joining cat.
  const collideBucket = 4
  const fullChain = q.table[collideBucket] ?? ["cat", "sun"]
  const baseChain = fullChain.slice(0, -1)
  const joining = fullChain[fullChain.length - 1] ?? "sun"
  const baseTable = { [collideBucket]: baseChain }

  return (
    <StageCenter>
      <div className="mt-7 text-center animate-fade-in">
        <Eyebrow>Collisions</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">
          Two keys, one bin
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">
          When two keys hash to the <span className="concept">same bin</span>, the bin keeps
          both in a{" "}
          <span className="concept" style={{ animationDelay: "650ms" }}>
            little chain
          </span>
          .
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
        <HashFlyReplay
          keyName={joining}
          table={baseTable}
          bucketCount={q.bucketCount}
          reduced={reduced}
          caption={(landed, bucket) =>
            landed
              ? `${joining} collides with ${baseChain.join(", ")}, so it chains onto the end of bin ${bucket}.`
              : `${joining} also hashes to bin ${bucket}, where ${baseChain.join(", ")} already sits.`
          }
        />
      </div>

      <div className="mt-auto">
        <ContinueButton dispatch={dispatch} />
      </div>
    </StageCenter>
  )
}

/* ------------------------------- shared header ----------------------------- */

function BinHeader({ state }: { state: HashTablesState }) {
  const q = state.question
  const quota = partQuotaHash(state)
  const binLabel =
    q?.bin === "hash"
      ? "Insert"
      : q?.bin === "collision"
        ? "Shared bin"
        : q?.bin === "design"
          ? "Design"
          : "Find"
  return (
    <div className="mt-7">
      {quota && (
        <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
          {binLabel} · {quota.done} / {quota.total} correct
        </p>
      )}
      <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground lg:text-2xl">
        {q?.prompt}
      </h2>
    </div>
  )
}

function feedbackCopy(q: HashQuestion) {
  return { prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }
}

/* -------------------- make-a-hash sandbox (hash-build-demo) ----------------- */

/**
 * Beat 10, the free-play hash-builder sandbox (ungraded): the learner picks a
 * combine rule (sum / first letter / length) AND the bucket count, then drops
 * keys from the pool and watches them land or collide live. It teaches concept 9
 * by exploration: a hash is a choice, and a weak rule (first letter, length)
 * piles keys up while summing the whole key spreads them. Reduced-motion safe.
 */
function SandboxPart({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  const spec = q?.design
  const [rule, setRule] = useState<CombineRule>(spec?.defaultRule ?? "sum")
  const [buckets, setBuckets] = useState<number>(spec?.defaultBuckets ?? 5)
  const [dropped, setDropped] = useState<string[]>([])
  if (!q || !spec) return null

  const table = distribute(rule, buckets, dropped)
  const collisions = collisionCount(table)
  const allDropped = dropped.length === spec.keys.length

  const drop = (key: string) => {
    if (dropped.includes(key)) return
    setDropped((d) => [...d, key])
  }

  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <Eyebrow>Make a hash</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">
          Your hash, your rules
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">
          A hash is a <span className="concept">choice</span>. Pick how to combine a key and how
          many bins, drop keys, and watch what{" "}
          <span className="concept" style={{ animationDelay: "650ms" }}>
            collides
          </span>
          .
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-5">
        {/* the key pool: tap to drop a key into the bins */}
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {allDropped ? "All keys dropped" : "Tap a key to drop it in"}
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {spec.keys.map((key) => {
              const isDropped = dropped.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isDropped}
                  onClick={() => drop(key)}
                  className={
                    "rounded-lg border-2 px-2.5 py-1 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-lilac-strong/60 " +
                    (isDropped
                      ? "cursor-default border-border bg-muted text-faint"
                      : "border-lilac-strong/60 bg-card text-foreground hover:bg-lilac-soft")
                  }
                >
                  {key}
                </button>
              )
            })}
          </div>
        </div>

        <HashBuilder
          rule={rule}
          buckets={buckets}
          ruleOptions={spec.ruleOptions}
          bucketOptions={spec.bucketOptions}
          table={table}
          collisions={collisions}
          onPickRule={setRule}
          onPickBuckets={setBuckets}
          reducedMotion={reduced}
        />
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            disabled={dropped.length === 0}
            onClick={() => setDropped([])}
          >
            Clear
          </Button>
          <Button
            variant="soft"
            size="lg"
            className="flex-1"
            disabled={allDropped}
            onClick={() => setDropped(spec.keys.slice())}
          >
            Drop all
          </Button>
        </div>
        <ContinueButton dispatch={dispatch} />
      </div>
    </StageCenter>
  )
}

/* ----------------------- design challenge (hash-design) -------------------- */

/**
 * Beat 11, the graded design challenge (the new design bin): the learner designs a
 * hash (a combine rule + a bucket count) that gives every target key its own bin.
 * It opens on a deliberately weak choice that still collides; only a rule that
 * reads the whole key (sum) can separate the keys, the concept-9 payoff. The
 * engine grades the chosen distribution (zero collisions clears it).
 */
function DesignPart({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  const spec = q?.design
  if (!q || !spec) return null
  const { feedback, showWhy } = state
  const terminal = isTerminalHash(state)
  const rule = state.designRule ?? spec.defaultRule
  const buckets = state.designBuckets ?? spec.defaultBuckets
  const table = designDistribution(state) ?? distribute(rule, buckets, spec.keys)
  const collisions = collisionCount(table)

  return (
    <StageCenter>
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          A good hash <span className="concept">spreads keys</span> so each gets its{" "}
          <span className="concept" style={{ animationDelay: "450ms" }}>
            own bin
          </span>
          .
        </p>
        <HashBuilder
          rule={rule}
          buckets={buckets}
          ruleOptions={spec.ruleOptions}
          bucketOptions={spec.bucketOptions}
          table={table}
          collisions={collisions}
          onPickRule={(r) => dispatch({ type: "select", letter: `rule:${r}` })}
          onPickBuckets={(b) => dispatch({ type: "select", letter: `buckets:${b}` })}
          disabled={terminal}
          reducedMotion={reduced}
        />
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={null}
        canCheck={canCheckHash(state)}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </StageCenter>
  )
}

/* ----------------------------- insert (drag) beats ------------------------- */

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
  // On a correct drop, show the item landed in its bin (the table is "given", so
  // append for the confirmation view only).
  const view = correct
    ? { ...q.table, [q.bucket]: chainAfter(q.table[q.bucket] ?? [], q.key) }
    : q.table

  return (
    <StageCenter>
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col justify-center py-5">
        <RewireSurface
          legalTargets={legalBuckets(state)}
          onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
          label={`Scan the index, then drag ${q.key} into its bin`}
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
    </StageCenter>
  )
}

/* ------------------- real-world beat (full-bleed warehouse) ---------------- */

function StowPart({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion()
  if (!q || q.key == null) return null
  const { feedback, showWhy } = state
  const correct = feedback === "correct"
  // The package sits in the bin the learner chose (placement), not the right one.
  const placedBucket = state.placement != null ? bucketIndexOf(state.placement) : null
  const quota = partQuotaHash(state)

  return (
    <StageCenter>
      <WarehousePage reduced={reduced}>
        <WarehouseHeader
          title="Stow station"
          meta={quota ? `${quota.done}/${quota.total} stowed` : "Inbound"}
          prompt={q.prompt}
        />

        <div className="flex flex-1 flex-col justify-center py-3">
          <RewireSurface
            legalTargets={legalBuckets(state)}
            onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
            label={`Scan ${q.key}, then drop the package in its bin`}
          >
            <WarehouseShelf
              question={q}
              placedBucket={placedBucket}
              confirmed={correct}
              reducedMotion={!!reduced}
            />
          </RewireSurface>
        </div>

        {/* Reserve the cost row so the verdict's readout slots in without a jump. */}
        <div className="flex min-h-[92px] shrink-0 items-start justify-center">
          {correct && q.cost && (
            <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
          )}
        </div>

        <WarehouseFooter
          feedback={feedback}
          showWhy={showWhy}
          canCheck={canCheckHash(state)}
          copy={feedbackCopy(q)}
          dispatch={dispatch}
        />
      </WarehousePage>
    </StageCenter>
  )
}

/* ------------------------- tap-locate beats (pick) ------------------------- */

function LocatePart({
  state,
  dispatch,
}: {
  state: HashTablesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  // A LOCAL scan cursor over the bin's chain (illustration only; the verdict
  // still comes from the engine). -1 means "not started".
  const [cursor, setCursor] = useState(-1)
  const [announce, setAnnounce] = useState("")
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const correct = feedback === "correct"
  const terminal = isTerminalHash(state)

  // Lookup bins are sealed until the learner commits: at idle the contents are
  // hidden (so the key cannot be read off and the target bin is not "the only
  // non-empty one"); the real chains, the trace, and the verdict reveal only
  // post-commit. The learner must hash the key to choose the bin.
  const sealed = q.bin === "lookup" && !terminal
  const trail = searchTrail(q.key ?? "", q.table, q.bucketCount)
  const canTrace = q.bin === "lookup" && terminal && trail.chain.length > 0
  // Stop at the hit, or at the chain's end when absent.
  const stopIndex = trail.foundIndex >= 0 ? trail.foundIndex : trail.chain.length - 1
  const traceDone = cursor >= stopIndex
  const showFound = trail.foundIndex >= 0 && cursor >= trail.foundIndex

  // The cumulative readout up to `upto`: "checking owl, checking fox, found fox in
  // bin 0" on a hit, or "...checking elk, not in bin 3, absent" when absent.
  const describe = (upto: number): string => {
    const parts: string[] = []
    for (let i = 0; i <= upto && i < trail.chain.length; i++) {
      parts.push(`checking ${trail.chain[i]}`)
      if (trail.foundIndex === i) {
        parts.push(`found ${q.key} in bin ${trail.bucket}`)
        return parts.join(", ")
      }
    }
    if (trail.foundIndex < 0 && upto >= trail.chain.length - 1) {
      parts.push(`not in bin ${trail.bucket}, absent`)
    }
    return parts.join(", ")
  }

  const trace = () => {
    const target = reduced ? stopIndex : Math.min(stopIndex, cursor + 1)
    setCursor(target)
    setAnnounce(describe(target))
  }

  return (
    <StageCenter>
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-5">
        <HashBox question={q} />
        <HashTable
          bucketCount={q.bucketCount}
          table={q.table}
          mode={terminal ? "display" : "tap"}
          masked={sealed}
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
              Scan the bin
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
              ? `${q.key} is here, in bin ${q.bucket}.`
              : `${q.key} is not in bin ${q.bucket}: absent.`}
          </p>
        )}
      </div>

      {/* Reserve the cost row's height so the verdict's paired readouts slot in
          without shoving the figure (free vs scales appear only once correct). */}
      <div className="mb-4 flex min-h-[112px] flex-wrap items-start justify-center gap-2">
        {correct && q.cost && (
          <>
            <LabeledCost label="Index jump" cost={q.cost} />
            {q.scanCost && <LabeledCost label="Linear scan" cost={q.scanCost} />}
          </>
        )}
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
    </StageCenter>
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
    <StageSplit
      header={<BinHeader state={state} />}
      figure={
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
      }
      interaction={
        <>
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
        </>
      }
    />
  )
}

/* --------------------------------- shared --------------------------------- */

function LabeledCost({ label, cost }: { label: string; cost: HashCost }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <CostReadout word={cost.word as CostWord} count={cost.count} unit={cost.unit} />
    </div>
  )
}
