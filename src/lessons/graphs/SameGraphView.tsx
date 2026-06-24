import { cn } from "@/lib/utils"
import type { Adjacency, NodeId, Pt } from "@/features/lesson/graphsEngine"
import { AdjacencyPanel } from "./AdjacencyPanel"
import { GraphCanvas } from "./GraphCanvas"

export interface GraphView {
  nodes: NodeId[]
  adj: Adjacency
  layout: Record<NodeId, Pt>
}

/**
 * Two node-link pictures side by side for the same-graph + redraw beats: the
 * "first" and the re-laid-out "second". The learner decides identity by the
 * **connections**, never the layout, so both panels render plain display canvases
 * and the verdict (in the engine) reads only adjacency. With `showData`, each
 * picture also carries its adjacency list underneath (the redraw "show the data"
 * reveal); by default the layout is the original two-picture view, unchanged.
 */
export function SameGraphView({
  before,
  after,
  reducedMotion,
  showData,
  className,
}: {
  before: GraphView
  after: GraphView
  reducedMotion?: boolean
  /** Render each picture's adjacency list under its canvas (redraw reveal). */
  showData?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex w-full flex-col gap-3 sm:flex-row", className)}>
      <Panel label="First" view={before} showData={showData}>
        <GraphCanvas
          mode="display"
          nodes={before.nodes}
          adj={before.adj}
          layout={before.layout}
          reducedMotion={reducedMotion}
        />
      </Panel>
      <Panel label="Second" view={after} showData={showData}>
        <GraphCanvas
          mode="display"
          nodes={after.nodes}
          adj={after.adj}
          layout={after.layout}
          reducedMotion={reducedMotion}
        />
      </Panel>
    </div>
  )
}

function Panel({
  label,
  view,
  showData,
  children,
}: {
  label: string
  view: GraphView
  showData?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/40 p-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
      {showData && <AdjacencyPanel nodes={view.nodes} adj={view.adj} />}
    </div>
  )
}
