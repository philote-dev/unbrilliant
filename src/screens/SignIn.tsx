import { useState, type FormEvent, type ReactNode } from "react"
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react"

import { useNavigation } from "@/lib/navigation"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WillowLogo } from "@/components/willow/Logo"

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.88-3c-1.08.72-2.45 1.16-4.06 1.16-3.12 0-5.77-2.11-6.71-4.94H1.29v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.31a7.2 7.2 0 0 1 0-4.62V6.6H1.29a12 12 0 0 0 0 10.8z"
      />
      <path
        fill="#EA4335"
        d="M12 4.74c1.76 0 3.34.61 4.59 1.8l3.43-3.43A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.6l4 3.09C6.23 6.85 8.88 4.74 12 4.74z"
      />
    </svg>
  )
}

function errorCode(e: unknown): string {
  return typeof e === "object" && e !== null && "code" in e
    ? String((e as { code: unknown }).code)
    : ""
}

function authMessage(e: unknown): string {
  switch (errorCode(e)) {
    case "auth/invalid-email":
      return "That email doesn't look right."
    case "auth/weak-password":
      return "Password should be at least 6 characters."
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Incorrect email or password."
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled."
    default:
      return "Something went wrong. Please try again."
  }
}

export function SignIn({
  reason,
  intent = "save",
}: {
  reason?: string
  intent?: "save" | "unlock"
}) {
  const { back, replace } = useNavigation()
  const { signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth()
  const [showPw, setShowPw] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onAuthed = () => {
    if (intent === "unlock")
      replace({ name: "course", courseId: "data-structures" })
    else back()
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onAuthed()
    } catch (e) {
      setError(authMessage(e))
      setBusy(false)
    }
  }

  const onGoogle = () => void run(() => signInWithGoogle())

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setError("Please enter a display name.")
      return
    }
    void run(async () => {
      try {
        await signUpWithEmail(email.trim(), password, displayName.trim())
      } catch (err) {
        // Returning email learner → fall back to sign-in with the same form.
        if (errorCode(err) === "auth/email-already-in-use")
          await signInWithEmail(email.trim(), password)
        else throw err
      }
    })
  }

  return (
    <div className="flex min-h-svh flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full animate-slide-up">
        <div className="flex justify-center">
          <WillowLogo size="lg" className="[&>span]:text-foreground" />
        </div>

        <h1 className="mt-6 text-center text-[28px] font-bold text-foreground">
          Save your progress
        </h1>
        <p className="mt-1.5 text-center text-[15px] text-muted-foreground">
          {reason ?? "Sign in to keep your streak and unlock more lessons."}
        </p>

        <div className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-card">
          <Button
            variant="neutral"
            className="w-full"
            onClick={onGoogle}
            disabled={busy}
          >
            <GoogleG className="size-5" />
            Continue with Google
          </Button>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3" onSubmit={onSubmit}>
            <Field icon={Mail}>
              <Input
                type="email"
                placeholder="Email address"
                className="pl-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>
            <Field icon={Lock}>
              <Input
                type={showPw ? "text" : "password"}
                placeholder="Password"
                className="px-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </Field>
            <Field icon={User}>
              <Input
                placeholder="Display name"
                className="pl-11"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoComplete="name"
              />
            </Field>

            {error && (
              <p className="text-center text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="tactile"
              className="w-full"
              disabled={busy}
            >
              {busy ? "Please wait…" : "Create account"}
            </Button>
          </form>
        </div>

        <button
          type="button"
          onClick={back}
          className="mt-5 w-full text-center text-sm font-medium text-lilac-strong hover:underline"
        >
          Keep playing without an account
        </button>
      </div>
    </div>
  )
}

function Field({
  icon: Icon,
  children,
}: {
  icon: typeof Mail
  children: ReactNode
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      {children}
    </div>
  )
}
