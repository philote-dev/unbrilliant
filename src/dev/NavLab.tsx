import {
  BarChart3,
  BookOpen,
  Home,
  Menu,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { WillowLogo, WillowMark } from "@/components/willow/Logo"

/**
 * Navigation explorations (prototype only, not wired into the app). Renders the
 * current sidebar next to three top-bar directions so the shapes can be compared
 * side by side. Each frame is a faux "window": the nav chrome over a stand-in
 * Home body, styled with the real Willow tokens so the comparison is honest.
 */

type NavEntry = { label: string; Icon: LucideIcon }

const NAV: NavEntry[] = [
  { label: "Home", Icon: Home },
  { label: "Learn", Icon: BookOpen },
  { label: "Progress", Icon: BarChart3 },
  { label: "Settings", Icon: Settings },
]

function Avatar({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-lilac-soft font-bold text-lilac-strong ring-2 ring-lilac-strong/20",
        size === "sm" ? "size-7 text-xs" : "size-9 text-sm",
      )}
      title="Frank"
    >
      F
    </span>
  )
}

function SearchPill({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">Search lessons and courses...</span>
      <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium sm:inline">
        ⌘K
      </kbd>
    </div>
  )
}

function TopTab({ label, Icon, active }: NavEntry & { active?: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium",
        active ? "bg-lilac-soft text-lilac-strong" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4" strokeWidth={active ? 2.4 : 2} />
      {label}
    </span>
  )
}

function Frame({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-bold text-lilac-strong">{label}</h3>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-background shadow-card">
        {children}
      </div>
    </section>
  )
}

/** A compact stand-in for a real page, so each nav reads in context. */
function FauxBody({ className }: { className?: string }) {
  return (
    <div className={cn("px-7 py-6", className)}>
      <h2 className="text-xl font-bold text-foreground">Good evening, Frank</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Pick up where you left off.</p>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-primary px-5 py-3.5 text-primary-foreground shadow-soft">
        <span className="text-sm font-semibold">Continue · Stacks &amp; Queues</span>
        <span className="text-xs opacity-80">3 / 8 mastered</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {["Arrays", "Linked lists", "Hash tables"].map((t) => (
          <div key={t} className="rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
            <div className="h-7 w-7 rounded-xl bg-lilac-soft" />
            <p className="mt-2 text-sm font-semibold text-foreground">{t}</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------- the options ------------------------------- */

/** Reference: today's persistent left rail. */
function SidebarRef() {
  return (
    <div className="flex h-[300px]">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-card p-4">
        <WillowLogo size="sm" />
        <SearchPill className="mt-4" />
        <nav className="mt-3 flex flex-col gap-1">
          {NAV.map((n, i) => (
            <span
              key={n.label}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium",
                i === 0 ? "bg-lilac-soft text-lilac-strong" : "text-muted-foreground",
              )}
            >
              <n.Icon className="size-5" />
              {n.label}
            </span>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <Avatar size="sm" />
          <span className="text-xs font-medium text-foreground">Frank</span>
        </div>
      </aside>
      <FauxBody className="flex-1" />
    </div>
  )
}

/** Option A: centered search, pages split two left / two right, avatar far right. */
function TopBarBalanced() {
  return (
    <div>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-1 justify-self-start">
          <WillowLogo size="sm" />
          <span className="mx-1 h-6 w-px bg-border" />
          <TopTab {...NAV[0]} active />
          <TopTab {...NAV[1]} />
        </div>
        <SearchPill className="w-[min(360px,42vw)] justify-self-center" />
        <div className="flex items-center gap-1 justify-self-end">
          <TopTab {...NAV[2]} />
          <TopTab {...NAV[3]} />
          <span className="ml-1">
            <Avatar />
          </span>
        </div>
      </header>
      <FauxBody />
    </div>
  )
}

/** Option B: brand + all four pages on the left, centered search, avatar right. */
function TopBarLeftNav() {
  return (
    <div>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-1 justify-self-start">
          <WillowLogo size="sm" />
          <span className="mx-1 h-6 w-px bg-border" />
          {NAV.map((n, i) => (
            <TopTab key={n.label} {...n} active={i === 0} />
          ))}
        </div>
        <SearchPill className="w-[min(360px,42vw)] justify-self-center" />
        <div className="justify-self-end">
          <Avatar />
        </div>
      </header>
      <FauxBody />
    </div>
  )
}

/** Option C: a slim icon rail kept, plus a top bar with centered search + avatar. */
function HybridRail() {
  return (
    <div className="flex h-[300px]">
      <aside className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-border bg-card py-4">
        <span className="mb-2 flex size-9 items-center justify-center">
          <WillowMark className="size-7" />
        </span>
        {NAV.map((n, i) => (
          <span
            key={n.label}
            title={n.label}
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              i === 0 ? "bg-lilac-soft text-lilac-strong" : "text-muted-foreground",
            )}
          >
            <n.Icon className="size-5" />
          </span>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border bg-card px-4 py-3">
          <span className="justify-self-start text-sm font-semibold text-foreground">Home</span>
          <SearchPill className="w-[min(340px,40vw)] justify-self-center" />
          <div className="justify-self-end">
            <Avatar />
          </div>
        </header>
        <FauxBody className="flex-1" />
      </div>
    </div>
  )
}

function PhoneFrame({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-bold text-lilac-strong">{label}</h3>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <div className="relative mx-auto h-[340px] w-[300px] overflow-hidden rounded-3xl border border-border bg-background shadow-card">
        <div className="px-5 pt-6">
          <h2 className="text-lg font-bold text-foreground">Predict the result</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tap the cell that leaves first.</p>
          <div className="mt-4 h-28 rounded-2xl border border-border bg-card" />
        </div>
        {children}
      </div>
    </section>
  )
}

function FabIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-12 items-center justify-center rounded-2xl border border-border bg-card/90 text-foreground shadow-card backdrop-blur-md",
        className,
      )}
    >
      <Menu className="size-5" />
    </span>
  )
}

function CtaPill({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-soft",
        className,
      )}
    >
      Continue
    </div>
  )
}

function MobilePlacementVariants() {
  return (
    <div className="grid grid-cols-1 gap-7 sm:grid-cols-3">
      <PhoneFrame label="Variant 1" note="Icon floats clear ABOVE the full-width CTA">
        <div className="absolute inset-x-4 bottom-4">
          <div className="mb-3 flex justify-end">
            <FabIcon />
          </div>
          <CtaPill />
        </div>
      </PhoneFrame>

      <PhoneFrame label="Variant 2" note="Icon inline at the end of the CTA row (CTA shrinks)">
        <div className="absolute inset-x-4 bottom-4 flex items-center gap-2">
          <CtaPill className="flex-1" />
          <FabIcon />
        </div>
      </PhoneFrame>

      <PhoneFrame label="Variant 3" note="Icon pinned bottom-right, semi-transparent over the CTA corner">
        <div className="absolute inset-x-4 bottom-4">
          <CtaPill />
        </div>
        <div className="absolute bottom-4 right-4">
          <FabIcon className="bg-card/70" />
        </div>
      </PhoneFrame>
    </div>
  )
}

export function NavLab() {
  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-10">
      <header>
        <h2 className="text-2xl font-bold text-foreground">Navigation explorations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The current sidebar next to three top-bar directions. Prototype only, nothing here is
          wired into the app yet. Pick one (or mix) and I&apos;ll build it for real.
        </p>
      </header>

      <Frame label="Current" note="Persistent left rail (now collapsible)">
        <SidebarRef />
      </Frame>

      <Frame label="Option A" note="Top bar · search centered, pages 2 | 2, avatar top-right">
        <TopBarBalanced />
      </Frame>

      <Frame label="Option B" note="Top bar · brand + all pages left, search centered, avatar right">
        <TopBarLeftNav />
      </Frame>

      <Frame label="Option C" note="Hybrid · slim icon rail + top bar with centered search + avatar">
        <HybridRail />
      </Frame>

      <Frame label="Mobile" note="Condensed nav icon vs the lesson CTA, three placements to choose from">
        <div className="p-5">
          <MobilePlacementVariants />
        </div>
      </Frame>
    </div>
  )
}
