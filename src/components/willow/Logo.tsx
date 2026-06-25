import { cn } from "@/lib/utils"
import treeUrl from "@/assets/willow-tree.png"

/**
 * Weeping-willow mark, taken straight from the source artwork
 * (docs/design/assets/willow-logo-tree.png, cropped to a transparent PNG). It is
 * rendered as a `currentColor` mask, so it keeps the exact shape of the artwork
 * while still inheriting color from a text-* utility (default: text-lilac-strong).
 */
export function WillowMark({
  className,
  title = "Willow",
}: {
  className?: string
  title?: string
}) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cn("inline-block bg-current text-lilac-strong", className)}
      style={{
        maskImage: `url(${treeUrl})`,
        WebkitMaskImage: `url(${treeUrl})`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
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
