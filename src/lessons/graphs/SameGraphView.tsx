import { cn } from "@/lib/utils"
import type { Adjacency, NodeId, Pt } from "@/features/lesson/graphsEngine"
import { AdjacencyPanel } from "./AdjacencyPanel"
import { SubwayMap } from "./SubwayMap"

export interface SubwayView {
  nodes: NodeId[]
  adj: Adjacency
  layout: Record<NodeId, Pt>
}

/**
 * The same-graph beat, subway-skinned: the SAME network shown two ways, a
 * geographic street map beside the clean diagram. The learner decides identity by
 * the connections (the route list), never the layout, so the engine's verdict
 * reads only adjacency. The two pictures are deliberately, wildly different to
 * make "the picture is decoration, adjacency is the data" land. On reveal each
 * map carries its route list, so the connections can be compared directly.
 */
export function SameGraphView({
  before,
  after,
  reducedMotion,
  revealLists,
  className,
}: {
  /** Geographic map (the irregular "first" picture). */
  before: SubwayView
  /** Diagrammatic map (the schematic "second" picture). */
  after: SubwayView
  reducedMotion?: boolean
  /** Render each map's route list underneath (the classify reveal). */
  revealLists?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex w-full flex-col gap-3 sm:flex-row", className)}>
      <Panel label="First" hint="street map" view={before} revealLists={revealLists}>
        <SubwayMap
          mode="display"
          nodes={before.nodes}
          adj={before.adj}
          layout={before.layout}
          variant="geographic"
          reducedMotion={reducedMotion}
        />
      </Panel>
      <Panel label="Second" hint="clean diagram" view={after} revealLists={revealLists}>
        <SubwayMap
          mode="display"
          nodes={after.nodes}
          adj={after.adj}
          layout={after.layout}
          variant="diagrammatic"
          reducedMotion={reducedMotion}
        />
      </Panel>
    </div>
  )
}

function Panel({
  label,
  hint,
  view,
  revealLists,
  children,
}: {
  label: string
  hint: string
  view: SubwayView
  revealLists?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/40 p-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label} <span className="font-normal normal-case">({hint})</span>
      </span>
      {children}
      {revealLists && (
        <AdjacencyPanel nodes={view.nodes} adj={view.adj} transit title={`${label} route list`} />
      )}
    </div>
  )
}
