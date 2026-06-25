import { useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react"
import { createPortal } from "react-dom"
import { BookOpen, Lock, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { useNavigation } from "@/lib/navigation"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { courseIcon } from "@/lessons/icons"
import {
  COURSES,
  courseLessons,
  isLessonPlayable,
  isLessonUnlocked,
} from "@/lessons/catalog"

/** Event other UI (e.g. the SideNav search button) dispatches to open the palette. */
export const OPEN_COMMAND_EVENT = "willow:open-command"

interface Item {
  kind: "course" | "lesson"
  id: string
  title: string
  meta: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  locked: boolean
  disabled: boolean
  run: () => void
}

/**
 * Cmd/Ctrl+K quick-jump over lessons and courses (the only scope). Closed by
 * default and rendered through a portal, so it adds zero DOM until opened (no
 * collisions with the mobile flow or its locators). Opens via the shortcut or an
 * `OPEN_COMMAND_EVENT` window event.
 */
export function CommandPalette() {
  const { navigate } = useNavigation()
  const { progressByLesson } = useCourseProgress()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery("")
    setActive(0)
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    for (const c of COURSES) {
      const soon = c.state !== "available"
      out.push({
        kind: "course",
        id: c.id,
        title: c.title,
        meta: soon ? "Course · coming soon" : "Course",
        Icon: courseIcon(c.icon),
        locked: soon,
        disabled: soon,
        run: () => navigate({ name: "course", courseId: c.id }),
      })
      for (const l of courseLessons(c.id)) {
        const playable = isLessonPlayable(l.id)
        const unlocked = isLessonUnlocked(l.id, progressByLesson)
        const locked = !(playable && unlocked)
        out.push({
          kind: "lesson",
          id: l.id,
          title: l.name,
          meta: `Lesson · ${c.title}`,
          Icon: BookOpen,
          locked,
          disabled: false,
          run: () =>
            locked
              ? navigate({ name: "course", courseId: c.id })
              : navigate({ name: "lesson", lessonId: l.id }),
        })
      }
    }
    return out
  }, [navigate, progressByLesson])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) || it.meta.toLowerCase().includes(q),
    )
  }, [items, query])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-cmd-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [active])

  if (!open) return null

  const close = () => setOpen(false)
  const choose = (it: Item) => {
    if (it.disabled) return
    it.run()
    close()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search lessons and courses"
    >
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 cursor-default bg-foreground/25 backdrop-blur-sm"
        onClick={close}
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, filtered.length - 1))
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === "Enter") {
                e.preventDefault()
                const it = filtered[active]
                if (it) choose(it)
              } else if (e.key === "Escape") {
                e.preventDefault()
                close()
              }
            }}
            placeholder="Search lessons and courses..."
            className="h-14 w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground sm:block">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No lessons or courses match.
            </p>
          ) : (
            filtered.map((it, i) => (
              <button
                key={`${it.kind}:${it.id}`}
                type="button"
                data-cmd-index={i}
                disabled={it.disabled}
                onClick={() => choose(it)}
                onMouseMove={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  it.disabled && "opacity-50",
                  i === active && !it.disabled ? "bg-lilac-soft" : "",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <it.Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {it.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {it.meta}
                  </span>
                </span>
                {it.locked && <Lock className="size-3.5 shrink-0 text-faint" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
