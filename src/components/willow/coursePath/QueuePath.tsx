import { ArrowDown, ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"
import type { PathLayoutProps } from "../CoursePath"
import { PathNodeButton, labelClass } from "./node"

/**
 * Stacks & Queues → a FIFO queue. The lessons are items waiting in a vertical
 * tube: the front (next to leave) is at the top, new items join at the back
 * (bottom). Reading top→bottom is the lesson order, so it lines up with progress.
 */
export function QueuePath({ nodes, onSelect, className }: PathLayoutProps) {
  return (
    <div className={cn("flex flex-col items-stretch gap-2", className)}>
      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-lilac-strong">
        <ArrowUp className="size-3.5" />
        Front · next out
      </div>

      <div className="flex flex-col gap-2 rounded-3xl border-2 border-dashed border-lilac-strong/35 bg-lilac-soft/50 p-3">
        {nodes.map((node) => (
          <div key={node.id} className="flex items-center gap-3">
            <PathNodeButton node={node} onSelect={onSelect} shape="square" size={46} />
            <span className={cn("text-[15px] leading-tight", labelClass(node.state))}>
              {node.name}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ArrowDown className="size-3.5" />
        Back · new joins
      </div>
    </div>
  )
}
