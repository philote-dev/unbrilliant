import { Fragment } from "react"
import { ArrowDown } from "lucide-react"

import { cn } from "@/lib/utils"
import type { PathLayoutProps } from "../CoursePath"
import { PathNodeButton, labelClass } from "./node"

/**
 * Linked Lists → nodes joined by "next" pointers. Each lesson is a node box
 * carrying its data plus a next field; a pointer arrow links it to the one
 * below, and the chain ends at null.
 */
export function LinkedListPath({ nodes, onSelect, className }: PathLayoutProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      {nodes.map((node, i) => (
        <Fragment key={node.id}>
          <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2">
            <PathNodeButton node={node} onSelect={onSelect} shape="round" size={42} />
            <span className={cn("text-[15px] leading-tight", labelClass(node.state))}>
              {node.name}
            </span>
            <span className="ml-auto shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              next
            </span>
          </div>
          <ArrowDown className="size-4 text-lilac-strong/60" />
          {i === nodes.length - 1 && (
            <span className="rounded-lg border border-dashed border-border px-3 py-1 font-mono text-xs text-muted-foreground">
              null
            </span>
          )}
        </Fragment>
      ))}
    </div>
  )
}
