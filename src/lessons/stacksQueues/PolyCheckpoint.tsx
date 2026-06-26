import { useEffect, useRef, useState } from "react"
import { Sparkles, Mic, Square, Volume2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  scoreExplanation as defaultScore,
  requestProbe as defaultProbe,
  type PropScore,
  type ScoreRequest,
  type ScoreResponse,
  type ProbeRequest,
  type ProbeResponse,
} from "@/lib/ai/polyClient"
import {
  speakText as defaultSpeakText,
  createRecorder as defaultCreateRecorder,
  type VoiceRecorder,
} from "@/lib/ai/voice"
import {
  saveExplanation as defaultSave,
  type ExplanationRecord,
} from "@/features/poly/explanationStore"
import { db } from "@/lib/firebase"

export interface PolyCheckpointProps {
  conceptId: string
  conceptName: string
  uid: string | null
  onDone: () => void
  maxExchanges?: number
  scoreExplanation?: (req: ScoreRequest) => Promise<ScoreResponse>
  requestProbe?: (req: ProbeRequest) => Promise<ProbeResponse>
  saveExplanation?: (uid: string, rec: ExplanationRecord) => Promise<void>
  voice?: boolean
  speakText?: (text: string) => Promise<void>
  createRecorder?: () => VoiceRecorder
}

type Phase = "asking" | "thinking" | "done"

function dotClass(verdict: PropScore["verdict"]): string {
  if (verdict === "covered") return "bg-emerald-500"
  if (verdict === "partial") return "bg-amber-500"
  return "bg-muted-foreground/30"
}

export function PolyCheckpoint({
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
  createRecorder = defaultCreateRecorder,
}: PolyCheckpointProps) {
  const [phase, setPhase] = useState<Phase>("asking")
  const [question, setQuestion] = useState(
    `In your own words, explain ${conceptName}.`,
  )
  const [answer, setAnswer] = useState("")
  const [scores, setScores] = useState<PropScore[]>([])
  const [exchanges, setExchanges] = useState(0)
  const [succeeded, setSucceeded] = useState(false)
  const [recording, setRecording] = useState(false)
  const [voiceError, setVoiceError] = useState(false)
  const recorderRef = useRef<VoiceRecorder | null>(null)

  useEffect(() => {
    if (!voice || phase !== "asking") return
    void speakText(question)
    // Re-speak only when the question text changes (new probe / first ask).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, voice])

  async function startRecording() {
    setVoiceError(false)
    const rec = createRecorder()
    recorderRef.current = rec
    try {
      await rec.start()
      setRecording(true)
    } catch {
      recorderRef.current = null
      setVoiceError(true)
    }
  }

  async function stopRecording() {
    const rec = recorderRef.current
    recorderRef.current = null
    setRecording(false)
    if (!rec) return
    const text = await rec.stop()
    if (text) setAnswer(text)
    else setVoiceError(true)
  }

  async function submit() {
    const text = answer.trim()
    if (!text) return
    setPhase("thinking")
    if (uid) void saveExplanation(uid, { conceptId, explanation: text }).catch(() => {})
    try {
      const res = await scoreExplanation({ conceptId, explanation: text })
      setScores(res.scores)
      const n = exchanges + 1
      setExchanges(n)
      const allCovered =
        res.scores.length > 0 && res.scores.every((s) => s.verdict === "covered")
      if (allCovered || n >= maxExchanges || !res.weakest) {
        setSucceeded(allCovered)
        setPhase("done")
        return
      }
      const probe = await requestProbe({
        conceptId,
        propositionId: res.weakest,
        explanation: text,
      })
      if (!probe.question) {
        setPhase("done")
        return
      }
      setQuestion(probe.question)
      setAnswer("")
      setPhase("asking")
    } catch {
      setPhase("done")
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 flex flex-col items-center text-center">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-lilac-soft text-lilac-strong">
            <Sparkles className="size-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">Poly</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Quick check
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

      <div className="mt-auto min-h-[132px]">
        {phase === "done" ? (
          <div className="animate-fade-in">
            <p className="mb-4 text-center text-sm text-muted-foreground lg:text-base">
              {succeeded
                ? `Beautiful, you've got ${conceptName} down. Let's keep going.`
                : "Nice effort, you're on the right track. Let's keep going."}
            </p>
            <Button variant="tactile" size="lg" className="w-full" onClick={onDone}>
              Continue
            </Button>
          </div>
        ) : (
          <>
            <textarea
              className="mb-3 min-h-24 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground"
              aria-label="Your explanation"
              placeholder="Type your explanation..."
              maxLength={5000}
              value={answer}
              disabled={phase === "thinking"}
              onChange={(e) => setAnswer(e.target.value)}
            />
            {phase === "thinking" && (
              <p className="mb-3 text-center text-sm text-muted-foreground">
                Poly is thinking...
              </p>
            )}
            {voice && (
              <div className="mb-3 flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="default"
                  disabled={phase === "thinking"}
                  onClick={recording ? stopRecording : startRecording}
                >
                  {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
                  {recording ? "Stop" : "Speak your answer"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  aria-label="Replay question"
                  disabled={phase === "thinking"}
                  onClick={() => void speakText(question)}
                >
                  <Volume2 className="size-4" />
                </Button>
              </div>
            )}
            {voice && voiceError && (
              <p className="mb-3 text-center text-xs text-muted-foreground">
                Voice unavailable, type instead.
              </p>
            )}
            <Button
              variant="tactile"
              size="lg"
              className="w-full"
              disabled={phase === "thinking" || answer.trim() === ""}
              onClick={submit}
            >
              Submit
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
