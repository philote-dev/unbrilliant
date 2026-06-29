import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react"
import { Sparkles, Mic, Keyboard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  scoreExplanation as defaultScore,
  requestProbe as defaultProbe,
  realtimeToken as defaultRealtimeToken,
  type PropScore,
  type ScoreRequest,
  type ScoreResponse,
  type ProbeRequest,
  type ProbeResponse,
} from "@/lib/ai/polyClient"
import { speakText as defaultSpeakText } from "@/lib/ai/voice"
import {
  createRealtimeTranscriber,
  type RealtimeTranscriber,
} from "@/lib/ai/realtimeTranscriber"
import {
  saveExplanation as defaultSave,
  type ExplanationRecord,
} from "@/features/poly/explanationStore"
import { db } from "@/lib/firebase"
import { mergeScores, isTeachbackPass, pickWeakest } from "@/features/poly/teachbackScore"

type TranscriptUpdate = { finalText: string; interimText: string }

export interface TeachbackProps {
  conceptId: string
  conceptName: string
  uid: string | null
  onDone: () => void
  maxExchanges?: number
  scoreExplanation?: (req: ScoreRequest) => Promise<ScoreResponse>
  requestProbe?: (req: ProbeRequest) => Promise<ProbeResponse>
  saveExplanation?: (uid: string, rec: ExplanationRecord) => Promise<void>
  voice?: boolean
  speakText?: (text: string, signal?: AbortSignal) => Promise<void>
  createTranscriber?: (opts: {
    onUpdate: (t: TranscriptUpdate) => void
    onError?: (e: unknown) => void
  }) => RealtimeTranscriber
}

type Phase = "answering" | "scoring" | "done"
type Mode = "voice" | "keyboard"
type VoicePhase = "speaking" | "listening"

function dotClass(verdict: PropScore["verdict"]): string {
  if (verdict === "covered") return "bg-emerald-500"
  if (verdict === "partial") return "bg-amber-500"
  return "bg-muted-foreground/30"
}

/** Poly's avatar: a soft lilac orb that breathes while listening and glows while speaking. */
function PolyOrb({ phase, reduce }: { phase: VoicePhase; reduce: boolean | null }) {
  const listening = phase === "listening"
  const Icon = listening ? Mic : Sparkles
  return (
    <div className="relative flex size-28 items-center justify-center" aria-hidden>
      {listening && !reduce && (
        <>
          <motion.span
            className="absolute size-24 rounded-full bg-lilac-soft"
            animate={{ scale: [1, 1.4, 1], opacity: [0.45, 0, 0.45] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="absolute size-24 rounded-full bg-lilac-soft"
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          />
        </>
      )}
      <motion.span
        className="relative flex size-16 items-center justify-center rounded-full bg-lilac-soft text-lilac-strong"
        animate={reduce ? { scale: 1 } : { scale: listening ? [1, 1.06, 1] : [1, 1.03, 1] }}
        transition={{ duration: listening ? 2.4 : 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="size-6" />
      </motion.span>
    </div>
  )
}

export function Teachback({
  conceptId,
  conceptName,
  uid,
  onDone,
  maxExchanges = 3,
  scoreExplanation = defaultScore,
  requestProbe = defaultProbe,
  saveExplanation = (u, rec) => defaultSave(db, u, rec),
  voice = false,
  speakText = defaultSpeakText,
  createTranscriber = (opts) =>
    createRealtimeTranscriber({ ...opts, getToken: defaultRealtimeToken }),
}: TeachbackProps) {
  const reduce = useReducedMotion()

  const [phase, setPhase] = useState<Phase>("answering")
  const [mode, setMode] = useState<Mode>(voice ? "voice" : "keyboard")
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("speaking")
  const [question, setQuestion] = useState(
    `Teach it back: explain ${conceptName} in your own words.`,
  )
  const [finalText, setFinalText] = useState("")
  const [interimText, setInterimText] = useState("")
  const [typed, setTyped] = useState("")
  const [scores, setScores] = useState<PropScore[]>([])
  const [exchanges, setExchanges] = useState(0)
  const [succeeded, setSucceeded] = useState(false)
  const [voiceError, setVoiceError] = useState(false)

  const transcriberRef = useRef<RealtimeTranscriber | null>(null)
  const submittingRef = useRef(false)
  // The merged best-verdict-per-proposition across all exchanges this session, so
  // a later narrow answer never drops earlier coverage (the "too strict" bug).
  const scoresRef = useRef<PropScore[]>([])

  const voiceText = [finalText, interimText].filter(Boolean).join(" ").trim()

  function stopListening() {
    transcriberRef.current?.stop()
    transcriberRef.current = null
  }

  // Release the realtime connection / mic on unmount.
  useEffect(() => () => stopListening(), [])

  function startListening() {
    const transcriber = createTranscriber({
      onUpdate: (u) => {
        setFinalText(u.finalText)
        setInterimText(u.interimText)
      },
      onError: () => setVoiceError(true),
    })
    transcriberRef.current = transcriber
    setVoicePhase("listening")
    transcriber.start().catch(() => {
      transcriberRef.current = null
      setVoiceError(true)
      setMode("keyboard")
    })
  }

  // One voice turn: Poly speaks the question, then the mic opens. Re-runs when
  // the question, mode, or phase changes; the cleanup aborts an in-flight turn
  // (stopping any TTS that is still fetching or playing) and releases the mic. The
  // abort is what keeps Poly from talking on the next screen if this checkpoint
  // unmounts mid-sentence (e.g. the lesson completes), and keeps StrictMode's
  // double-invoke safe (the first pass is cancelled, the second starts clean).
  useEffect(() => {
    if (mode !== "voice" || phase !== "answering") return
    const turn = new AbortController()
    setVoiceError(false)
    setVoicePhase("speaking")
    void (async () => {
      try {
        await speakText(question, turn.signal)
      } catch {
        // ignore: autoplay/network; open the mic regardless
      }
      if (!turn.signal.aborted) startListening()
    })()
    return () => {
      turn.abort()
      stopListening()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, mode, phase])

  function switchToKeyboard() {
    stopListening()
    setMode("keyboard")
  }

  function switchToVoice() {
    setVoiceError(false)
    setFinalText("")
    setInterimText("")
    setMode("voice")
  }

  async function submit(text: string) {
    const trimmed = text.trim()
    // Only ever submit from an active answering turn, and never re-enter while a
    // score is already in flight. This bounds the score/probe cycle to genuine
    // user submissions.
    if (!trimmed || phase !== "answering" || submittingRef.current) return
    submittingRef.current = true
    stopListening()
    setPhase("scoring")
    if (uid) void saveExplanation(uid, { conceptId, explanation: trimmed }).catch(() => {})
    try {
      const res = await scoreExplanation({ conceptId, explanation: trimmed })
      const merged = mergeScores(scoresRef.current, res.scores)
      scoresRef.current = merged
      setScores(merged)
      const n = exchanges + 1
      setExchanges(n)
      const pass = isTeachbackPass(merged)
      const weakest = pickWeakest(merged)
      if (pass || n >= maxExchanges || !weakest) {
        setSucceeded(pass)
        setPhase("done")
        return
      }
      const probe = await requestProbe({
        conceptId,
        propositionId: weakest,
        explanation: trimmed,
      })
      if (!probe.question) {
        setPhase("done")
        return
      }
      setFinalText("")
      setInterimText("")
      setTyped("")
      setQuestion(probe.question)
      setPhase("answering")
    } catch {
      setPhase("done")
    } finally {
      submittingRef.current = false
    }
  }

  function onGrabberDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y < -24) switchToKeyboard()
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="mt-7 flex flex-col items-center text-center">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-lilac-soft text-lilac-strong">
            <Sparkles className="size-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">Poly</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Teach-back
          </span>
        </div>
        <h2 className="mx-auto mt-3 max-w-sm text-xl font-bold text-foreground lg:text-2xl">
          {question}
        </h2>
      </div>

      {scores.length > 0 && (
        <div className="mt-4 flex justify-center gap-2" aria-label="coverage">
          {scores.map((s) => (
            <span
              key={s.id}
              role="img"
              aria-label={s.verdict}
              className={cn("size-3 rounded-full", dotClass(s.verdict))}
            />
          ))}
        </div>
      )}

      {phase === "done" ? (
        <div className="mt-auto animate-fade-in pb-1">
          <p className="mb-4 text-center text-sm text-muted-foreground lg:text-base">
            {succeeded
              ? `Beautiful, you've got ${conceptName} down. Let's keep going.`
              : "Nice effort, you're on the right track. Let's keep going."}
          </p>
          <Button variant="tactile" size="lg" className="w-full" onClick={onDone}>
            Continue
          </Button>
        </div>
      ) : phase === "scoring" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          {voice && <PolyOrb phase="speaking" reduce={reduce} />}
          <p className="text-center text-sm text-muted-foreground">Poly is thinking...</p>
        </div>
      ) : voice ? (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2">
            <PolyOrb phase={voicePhase} reduce={reduce} />
            <div
              aria-live="polite"
              className="min-h-[3.5rem] max-w-md text-center text-lg leading-snug"
            >
              {voiceText ? (
                <p>
                  <span className="text-foreground">{finalText}</span>{" "}
                  <span className="text-muted-foreground">{interimText}</span>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {voicePhase === "speaking" ? "Poly is speaking..." : "Listening..."}
                </p>
              )}
            </div>
            {voiceError && (
              <p role="status" className="text-xs text-muted-foreground">
                Voice unavailable, type instead.
              </p>
            )}
          </div>

          <div className="mt-auto flex flex-col items-center gap-3 pb-1">
            <Button
              variant="tactile"
              size="lg"
              className="w-full"
              disabled={!voiceText}
              onClick={() => submit(voiceText)}
            >
              Done
            </Button>
            <motion.button
              type="button"
              onClick={switchToKeyboard}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.4}
              dragSnapToOrigin
              onDragEnd={onGrabberDragEnd}
              className="flex cursor-grab touch-none flex-col items-center gap-1 py-1 text-muted-foreground active:cursor-grabbing"
              aria-label="Type instead"
            >
              <span className="h-1 w-9 rounded-full bg-muted-foreground/30" />
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Keyboard className="size-3.5" /> Type instead
              </span>
            </motion.button>
          </div>

          <AnimatePresence>
            {mode === "keyboard" && (
              <motion.div
                key="keyboard-sheet"
                className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl"
                initial={reduce ? false : { y: "100%" }}
                animate={{ y: 0 }}
                exit={reduce ? { opacity: 0 } : { y: "100%" }}
                transition={{ type: "spring", stiffness: 360, damping: 34 }}
              >
                <button
                  type="button"
                  onClick={switchToVoice}
                  aria-label="Back to voice"
                  className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-muted-foreground/30"
                />
                <textarea
                  className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground"
                  aria-label="Your explanation"
                  placeholder="Type your explanation..."
                  maxLength={5000}
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                />
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="ghost" size="default" onClick={switchToVoice}>
                    <Mic className="size-4" /> Use voice
                  </Button>
                  <Button
                    variant="tactile"
                    size="lg"
                    className="flex-1"
                    disabled={typed.trim() === ""}
                    onClick={() => submit(typed)}
                  >
                    Submit
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="mt-auto min-h-[132px]">
          <textarea
            className="mb-3 min-h-24 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground"
            aria-label="Your explanation"
            placeholder="Type your explanation..."
            maxLength={5000}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <Button
            variant="tactile"
            size="lg"
            className="w-full"
            disabled={typed.trim() === ""}
            onClick={() => submit(typed)}
          >
            Submit
          </Button>
        </div>
      )}
    </div>
  )
}
