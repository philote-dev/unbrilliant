import { ChevronRight, Settings as SettingsIcon, User } from "lucide-react"

import { useNavigation } from "@/lib/navigation"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"

export function Profile() {
  const { navigate } = useNavigation()
  const { user, signOut } = useAuth()

  return (
    <div className="flex flex-1 flex-col px-5 pb-28 pt-6">
      <h1 className="text-[28px] font-bold text-foreground">Profile</h1>

      {/* account */}
      <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-lilac-soft text-lilac-strong">
            <User className="size-7" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              {user ? user.displayName || "Learner" : "Guest"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {user
                ? (user.email ?? "Signed in")
                : "Playing without an account"}
            </p>
          </div>
        </div>
        {user ? (
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        ) : (
          <Button
            variant="tactile"
            className="mt-4 w-full"
            onClick={() => navigate({ name: "signin" })}
          >
            Sign in to save your progress
          </Button>
        )}
      </div>

      {/* settings entry */}
      <button
        type="button"
        onClick={() => navigate({ name: "settings" })}
        className="mt-4 flex items-center gap-3 rounded-3xl border border-border bg-card px-5 py-4 shadow-card transition-colors hover:bg-muted"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground">
          <SettingsIcon className="size-5" />
        </span>
        <span className="flex-1 text-left text-[15px] font-medium text-foreground">
          Settings
        </span>
        <ChevronRight className="size-4 text-faint" />
      </button>

      <p className="mt-6 text-center text-xs text-faint">
        Willow · learn-by-doing data structures
      </p>
    </div>
  )
}
