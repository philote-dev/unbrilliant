import { cn } from "@/lib/utils"
import { neighbors, type Adjacency, type NodeId } from "@/features/lesson/graphsEngine"

/**
 * The adjacency list — "the graph's actual data." Monospace rows with neighbors
 * sorted (`A: B, C, E`), synced to the picture: a focused/affected row lights up
 * in lilac. Because the data is already text, a non-visual learner reads the
 * graph directly here — the first-class a11y win the lesson leans on.
 */
export function AdjacencyPanel({
  nodes,
  adj,
  highlightNodes,
  transit,
  title,
  className,
}: {
  nodes: NodeId[]
  adj: Adjacency
  /** Rows to emphasise (the asked node, drawn endpoints, the resolving read). */
  highlightNodes?: NodeId[]
  transit?: boolean
  title?: string
  className?: string
}) {
  const lit = new Set(highlightNodes ?? [])

  return (
    <div
      className={cn(
        "w-full max-w-[220px] rounded-2xl border border-border bg-card p-3 shadow-soft",
        className,
      )}
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-lilac-strong">
        {title ?? (transit ? "Route list — the data" : "Adjacency list — the data")}
      </p>
      <div className="flex flex-col gap-1 font-mono text-sm">
        {nodes.map((n) => {
          const ns = neighbors(adj, n)
          return (
            <div
              key={n}
              className={cn(
                "flex items-baseline gap-2 rounded-md px-1.5 py-0.5 transition-colors",
                lit.has(n) ? "bg-lilac-soft" : "bg-transparent",
              )}
            >
              <span
                className={cn(
                  "font-bold",
                  lit.has(n) ? "text-lilac-strong" : "text-foreground",
                )}
              >
                {n}:
              </span>
              <span className={cn(lit.has(n) ? "text-lilac-strong" : "text-muted-foreground")}>
                {ns.length ? ns.join(", ") : "—"}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
