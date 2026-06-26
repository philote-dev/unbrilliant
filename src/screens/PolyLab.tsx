import { useMemo, useState, type ReactNode } from "react"
import {
  ChevronLeft,
  FlaskConical,
  HeartPulse,
  Lightbulb,
  MessageSquareText,
  RefreshCw,
} from "lucide-react"

import { useNavigation } from "@/lib/navigation"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PolyCheckpoint } from "@/lessons/stacksQueues/PolyCheckpoint"
import {
  polyHealthCheck,
  requestHint,
  type HealthResult,
  type ScoreResponse,
  type ProbeResponse,
} from "@/lib/ai/polyClient"

type Mode = "mock" | "live"
type Discipline = "stack" | "queue"

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// --- Mock responses so the UI is fully explorable with no key or emulator. ---

async function mockHealth(): Promise<HealthResult> {
  await wait(450)
  return { ok: true, model: "gpt-4o-mini (mock)", reply: "pong", uid: null }
}

interface HintScenario {
  id: string
  label: string
  discipline: Discipline
  goalExit: string[]
  pushed: string[]
  mockHints: string[]
  staticFallback: string
}

// Each scenario is a wrong build a learner might actually submit, with the
// canned hints Poly would give (first pass, then a different angle on retry).
const HINT_SCENARIOS: HintScenario[] = [
  {
    id: "stack-like-queue",
    label: "Stack built like a line",
    discipline: "stack",
    goalExit: ["A", "B", "C"],
    pushed: ["A", "B", "C"],
    mockHints: [
      "You stacked them so the first card you placed is buried at the bottom. Which card is sitting on top, ready to come off first?",
      "Picture lifting cards off the top one at a time. Given how you piled them, which letter leaves first, and is that the one your goal needs first?",
    ],
    staticFallback: "Remember: you can only take the card off the top.",
  },
  {
    id: "queue-reversed",
    label: "Queue filled back to front",
    discipline: "queue",
    goalExit: ["A", "B", "C"],
    pushed: ["C", "B", "A"],
    mockHints: [
      "You lined them up so the newest arrival sits at the front. Who gets served first, the person who just showed up or the one who has waited longest?",
      "Think of a checkout line: people leave in the order they joined. Which letter joined your line first?",
    ],
    staticFallback: "Items leave a queue from the front, in the order they arrived.",
  },
  {
    id: "stack-one-off",
    label: "Stack, one card out of place",
    discipline: "stack",
    goalExit: ["A", "B", "C"],
    pushed: ["B", "A", "C"],
    mockHints: [
      "So close. Look at the very first card you placed at the bottom. For your goal order, which letter must come out first, and so where does it need to sit?",
    ],
    staticFallback: "The card you want out first must be the last one you put on.",
  },
]

// A stateful mock for the checkpoint: the first explanation has a gap (so a probe
// fires), the second covers everything (so it affirms and continues).
function makeMockCheckpoint() {
  let calls = 0
  return {
    score: async (): Promise<ScoreResponse> => {
      await wait(550)
      calls += 1
      if (calls === 1) {
        return {
          scores: [
            { id: "P1", verdict: "missing" },
            { id: "P2", verdict: "covered" },
            { id: "P3", verdict: "partial" },
          ],
          weakest: "P1",
        }
      }
      return {
        scores: [
          { id: "P1", verdict: "covered" },
          { id: "P2", verdict: "covered" },
          { id: "P3", verdict: "covered" },
        ],
        weakest: null,
      }
    },
    probe: async (): Promise<ProbeResponse> => {
      await wait(450)
      return {
        question:
          "You're almost there! Let's connect that last piece: when you take a card off, which one are you actually able to reach?",
      }
    },
  }
}

export function PolyLab() {
  const { back } = useNavigation()
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>("mock")

  return (
    <div className="flex flex-1 flex-col px-5 pb-28 pt-6 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-0 lg:pb-12">
      <div className="relative flex items-center justify-center">
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="absolute left-0 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <FlaskConical className="size-5 text-lilac-strong" />
          <h1 className="text-lg font-semibold text-foreground">Poly Lab</h1>
        </div>
      </div>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Try the Phase 2 AI features in isolation: the health check, action-grounded hints,
        and self-explanation checkpoints.
      </p>

      <ModeToggle mode={mode} setMode={setMode} />
      <RunBanner mode={mode} />

      <div className="mt-5 flex flex-col gap-4">
        <HealthPanel mode={mode} />
        <HintPanel mode={mode} />
        <CheckpointPanel mode={mode} uid={user?.uid ?? null} />
      </div>
    </div>
  )
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="mx-auto mt-5 inline-flex rounded-full border border-border bg-muted p-1">
      {(["mock", "live"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            mode === m
              ? "bg-card text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m === "mock" ? "Mock" : "Live"}
        </button>
      ))}
    </div>
  )
}

function RunBanner({ mode }: { mode: Mode }) {
  if (mode === "mock") {
    return (
      <p className="mt-3 text-center text-xs text-faint">
        Mock mode: canned responses, no key or emulator needed. Switch to Live to call the
        real model.
      </p>
    )
  }
  return (
    <div className="mt-3 rounded-2xl border border-lilac-strong/40 bg-lilac-soft px-4 py-3 text-xs text-lilac-foreground">
      <p className="font-semibold">Live mode needs the functions emulator and your OpenAI key.</p>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
        {`printf 'OPENAI_API_KEY="sk-..."\\n' > functions/.secret.local
npm --prefix functions run build
npx -y firebase-tools@latest emulators:start --only functions --project demo-willow
# then, in another terminal:
npm run dev`}
      </pre>
    </div>
  )
}

function DemoCard({
  icon,
  title,
  desc,
  children,
}: {
  icon: ReactNode
  title: string
  desc: string
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-lilac-strong">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ErrorRow({ error }: { error: string }) {
  return (
    <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
      {error}
    </p>
  )
}

function HealthPanel({ mode }: { mode: Mode }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HealthResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      setResult(mode === "mock" ? await mockHealth() : await polyHealthCheck())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <DemoCard
      icon={<HeartPulse className="size-5" />}
      title="1 · Health check"
      desc="Proves the secure round-trip: the browser calls the Cloud Function, which calls OpenAI with the server-side key and returns a tiny reply."
    >
      <Button variant="tactile" size="default" onClick={run} disabled={loading}>
        {loading ? "Pinging..." : "Run health check"}
      </Button>
      {result && (
        <div className="mt-3 rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
              result.ok ? "bg-emerald-500/15 text-emerald-600" : "bg-danger/15 text-danger",
            )}
          >
            {result.ok ? "ok" : "failed"}
          </span>
          <span className="ml-2 text-muted-foreground">model:</span>{" "}
          <span className="font-mono text-foreground">{result.model}</span>
          <div className="mt-1 text-muted-foreground">
            reply: <span className="font-mono text-foreground">{result.reply || "(empty)"}</span>
          </div>
        </div>
      )}
      {error && <ErrorRow error={error} />}
    </DemoCard>
  )
}

function CardChips({ items, label }: { items: string[]; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {items.map((c, i) => (
          <span key={`${c}-${i}`} className="flex items-center gap-1.5">
            <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-xs font-bold text-foreground">
              {c}
            </span>
            {i < items.length - 1 && <span className="text-faint">&rarr;</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

function HintPanel({ mode }: { mode: Mode }) {
  const [idx, setIdx] = useState(0)
  const [hints, setHints] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capped, setCapped] = useState(false)

  const scenario = HINT_SCENARIOS[idx]
  const maxHints = 2

  const select = (next: number) => {
    setIdx(next)
    setHints([])
    setError(null)
    setCapped(false)
    setLoading(false)
  }

  const getHint = async () => {
    setLoading(true)
    setError(null)
    try {
      let hint: string | null
      if (mode === "mock") {
        await wait(650)
        hint = scenario.mockHints[hints.length] ?? null
      } else {
        const res = await requestHint({
          stageId: "stacks-and-queues",
          skill: scenario.discipline === "stack" ? "stackConstruct" : "queueConstruct",
          discipline: scenario.discipline,
          learnerOrder: scenario.pushed,
          priorHint: hints[hints.length - 1],
        })
        hint = res.hint
      }
      const next = hint ? [...hints, hint] : hints
      setHints(next)
      if (!hint || next.length >= maxHints) setCapped(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const canAsk = !loading && !capped && hints.length < maxHints

  return (
    <DemoCard
      icon={<Lightbulb className="size-5" />}
      title="2 · Action-grounded hint"
      desc="On a wrong build, Poly nudges toward the violated idea without naming it or stating the order. The server verifier rejects any giveaway, and a second wrong attempt gets a different angle."
    >
      <div className="flex flex-wrap gap-1.5">
        {HINT_SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => select(i)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              i === idx
                ? "border-lilac-strong/55 bg-lilac-soft text-lilac-strong"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2 rounded-2xl border border-border bg-muted/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          {scenario.discipline} construct
        </p>
        <CardChips label="Goal: leaves as" items={scenario.goalExit} />
        <CardChips label="Learner built" items={scenario.pushed} />
      </div>

      <div className="mt-4 space-y-2">
        {hints.map((h, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <span className="mr-2 text-xs font-semibold text-lilac-strong">
              {i === 0 ? "Poly" : "Another angle"}
            </span>
            {h}
          </div>
        ))}
        {loading && <p className="text-sm text-muted-foreground">Poly is thinking...</p>}
        {capped && (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Cap reached (2 AI hints). Poly hands back the lesson&apos;s static hint:{" "}
            <span className="text-foreground">{scenario.staticFallback}</span>
          </p>
        )}
        {error && <ErrorRow error={error} />}
      </div>

      {canAsk && (
        <Button variant="tactile" size="default" className="mt-3" onClick={getHint}>
          {hints.length === 0 ? "Get a hint" : "Try a different angle"}
        </Button>
      )}
    </DemoCard>
  )
}

function CheckpointPanel({ mode, uid }: { mode: Mode; uid: string | null }) {
  const [concept, setConcept] = useState<Discipline>("stack")
  const [runId, setRunId] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [voice, setVoice] = useState(false)

  const conceptId = concept === "stack" ? "stacks" : "queues"
  const conceptName = concept === "stack" ? "stacks" : "queues"

  // Recreate the mock (resetting its internal call counter) whenever the demo
  // session changes, so each replay, concept switch, or mode switch starts the
  // loop fresh. The factory reads no reactive values, so deps are reset keys.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mock = useMemo(() => makeMockCheckpoint(), [runId, mode, conceptId])
  const injected =
    mode === "mock"
      ? {
          scoreExplanation: mock.score,
          requestProbe: mock.probe,
          saveExplanation: async () => {},
        }
      : {}

  // In mock mode, inject fake voice so the toggle is demoable with no key: the
  // speaker resolves instantly and the recorder returns a canned transcript on
  // stop. In live mode, omit these so the checkpoint uses the real TTS/STT.
  const mockVoice =
    mode === "mock"
      ? {
          speakText: async () => {},
          createRecorder: () => ({
            start: async () => {},
            stop: async () =>
              concept === "stack" ? "last in first out, only the top" : "first in first out",
            cancel: () => {},
          }),
        }
      : {}

  const replay = () => {
    setCompleted(false)
    setRunId((n) => n + 1)
  }

  return (
    <DemoCard
      icon={<MessageSquareText className="size-5" />}
      title="3 · Self-explanation checkpoint"
      desc="At a concept boundary, Poly asks you to explain it, scores each idea (the dots), probes the weakest gap, then affirms. Non-gating."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pills
          options={[
            { id: "stack", label: "Stacks" },
            { id: "queue", label: "Queues" },
          ]}
          value={concept}
          onChange={(v) => {
            setConcept(v as Discipline)
            replay()
          }}
        />
        <Button variant="secondary" size="default" onClick={replay}>
          <RefreshCw className="size-4" />
          Replay
        </Button>
        <Button
          variant={voice ? "tactile" : "secondary"}
          size="default"
          onClick={() => setVoice((v) => !v)}
        >
          {voice ? "Voice on" : "Voice off"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-faint">
        Mock tip: the first answer leaves a gap (so a probe fires); a second answer covers
        everything.
      </p>
      <div className="mt-4 flex min-h-[380px] flex-col rounded-2xl border border-dashed border-border bg-background/40 p-4">
        {completed ? (
          <div className="m-auto text-center">
            <p className="text-sm font-medium text-foreground">Checkpoint complete.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              In a lesson this returns the learner to the next beat.
            </p>
          </div>
        ) : (
          <PolyCheckpoint
            key={`${conceptId}-${mode}-${runId}-${voice ? "v" : "t"}`}
            conceptId={conceptId}
            conceptName={conceptName}
            uid={uid}
            voice={voice}
            onDone={() => setCompleted(true)}
            {...injected}
            {...mockVoice}
          />
        )}
      </div>
    </DemoCard>
  )
}

function Pills({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            value === o.id
              ? "bg-card text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
