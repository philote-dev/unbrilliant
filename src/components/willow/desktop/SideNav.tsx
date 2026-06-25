import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { useNavigation } from "@/lib/navigation"
import { NAV_ITEMS } from "@/lib/navItems"
import { useAuth } from "@/lib/auth"
import { WillowLogo } from "@/components/willow/Logo"
import { Flame, comboToTier } from "@/components/willow/Flame"
import { ThemeToggle } from "@/components/willow/ThemeToggle"
import { OPEN_COMMAND_EVENT } from "@/components/willow/CommandPalette"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { courseIcon } from "@/lessons/icons"
import {
  COURSES,
  courseLessons,
  currentLessonId,
  type Course,
} from "@/lessons/catalog"

/**
 * The persistent desktop left rail. Logo, the four primary destinations, a
 * quick-jump list of the learner's active courses (resume straight into the
 * current lesson), and a pinned footer with the streak, account, and theme.
 * Shown only at `lg`+ via the DesktopShell; the mobile BottomNav is unchanged.
 */
export function SideNav() {
  const { navigate, tab: active } = useNavigation()
  const { user } = useAuth()
  const { progressByLesson, courseProgress, currentCourseId, streak } =
    useCourseProgress()

  const activeCourses = COURSES.filter(
    (c) =>
      c.state === "available" &&
      courseLessons(c.id).length > 0 &&
      (currentCourseId === c.id || courseProgress(c.id) > 0),
  )

  return (
    <aside className="sticky top-0 flex h-svh w-[var(--willow-sidebar-w)] shrink-0 flex-col border-r border-border bg-card px-4 py-6">
      <button
        type="button"
        onClick={() => navigate({ name: "home" })}
        className="flex items-center rounded-2xl px-2 py-1 text-left transition-colors hover:bg-muted"
        aria-label="Willow home"
      >
        <WillowLogo size="md" />
      </button>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_EVENT))}
        className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <nav className="mt-4 flex flex-col gap-1">
        {NAV_ITEMS.map(({ tab, label, Icon, target }) => {
          const isActive = tab === active
          return (
            <button
              key={tab}
              type="button"
              onClick={() => navigate(target)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-lilac-soft text-lilac-strong"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon
                className="size-5 shrink-0"
                strokeWidth={isActive ? 2.4 : 2}
                fill={isActive ? "var(--lilac)" : "none"}
              />
              {label}
            </button>
          )
        })}
      </nav>

      {activeCourses.length > 0 && (
        <div className="mt-7">
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-faint">
            Active courses
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {activeCourses.map((course) => (
              <ActiveCourseRow
                key={course.id}
                course={course}
                pct={courseProgress(course.id)}
                onResume={() =>
                  navigate({
                    name: "lesson",
                    lessonId: currentLessonId(progressByLesson),
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <div className="flex items-center gap-2 px-3 text-sm text-muted-foreground">
          <Flame tier={comboToTier(streak.current)} size={22} />
          <span className="truncate">
            {streak.longest > 0
              ? `${streak.longest} best streak`
              : "Build a streak"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              navigate(user ? { name: "profile" } : { name: "signin" })
            }
            className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-muted"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lilac-soft text-xs font-bold text-lilac-strong">
              {(user?.displayName?.trim()?.[0] ?? (user ? "L" : "G")).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {user ? user.displayName || "Learner" : "Guest"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {user ? user.email || "Signed in" : "Sign in to save"}
              </span>
            </span>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}

function ActiveCourseRow({
  course,
  pct,
  onResume,
}: {
  course: Course
  pct: number
  onResume: () => void
}) {
  const Icon = courseIcon(course.icon)
  return (
    <button
      type="button"
      onClick={onResume}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-lilac-soft text-lilac-strong">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">
          {course.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {pct}% complete
        </span>
      </span>
    </button>
  )
}
