import { ChartColumn, GitBranch, Network } from "lucide-react"
import type { ComponentType, SVGProps } from "react"

import type { Course } from "@/lessons/catalog"
import dataStructuresArt from "@/assets/course-data-structures.png"
import algorithmsArt from "@/assets/course-algorithms.png"
import probabilityArt from "@/assets/course-probability.png"

const MAP: Record<Course["icon"], ComponentType<SVGProps<SVGSVGElement>>> = {
  "data-structures": Network,
  algorithms: GitBranch,
  probability: ChartColumn,
}

/** Compact glyph for course cards. */
export function courseIcon(icon: Course["icon"]) {
  return MAP[icon]
}

/** Large flat illustration for course headers (matches the lilac UI). */
const ART: Record<Course["icon"], string> = {
  "data-structures": dataStructuresArt,
  algorithms: algorithmsArt,
  probability: probabilityArt,
}

export function courseArt(icon: Course["icon"]) {
  return ART[icon]
}
