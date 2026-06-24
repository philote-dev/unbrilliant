/**
 * A tiny trend line. Points are normalized into the viewBox (flat series sit at
 * mid-height). `area` fills down to the baseline with a faint lilac wash plus a
 * solid top stroke; `line` draws just the stroke. Fewer than two points renders
 * a flat baseline. Decorative, so it is hidden from assistive tech.
 */
export function Sparkline({
  points,
  mode = "line",
  width = 120,
  height = 36,
}: {
  points: number[]
  mode?: "line" | "area"
  width?: number
  height?: number
}) {
  const pad = 2
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const baseline = height - pad

  if (points.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <line
          x1={pad}
          y1={baseline}
          x2={width - pad}
          y2={baseline}
          stroke="var(--muted)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    )
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min
  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * innerW
    const y = span === 0 ? pad + innerH / 2 : pad + innerH - ((v - min) / span) * innerH
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const linePoints = coords.join(" ")

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {mode === "area" ? (
        <polygon
          points={`${pad.toFixed(2)},${baseline.toFixed(2)} ${linePoints} ${(
            width - pad
          ).toFixed(2)},${baseline.toFixed(2)}`}
          fill="var(--lilac-strong)"
          fillOpacity={0.15}
          stroke="none"
        />
      ) : null}
      <polyline
        points={linePoints}
        fill="none"
        stroke="var(--lilac-strong)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
