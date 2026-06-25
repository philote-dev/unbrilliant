import { Fragment } from "react"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import type { PathLayoutProps, PathNode } from "../CoursePath"
import { PathNodeButton, labelClass } from "./node"

const BUCKETS = 4

/**
 * Hash Tables → buckets with separate chaining. Each lesson is hashed to a bucket
 * (by index); buckets that collide hold a small chain of entries.
 */
export function HashTablePath({ nodes, onSelect, className }: PathLayoutProps) {
  const buckets: PathNode[][] = Array.from({ length: BUCKETS }, () => [])
  nodes.forEach((node, i) => buckets[i % BUCKETS].push(node))

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-center text-xs text-muted-foreground">
        Hashed into buckets; collisions chain
      </p>
      {buckets.map((bucket, h) => (
        <div
          key={h}
          className="flex items-center gap-2 rounded-2xl border border-lilac-strong/25 bg-lilac-soft/40 p-2"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-lilac-strong/15 font-mono text-sm font-bold text-lilac-strong">
            {h}
          </span>
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {bucket.length === 0 && <span className="text-xs italic text-faint">empty</span>}
            {bucket.map((node, j) => (
              <Fragment key={node.id}>
                {j > 0 && <ArrowRight className="size-3.5 shrink-0 text-lilac-strong/50" />}
                <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card py-1 pl-1 pr-2">
                  <PathNodeButton node={node} onSelect={onSelect} shape="round" size={30} />
                  <span className={cn("text-xs leading-tight", labelClass(node.state))}>
                    {node.name}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
