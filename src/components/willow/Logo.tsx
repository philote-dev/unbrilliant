import { cn } from "@/lib/utils"

/**
 * Single-color weeping-willow mark. Inherits `currentColor`, so color it with
 * a text-* utility (e.g. text-lilac-strong). Drooping strands + leaf teardrops
 * over a flared trunk. See docs/design/assets/willow-logo-tree.png.
 */
export function WillowMark({
  className,
  title = "Willow",
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 48 50"
      role="img"
      aria-label={title}
      className={cn("text-lilac-strong", className)}
    >
      {/* weeping willow: nested dome arcs + a hanging veil over an open trunk */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* dome arcs (rounded canopy) */}
        <path d="M11.5 18 C11.5 5 36.5 5 36.5 18" />
        <path d="M13.63 18 C13.63 6.38 34.38 6.38 34.38 18" />
        <path d="M15.75 18 C15.75 7.75 32.25 7.75 32.25 18" />
        <path d="M17.88 18 C17.88 9.13 30.13 9.13 30.13 18" />
        <path d="M20 18 C20 10.5 28 10.5 28 18" />
        {/* weeping veil */}
        <path d="M11.5 17 C11.5 22.4 11.22 26.84 10.8 29" />
        <path d="M13.58 13.64 C13.58 20.96 13.35 26.99 13 29.92" />
        <path d="M15.67 10.89 C15.67 19.79 15.48 27.11 15.2 30.67" />
        <path d="M17.75 8.75 C17.75 18.88 17.61 27.2 17.4 31.25" />
        <path d="M19.83 7.22 C19.83 18.22 19.74 27.27 19.6 31.67" />
        <path d="M21.92 6.31 C21.92 17.83 21.87 27.31 21.8 31.92" />
        <path d="M24 6 C24 17.7 24 27.32 24 32" />
        <path d="M26.08 6.31 C26.08 17.83 26.13 27.31 26.2 31.92" />
        <path d="M28.17 7.22 C28.17 18.22 28.26 27.27 28.4 31.67" />
        <path d="M30.25 8.75 C30.25 18.88 30.39 27.2 30.6 31.25" />
        <path d="M32.33 10.89 C32.33 19.79 32.52 27.11 32.8 30.67" />
        <path d="M34.42 13.64 C34.42 20.96 34.65 26.99 35 29.92" />
        <path d="M36.5 17 C36.5 22.4 36.78 26.84 37.2 29" />
        {/* woven crown peak */}
        <path d="M21.3 10 L24 7" />
        <path d="M26.7 10 L24 7" />
        {/* open flared trunk */}
        <path d="M22.7 18 C22.2 26 21.8 35 19.6 44.5" />
        <path d="M25.3 18 C25.8 26 26.2 35 28.4 44.5" />
        <path d="M19.6 44.5 C21.7 47.4 26.3 47.4 28.4 44.5" />
      </g>
    </svg>
  )
}

/** Mark + “Willow” wordmark lockup. Color via `className` (text color). */
export function WillowLogo({
  className,
  markClassName,
  size = "md",
  wordmark = true,
}: {
  className?: string
  markClassName?: string
  size?: "sm" | "md" | "lg"
  wordmark?: boolean
}) {
  const mark = {
    sm: "size-6",
    md: "size-9",
    lg: "size-12",
  }[size]
  const word = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  }[size]

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <WillowMark className={cn(mark, markClassName)} />
      {wordmark && (
        <span className={cn("font-semibold tracking-tight text-lilac-strong", word)}>
          Willow
        </span>
      )}
    </div>
  )
}
