import {
  useEffect,
  useState,
  type ComponentType,
  type Dispatch,
  type ReactNode,
} from "react"
import {
  Archive,
  ArrowDownUp,
  BookOpen,
  Check,
  ChevronDown,
  FolderTree,
  Image,
  Music,
  Package,
  Search,
  Users,
  Wifi,
  X,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { StageCenter } from "@/components/willow/lesson/StageLayout"
import type { LessonAction } from "@/features/lesson/engine"
import {
  JOBS,
  currentBeat,
  isCheckBeat,
  isTerminal,
  partQuota,
  type Beat,
  type IntroOption,
  type IntroState,
  type ReadBeat,
  type WelcomeBeat,
} from "@/features/lesson/introEngine"

type CheckBeat = Extract<Beat, { kind: "check" }>

/** How long the teach line rests alone before the question pops up (Prototype A). */
const REVEAL_DELAY_MS = 850
/** Reading-glow pacing: first concept lights up here, each next one this much later. */
const GLOW_START_MS = 600
const GLOW_STEP_MS = 750

/**
 * One Stage for both intro prototypes. The variant lives on the state:
 *  - "reveal" (A): each check shows its "Quick idea" first, then the question pops in.
 *  - "pages"  (B): large, centered reading pages first, then the same checks.
 */
export function IntroStage({
  state,
  dispatch,
}: {
  state: IntroState
  dispatch: Dispatch<LessonAction>
}) {
  if (state.completed) return <DonePart />
  const beat = currentBeat(state)
  if (beat.kind === "welcome") return <WelcomePart beat={beat} dispatch={dispatch} />
  if (isCheckBeat(beat)) {
    return <CheckPart key={beat.id} beat={beat} state={state} dispatch={dispatch} />
  }
  return <ReadPart key={beat.id} beat={beat} dispatch={dispatch} />
}

/* --------------------------------- shared --------------------------------- */

function Eyebrow({ children, className }: { children: string; className?: string }) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.18em] text-lilac-strong",
        className,
      )}
    >
      {children}
    </p>
  )
}

function QuotaLine({ state }: { state: IntroState }) {
  const quota = partQuota(state)
  if (!quota) return null
  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-lilac-strong">
      {quota.done} / {quota.total} correct
    </p>
  )
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

type GlowFn = (text: string, key: string) => ReactNode

/**
 * Build a glow renderer for a page: the authored `highlights` light up one after
 * another (a reading guide) and rest in lilac (the `.concept` class in index.css).
 * The returned fn keeps a running counter so concepts stagger in reading order even
 * when spread across separate paragraphs and example rows.
 */
function createGlow(highlights?: string[]): GlowFn {
  const phrases = highlights ?? []
  const re = phrases.length
    ? new RegExp(`(${phrases.map(escapeRe).join("|")})`, "g")
    : null
  let order = 0
  return (text, key) => {
    if (!re) return text
    return text.split(re).map((part, i) => {
      if (phrases.includes(part)) {
        const delay = GLOW_START_MS + order * GLOW_STEP_MS
        order += 1
        return (
          <span key={`${key}-${i}`} className="concept" style={{ animationDelay: `${delay}ms` }}>
            {part}
          </span>
        )
      }
      return <span key={`${key}-${i}`}>{part}</span>
    })
  }
}

function GlowParagraphs({
  glow,
  body,
  className,
}: {
  glow: GlowFn
  body: string[]
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {body.map((para, i) => (
        <p
          key={i}
          className="text-pretty text-xl leading-relaxed text-foreground/90 lg:text-2xl"
        >
          {glow(para, `p${i}`)}
        </p>
      ))}
    </div>
  )
}

/* -------------------------------- phone figure ------------------------------- */

const PHONE_APPS: { id: string; Icon: ComponentType<{ className?: string }>; label: string }[] =
  [
    { id: "contacts", Icon: Users, label: "Contacts" },
    { id: "photos", Icon: Image, label: "Photos" },
    { id: "music", Icon: Music, label: "Music" },
  ]

/** A tall iPhone mockup (Dynamic Island + home indicator) whose apps pop in. */
function PhoneFigure() {
  return (
    <div className="relative mx-auto flex aspect-[9/19] w-[166px] flex-col rounded-[2.8rem] border-[3px] border-foreground/15 bg-card px-3 pb-5 pt-10 shadow-card lg:w-[184px]">
      {/* Dynamic Island */}
      <div className="absolute left-1/2 top-3 flex h-[1.2rem] w-[4.5rem] -translate-x-1/2 items-center justify-end rounded-full bg-neutral-900 pr-1.5">
        <span className="size-1.5 rounded-full bg-neutral-600" />
      </div>
      {/* screen content, centered in the taller body */}
      <div className="flex flex-1 flex-col justify-center gap-3">
        {PHONE_APPS.map(({ id, Icon, label }, i) => (
          <div
            key={id}
            className="flex items-center gap-2.5 rounded-2xl bg-lilac-soft px-2.5 py-2.5 animate-pop-in"
            style={{ animationDelay: `${300 + i * 130}ms` }}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-lilac-strong shadow-soft">
              <Icon className="size-4" />
            </span>
            <span className="text-sm font-semibold text-foreground">{label}</span>
          </div>
        ))}
      </div>
      {/* home indicator */}
      <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-foreground/20" />
    </div>
  )
}

/* -------------------------------- example rows ------------------------------- */

const EXAMPLE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  package: Package,
  book: BookOpen,
}

/* --------------------------------- job cards -------------------------------- */

const JOB_ICON: Record<string, ComponentType<{ className?: string }>> = {
  store: Archive,
  sort: ArrowDownUp,
  categorize: FolderTree,
}

/** The three jobs as the page's main content: tap a card to reveal its meaning. */
function JobCards() {
  const [open, setOpen] = useState<string[]>([])
  const toggle = (id: string) =>
    setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  return (
    <div className="space-y-3">
      <p className="mb-1 text-center text-sm font-medium text-faint">
        Tap each card to reveal what it does
      </p>
      {JOBS.map((job) => {
        const Icon = JOB_ICON[job.id]
        const isOpen = open.includes(job.id)
        return (
          <button
            key={job.id}
            type="button"
            onClick={() => toggle(job.id)}
            aria-expanded={isOpen}
            className={cn(
              "flex w-full items-center gap-4 rounded-2xl border-2 bg-card p-5 text-left shadow-soft outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isOpen ? "border-lilac-strong/55" : "border-border hover:border-lilac-strong/40",
            )}
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-lilac-soft text-lilac-strong">
              {Icon ? <Icon className="size-7" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xl font-bold text-foreground">{job.word}</p>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-faint transition-transform duration-300",
                    isOpen && "rotate-180 text-lilac-strong",
                  )}
                />
              </div>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="pt-1.5 text-lg font-medium leading-snug text-foreground/85 lg:text-xl">
                      {job.line}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------- welcome hero ------------------------------- */

function WelcomePart({
  beat,
  dispatch,
}: {
  beat: WelcomeBeat
  dispatch: Dispatch<LessonAction>
}) {
  const reduce = !!useReducedMotion()
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
  }
  const riseV: Variants = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 30 } },
  }

  return (
    <StageCenter maxWidthClass="max-w-xl">
      <motion.div
        className="flex flex-1 flex-col items-center text-center"
        variants={container}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        <div className="flex-1" />
        <motion.span
          variants={riseV}
          className="mb-7 h-1.5 w-12 rounded-full bg-lilac-strong"
        />
        <motion.h1
          variants={riseV}
          className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground lg:text-6xl"
        >
          {beat.headline}
        </motion.h1>
        <motion.p
          variants={riseV}
          className="mt-6 max-w-md text-pretty text-base leading-relaxed text-muted-foreground lg:text-lg"
        >
          {beat.sub}
        </motion.p>
        <div className="flex-1" />
        <motion.div variants={riseV} className="w-full">
          <Button
            variant="tactile"
            size="lg"
            className="w-full"
            onClick={() => dispatch({ type: "continue" })}
          >
            {beat.cta}
          </Button>
        </motion.div>
      </motion.div>
    </StageCenter>
  )
}

/* ------------------------------- reading beats ------------------------------ */

function ContinueButton({
  beat,
  dispatch,
}: {
  beat: ReadBeat
  dispatch: Dispatch<LessonAction>
}) {
  return (
    <Button
      variant="tactile"
      size="lg"
      className="mt-6 w-full"
      onClick={() => dispatch({ type: "continue" })}
    >
      {beat.cta ?? "Continue"}
    </Button>
  )
}

function ReadPart({
  beat,
  dispatch,
}: {
  beat: ReadBeat
  dispatch: Dispatch<LessonAction>
}) {
  const glow = createGlow(beat.highlights)

  if (beat.figure === "phone") {
    return (
      <StageCenter maxWidthClass="max-w-xl">
        <div className="mt-8 text-center animate-fade-in">
          <Eyebrow>{beat.eyebrow}</Eyebrow>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground lg:text-5xl">
            {beat.title}
          </h2>
        </div>
        <div className="flex flex-1 items-center justify-center py-6">
          <PhoneFigure />
        </div>
        <GlowParagraphs glow={glow} body={beat.body} className="text-center" />
        <ContinueButton beat={beat} dispatch={dispatch} />
      </StageCenter>
    )
  }

  if (beat.examples) {
    return (
      <StageCenter maxWidthClass="max-w-xl">
        <div className="flex flex-1 flex-col items-center justify-center py-6 animate-fade-in">
          <Eyebrow>{beat.eyebrow}</Eyebrow>
          <h2 className="mt-3 text-center text-balance text-3xl font-bold tracking-tight text-foreground lg:text-5xl">
            {beat.title}
          </h2>
          <div className="mt-7 w-full space-y-4">
            {beat.examples.map((ex, i) => {
              const Icon = EXAMPLE_ICON[ex.icon]
              return (
                <div key={i} className="flex items-center gap-3.5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lilac-soft text-lilac-strong">
                    {Icon ? <Icon className="size-6" /> : null}
                  </span>
                  <p className="text-pretty text-lg leading-snug text-foreground/90 lg:text-xl">
                    {glow(ex.text, `e${i}`)}
                  </p>
                </div>
              )
            })}
          </div>
          {beat.body.length > 0 && (
            <p className="mt-7 text-center text-pretty text-lg leading-relaxed text-muted-foreground lg:text-xl">
              {glow(beat.body[0], "tk")}
            </p>
          )}
        </div>
        <ContinueButton beat={beat} dispatch={dispatch} />
      </StageCenter>
    )
  }

  if (beat.jobs) {
    return (
      <StageCenter maxWidthClass="max-w-xl">
        <div className="mt-8 flex flex-1 flex-col">
          <div className="text-center animate-fade-in">
            <Eyebrow>{beat.eyebrow}</Eyebrow>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground lg:text-5xl">
              {beat.title}
            </h2>
            <GlowParagraphs glow={glow} body={beat.body} className="mt-5 text-center" />
          </div>
          <div className="mt-7">
            <JobCards />
          </div>
        </div>
        <ContinueButton beat={beat} dispatch={dispatch} />
      </StageCenter>
    )
  }

  return (
    <StageCenter maxWidthClass="max-w-xl">
      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center animate-fade-in">
        <Eyebrow>{beat.eyebrow}</Eyebrow>
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground lg:text-5xl">
          {beat.title}
        </h2>
        <GlowParagraphs glow={glow} body={beat.body} className="mt-6" />
      </div>
      <ContinueButton beat={beat} dispatch={dispatch} />
    </StageCenter>
  )
}

/* ------------------------------- object options ----------------------------- */

const OBJ_SURFACE: Record<AnswerState, string> = {
  default: "border-border bg-card hover:border-lilac-strong/45",
  selected: "border-lilac-strong bg-lilac-soft ring-4 ring-lilac-strong/15",
  correct: "border-success bg-success-soft",
  nudge: "border-warning bg-warning-soft",
  fail: "border-danger bg-danger-soft",
}

/* Kraft tones for the shoebox (object colors, theme-independent on purpose). */
const BOX_BODY = "#d6b485"
const BOX_LID = "#c1965f"
const BOX_LABEL = "#f3ead9"

/** A literal shoebox with loose cards poking out of the open top at angles. */
function MessyCards() {
  const cards = [
    { x: -18, r: -17 },
    { x: -6, r: 6 },
    { x: 6, r: -6 },
    { x: 18, r: 18 },
  ]
  return (
    <div className="relative mx-auto h-24 w-28" aria-hidden>
      {/* cards spilling out, drawn first so the box front overlaps their base */}
      {cards.map((c, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-0 h-14 w-8 origin-bottom rounded-[4px] border border-border bg-card shadow-soft"
          style={{ transform: `translateX(calc(-50% + ${c.x}px)) rotate(${c.r}deg)` }}
        >
          <span className="mx-auto mt-2.5 block h-0.5 w-4 rounded-full bg-lilac-strong/45" />
          <span className="mx-auto mt-1 block h-px w-4 rounded-full bg-border" />
        </div>
      ))}
      {/* shoebox */}
      <div
        className="absolute bottom-1 left-1/2 h-11 w-24 -translate-x-1/2 rounded-b-md rounded-t-sm"
        style={{ backgroundColor: BOX_BODY }}
      >
        {/* lid rim, slightly wider than the body */}
        <div
          className="absolute -top-2 left-1/2 h-3.5 w-[108%] -translate-x-1/2 rounded-[5px] shadow-soft"
          style={{ backgroundColor: BOX_LID }}
        />
        {/* label */}
        <div
          className="absolute bottom-2 left-1/2 h-4 w-14 -translate-x-1/2 rounded-sm"
          style={{ backgroundColor: BOX_LABEL }}
        />
      </div>
    </div>
  )
}

/** Alphabetized cards in a 3D-isometric stack, corners labeled A / B / C. */
function NeatCards() {
  const layers = [
    { L: "C", dx: 24, dy: 2 },
    { L: "B", dx: 12, dy: 15 },
    { L: "A", dx: 0, dy: 28 },
  ]
  return (
    <div className="mx-auto flex h-24 w-28 items-center justify-center" aria-hidden>
      <div className="relative h-[84px] w-[94px]" style={{ transform: "skewY(-9deg)" }}>
        {layers.map(({ L, dx, dy }) => (
          <div
            key={L}
            className="absolute h-12 w-[68px] rounded-md border border-lilac-strong/35 bg-lilac-soft shadow-soft"
            style={{ left: dx, top: dy }}
          >
            <span className="absolute left-2 top-1 text-[11px] font-bold text-lilac-strong">
              {L}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CornerBadge({ kind }: { kind: "correct" | "fail" }) {
  const Icon = kind === "correct" ? Check : X
  return (
    <span
      className={cn(
        "absolute right-2 top-2 flex size-6 items-center justify-center rounded-full text-white",
        kind === "correct" ? "bg-success" : "bg-danger",
      )}
    >
      <Icon className="size-3.5" strokeWidth={3} />
    </span>
  )
}

/** A tappable object picture (the why check): name over a small illustration. */
function ObjectOption({
  option,
  state,
  disabled,
  onSelect,
}: {
  option: IntroOption
  state: AnswerState
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={state === "selected"}
      className={cn(
        "relative flex flex-col items-center gap-3 rounded-2xl border-2 p-4 text-center outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "cursor-default",
        OBJ_SURFACE[state],
      )}
    >
      <span className="text-sm font-bold text-foreground">{option.label}</span>
      {option.visual === "messy" ? <MessyCards /> : <NeatCards />}
      {state === "correct" && <CornerBadge kind="correct" />}
      {state === "fail" && <CornerBadge kind="fail" />}
    </button>
  )
}

/* -------------------------------- check beat -------------------------------- */

const CHECK_ICON: Record<string, ComponentType<{ className?: string }>> = {
  wifi: Wifi,
  contacts: Users,
  photos: Image,
  search: Search,
}

function CheckPart({
  beat,
  state,
  dispatch,
}: {
  beat: CheckBeat
  state: IntroState
  dispatch: Dispatch<LessonAction>
}) {
  const reduce = !!useReducedMotion()
  const isReveal = state.variant === "reveal"
  const [armed, setArmed] = useState(!isReveal)

  // Prototype A: show the situation, hold the options back for a beat.
  useEffect(() => {
    if (!isReveal || reduce) {
      setArmed(true)
      return
    }
    setArmed(false)
    const timer = setTimeout(() => setArmed(true), REVEAL_DELAY_MS)
    return () => clearTimeout(timer)
  }, [beat.id, isReveal, reduce])

  const { feedback, selected, showWhy } = state
  const terminal = isTerminal(state)
  const Icon = CHECK_ICON[beat.icon]
  const isObjects = beat.options.some((o) => o.visual)

  const cardState = (id: string): AnswerState => {
    if (feedback === "correct") return id === beat.answer ? "correct" : "default"
    if (feedback === "nudge") return id === selected ? "nudge" : "default"
    if (feedback === "fail") {
      if (showWhy && id === beat.answer) return "correct"
      if (id === selected) return "fail"
      return "default"
    }
    return id === selected ? "selected" : "default"
  }

  const pop = reduce
    ? { initial: false as const }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

  return (
    <StageCenter>
      {/* Scenario only. The job names are taught on page 3, so the question never
          spells out its own answer (no give-away). The icon sets the scene. */}
      <div className="mt-8 flex flex-col items-center text-center">
        <QuotaLine state={state} />
        <span className="mt-4 flex size-16 items-center justify-center rounded-3xl bg-lilac-soft text-lilac-strong">
          {Icon ? <Icon className="size-8" /> : null}
        </span>
        <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground lg:text-xl">
          {beat.scenario}
        </p>
        <p className="mt-3 max-w-md text-pretty text-2xl font-bold leading-snug text-foreground lg:text-[1.75rem]">
          {beat.ask}
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 py-6">
        {armed && (
          <motion.div
            {...pop}
            transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.05 }}
            className={isObjects ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}
          >
            {beat.options.map((opt, i) =>
              isObjects ? (
                <ObjectOption
                  key={opt.id}
                  option={opt}
                  state={cardState(opt.id)}
                  disabled={terminal}
                  onSelect={() => dispatch({ type: "select", letter: opt.id })}
                />
              ) : (
                <AnswerCard
                  key={opt.id}
                  letter={String.fromCharCode(65 + i)}
                  label={opt.label}
                  state={cardState(opt.id)}
                  disabled={terminal}
                  answerMarker={opt.id === beat.answer}
                  onSelect={() => dispatch({ type: "select", letter: opt.id })}
                />
              ),
            )}
          </motion.div>
        )}
      </div>

      {armed && (
        <FeedbackFooter
          feedback={feedback}
          selected={selected}
          showWhy={showWhy}
          copy={beat}
          dispatch={dispatch}
          hideFailHint
        />
      )}
    </StageCenter>
  )
}

/* --------------------------------- done ----------------------------------- */

function DonePart() {
  return (
    <StageCenter maxWidthClass="max-w-prose">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="size-8" strokeWidth={3} />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-foreground lg:text-3xl">
          You have the big picture
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground lg:text-base">
          Data structures store, sort, and group information so the next task is
          easier. Up next: your first real shape, the stack and the queue.
        </p>
      </div>
      <p className="mb-2 text-center text-xs text-faint">
        In the app, finishing hands you to Lesson 1.
      </p>
    </StageCenter>
  )
}
