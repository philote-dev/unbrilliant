import { useEffect, useState } from "react"
import { Check, LogOut, Moon, Sun, User as UserIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useNavigation } from "@/lib/navigation"
import { useAuth } from "@/lib/auth"
import { useTheme } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const APP_VERSION = "1.0"

/**
 * The account + preferences home (formerly split across a Profile tab and a
 * Settings sub-screen). Identity sits up top as the one substantial card; the
 * username is editable here, and appearance + about follow as quiet grouped
 * sections. Progress stats deliberately live only on the Progress tab.
 */
export function Settings() {
  return (
    <div className="flex flex-1 flex-col px-5 pb-28 pt-6 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-0 lg:pb-0 lg:pt-0">
      <h1 className="text-[28px] font-bold text-foreground lg:text-4xl">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your account, and how Willow looks.
      </p>

      <AccountCard className="mt-6" />

      <Group title="Appearance" className="mt-6">
        <AppearanceRow />
      </Group>

      <Group title="About" className="mt-6">
        <InfoRow label="About Willow" value="Learn by doing" />
        <Divider />
        <InfoRow label="Version" value={APP_VERSION} />
      </Group>

      <p className="mt-8 text-center text-xs text-faint lg:text-left">
        Willow · algorithmic thinking, by doing
      </p>
    </div>
  )
}

function AccountCard({ className }: { className?: string }) {
  const { navigate } = useNavigation()
  const { user, signOut } = useAuth()
  const initial = (user?.displayName?.trim()?.[0] ?? "L").toUpperCase()

  return (
    <section
      className={cn(
        "rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-lilac-soft text-xl font-bold text-lilac-strong">
          {user ? initial : <UserIcon className="size-7" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold text-foreground">
            {user ? user.displayName || "Learner" : "Guest"}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {user ? (user.email ?? "Signed in") : "Playing without an account"}
          </p>
        </div>
      </div>

      {user ? (
        <>
          <DisplayNameField className="mt-5" />
          <Button
            variant="neutral"
            className="mt-4 w-full"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </>
      ) : (
        <Button
          variant="tactile"
          className="mt-5 w-full"
          onClick={() => navigate({ name: "signin" })}
        >
          Sign in to save your progress
        </Button>
      )}
    </section>
  )
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

/** Edit the display name (username) in place, persisting to the auth profile. */
function DisplayNameField({ className }: { className?: string }) {
  const { user, updateDisplayName } = useAuth()
  const [value, setValue] = useState(user?.displayName ?? "")
  const [status, setStatus] = useState<SaveStatus>("idle")

  // Reflect an external change (sign-in/out, another tab) without clobbering a
  // mid-edit value: only resync when the persisted name actually changes.
  useEffect(() => {
    setValue(user?.displayName ?? "")
    setStatus("idle")
  }, [user?.displayName])

  const trimmed = value.trim()
  const dirty = trimmed.length > 0 && trimmed !== (user?.displayName ?? "")

  async function save() {
    if (!dirty || status === "saving") return
    setStatus("saving")
    try {
      await updateDisplayName(trimmed)
      setStatus("saved")
    } catch {
      setStatus("error")
    }
  }

  return (
    <div className={className}>
      <label
        htmlFor="display-name"
        className="text-[11px] font-semibold uppercase tracking-wide text-faint"
      >
        Display name
      </label>
      <div className="mt-1.5 flex gap-2">
        <Input
          id="display-name"
          value={value}
          maxLength={40}
          autoComplete="nickname"
          placeholder="Your name"
          aria-label="Display name"
          onChange={(e) => {
            setValue(e.target.value)
            setStatus("idle")
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save()
          }}
        />
        <Button
          variant="soft"
          className="h-12 shrink-0"
          disabled={!dirty || status === "saving"}
          onClick={() => void save()}
        >
          {status === "saving" ? "Saving..." : "Save"}
        </Button>
      </div>
      {status === "saved" && (
        <p role="status" className="mt-1.5 flex items-center gap-1 text-xs text-success">
          <Check className="size-3.5" />
          Name updated.
        </p>
      )}
      {status === "error" && (
        <p role="status" className="mt-1.5 text-xs text-danger">
          Couldn&apos;t save. Try again.
        </p>
      )}
    </div>
  )
}

function Group({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
        {title}
      </h2>
      <div className="mt-2 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        {children}
      </div>
    </section>
  )
}

function Divider() {
  return <div className="mx-5 border-t border-border" />
}

function AppearanceRow() {
  const { theme, toggle } = useTheme()
  const isDark = theme === "dark"

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-3 px-5 py-4 transition-colors hover:bg-muted"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground">
        {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </span>
      <span className="flex-1 text-left text-[15px] font-medium text-foreground">
        Theme
      </span>
      <span className="text-sm text-muted-foreground">{isDark ? "Dark" : "Light"}</span>
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="flex-1 text-[15px] font-medium text-foreground">{label}</span>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  )
}
