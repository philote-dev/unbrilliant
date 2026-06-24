/** A bar with rounded top corners and a flat base sitting on the baseline. */
function barPath(x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.min(radius, w / 2, h)
  return [
    `M ${x},${y + h}`,
    `L ${x},${y + r}`,
    `Q ${x},${y} ${x + r},${y}`,
    `L ${x + w - r},${y}`,
    `Q ${x + w},${y} ${x + w},${y + r}`,
    `L ${x + w},${y + h}`,
    "Z",
  ].join(" ")
}

/**
 * A compact bar chart: one rounded-top bar per value, scaled to the largest.
 * Zero values still draw a faint muted stub so the column reads as "no activity"
 * rather than missing. Decorative, so it is hidden from assistive tech.
 */
export function MiniBars({
  values,
  height = 40,
}: {
  values: number[]
  height?: number
}) {
  const barW = 10
  const gap = 6
  const pad = 2
  const stub = 3
  const n = values.length
  const width = n > 0 ? pad * 2 + n * barW + (n - 1) * gap : pad * 2
  const usable = height - pad * 2
  const max = n > 0 ? Math.max(...values) : 0

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {values.map((v, i) => {
        const x = pad + i * (barW + gap)
        const h = max > 0 ? Math.max(0, (v / max) * usable) : 0
        if (h <= 0) {
          return (
            <path
              key={i}
              d={barPath(x, height - pad - stub, barW, stub, stub / 2)}
              fill="var(--muted)"
            />
          )
        }
        return (
          <path key={i} d={barPath(x, height - pad - h, barW, h, 4)} fill="var(--lilac-strong)" />
        )
      })}
    </svg>
  )
}
