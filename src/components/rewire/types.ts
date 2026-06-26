import type { ReactNode } from "react"

import type { RewireIntent } from "./core"

export type { RewireIntent }

/**
 * Public props for the rewire surface and its source/target slots. The surface
 * is presentation-only: it emits a `from → to` intent on a valid drop and never
 * decides correctness. `legalTargets` (from a pure engine selector) drives
 * affordance highlighting and announcements only — it never gates emission.
 */
export interface RewireSurfaceProps {
  /** Target ids to highlight as legal — highlight/announce only, never gates emit. */
  legalTargets: Set<string>
  /** Fired ONLY on a drop/choice over a REGISTERED target (legal or not). */
  onRewire: (from: string, to: string) => void
  children: ReactNode
  /** Accessible name for the whole surface (a `group`). */
  label?: string
  className?: string
}

export interface RewireSourceProps {
  /** Opaque id emitted as `from`. */
  id: string
  /** Accessible name announced when this source is chosen. */
  label: string
  children?: ReactNode
  className?: string
  /** Drop the default pill chrome + status dot so the consumer styles it fully
   * (the gesture, focus ring, and drag-follow are kept). */
  bare?: boolean
}

export interface RewireTargetProps {
  /** Opaque id emitted as `to`. */
  id: string
  /** Accessible name announced when this target is available/chosen. */
  label: string
  children?: ReactNode
  className?: string
  /** Drop the default visible affordance so the consumer draws its own (e.g. a
   * caret); stays a transparent, sized hit zone for drag/keyboard/tap + tracer. */
  bare?: boolean
}
