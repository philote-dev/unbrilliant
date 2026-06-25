import type { ReactNode } from "react"

/**
 * Circular progress as two stacked SVG circles: a muted track and a lilac arc.
 * The arc length is driven by `strokeDashoffset`, rotated so it starts at 12
 * o'clock. `value`/`max` are clamped (a non-positive max reads as 0%). The
 * optional center slot is absolutely positioned over the ring.
 */
export function Ring({
  value,
  max = 1,
  size = 96,
  stroke = 10,
  children,
}: {
  value: number
  max?: number
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const pct = max > 0 ? value / max : 0
  const clamped = Math.max(0, Math.min(1, pct))
  const center = size / 2
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--lilac-strong)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - clamped)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {children != null ? (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      ) : null}
    </div>
  )
}
