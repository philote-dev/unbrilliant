import { ChartColumn, GitBranch, Network } from "lucide-react"
import type { ComponentType, SVGProps } from "react"

import type { Course } from "@/lessons/catalog"

const MAP: Record<Course["icon"], ComponentType<SVGProps<SVGSVGElement>>> = {
  "data-structures": Network,
  algorithms: GitBranch,
  probability: ChartColumn,
}

export function courseIcon(icon: Course["icon"]) {
  return MAP[icon]
}
