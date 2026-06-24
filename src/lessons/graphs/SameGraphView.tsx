import { cn } from "@/lib/utils"
import type { Adjacency, NodeId, Pt } from "@/features/lesson/graphsEngine"
import { GraphCanvas } from "./GraphCanvas"

export interface GraphView {
  nodes: NodeId[]
  adj: Adjacency
  layout: Record<NodeId, Pt>
}

/**
 * Two node-link pictures side by side for the same-graph beat: the "first" and
 * the re-laid-out "second". The learner decides identity by the **connections**,
 * never the layout — so both panels render plain display canvases and the verdict
 * (in the engine) reads only adjacency.
 */
export function SameGraphView({
  before,
  after,
  reducedMotion,
  className,
}: {
  before: GraphView
  after: GraphView
  reducedMotion?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex w-full flex-col gap-3 sm:flex-row", className)}>
      <Panel label="First">
        <GraphCanvas
          mode="display"
          nodes={before.nodes}
          adj={before.adj}
          layout={before.layout}
          reducedMotion={reducedMotion}
        />
      </Panel>
      <Panel label="Second">
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

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/40 p-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}
