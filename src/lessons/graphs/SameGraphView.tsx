import { cn } from "@/lib/utils"
import type { Adjacency, NodeId, Pt } from "@/features/lesson/graphsEngine"
import { AdjacencyPanel } from "./AdjacencyPanel"
import { SubwayMap } from "./SubwayMap"
import { TRANSIT_LINES } from "./transitData"
import { tintLines, useMetroSkin, type MetroSkin } from "./metroSkin"

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
  const skin = useMetroSkin()
  const lines = tintLines(skin, TRANSIT_LINES)
  return (
    <div className={cn("flex w-full gap-2", className)}>
      <Panel skin={skin} label="Street map" view={before} revealLists={revealLists}>
        <SubwayMap
          mode="display"
          fill
          nodes={before.nodes}
          adj={before.adj}
          layout={before.layout}
          variant="geographic"
          lines={lines}
          marker="node"
          labels="none"
          paper={skin.paper}
          reducedMotion={reducedMotion}
        />
      </Panel>
      <Panel skin={skin} label="Clean diagram" view={after} revealLists={revealLists}>
        <SubwayMap
          mode="display"
          fill
          nodes={after.nodes}
          adj={after.adj}
          layout={after.layout}
          variant="diagrammatic"
          lines={lines}
          marker="node"
          labels="none"
          paper={skin.paper}
          reducedMotion={reducedMotion}
        />
      </Panel>
    </div>
  )
}

function Panel({
  skin,
  label,
  view,
  revealLists,
  children,
}: {
  skin: MetroSkin
  label: string
  view: SubwayView
  revealLists?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-2xl p-2"
      style={{ background: skin.paper, border: `1px solid ${skin.cardEdge}` }}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: skin.sub }}>
        {label}
      </span>
      {children}
      {revealLists && (
        <AdjacencyPanel nodes={view.nodes} adj={view.adj} transit title={`${label} route list`} />
      )}
    </div>
  )
}
