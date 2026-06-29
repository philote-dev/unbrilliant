import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTrialRun } from "@/features/trials/TrialRunProvider"
import { currentSegment } from "@/features/trials/trialModule"
import type { Position, StructureKind } from "@/features/trials/types"

import { OperationChip } from "./OperationChip"
import { RuleEcho } from "./RuleEcho"
import { STRUCTURE_META, StructurePalette } from "./StructurePalette"

/**
 * The sensible labelled zones for each structure, in display order. Tap targets
 * are derived from these, never from the capability matrix, so a stack offers a
 * single "Top" and the linear structures offer Front / Middle / Back. A chip is
 * only accepted into a zone its operation's `allowedPositions` permits.
 */
const ZONES_BY_STRUCTURE: Record<StructureKind, Position[]> = {
  queue: ["front", "middle", "back"],
  array: ["front", "middle", "back"],
  "linked-list": ["front", "middle", "back"],
  stack: ["top"],
}

const ZONE_LABEL: Record<Position, string> = {
  front: "Front",
  middle: "Middle",
  back: "Back",
  top: "Top",
  current: "Current",
  byIndex: "By index",
}

function zonesFor(structure: StructureKind | null): Position[] {
  return structure ? ZONES_BY_STRUCTURE[structure] : []
}

/**
 * The signature interaction. Choose a structure, then tap an operation chip to
 * arm it and tap a labelled zone to place it; the board echoes each placement as
 * a rule. Run is enabled only once a structure is chosen and every required
 * operation is placed. The rich animated figure replaces the schematic next.
 */
export function DesignBoard() {
  const { state, dispatch } = useTrialRun()
  const segment = currentSegment(state)
  const reduce = useReducedMotion()
  const [armedOp, setArmedOp] = useState<string | null>(null)

  const structure = state.structure
  const zones = zonesFor(structure)

  // A placement only "counts" on the board when its target is a real zone of the
  // chosen structure; a stale placement from a different structure family (e.g. a
  // "top" left over after switching to a queue) reads as un-placed instead of an
  // invisible orphan, and never enables Run.
  const placedZoneOf = (opId: string): Position | null => {
    const pos = state.mapping[opId]
    return pos != null && zones.includes(pos) ? pos : null
  }
  const isPlaced = (opId: string) => placedZoneOf(opId) != null

  const armedSpec = segment.operations.find((op) => op.id === armedOp) ?? null
  const trayOps = segment.operations.filter((op) => !isPlaced(op.id))
  const hasPlacement = segment.operations.some((op) => isPlaced(op.id))
  const canRun =
    structure != null && segment.required.every((req) => isPlaced(req.op))

  function chooseStructure(next: StructureKind) {
    dispatch({ type: "choose-structure", structure: next })
    setArmedOp(null)
  }

  function tapChip(opId: string) {
    setArmedOp((cur) => (cur === opId ? null : opId))
  }

  function tapZone(zone: Position) {
    if (armedSpec == null || !armedSpec.allowedPositions.includes(zone)) return
    dispatch({ type: "place-op", op: armedSpec.id, position: zone })
    setArmedOp(null)
  }

  const isStack = structure === "stack"

  return (
    <div className="flex flex-col gap-4">
      {segment.offeredStructures.length > 0 ? (
        <StructurePalette
          offered={segment.offeredStructures}
          chosen={structure}
          onChoose={chooseStructure}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
          This final review is a prediction step. The replay-and-predict
          interaction arrives in the next update.
        </p>
      )}

      {structure && (
        <>
          <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                {STRUCTURE_META[structure].label}
              </span>
              <span className="text-xs font-medium text-lilac-strong">
                {armedSpec
                  ? "Tap a highlighted zone"
                  : "Tap an operation, then a zone"}
              </span>
            </div>
            <div
              className={cn("flex gap-2", isStack && "mx-auto max-w-[200px]")}
            >
              {zones.map((zone) => {
                const chipsHere = segment.operations.filter(
                  (op) => placedZoneOf(op.id) === zone,
                )
                const active =
                  armedSpec != null && armedSpec.allowedPositions.includes(zone)
                const dimmed = armedSpec != null && !active
                return (
                  <div
                    key={zone}
                    className={cn(
                      "relative flex min-h-[96px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-3 transition-[border-color,background-color,opacity]",
                      active
                        ? "border-lilac-strong bg-lilac-soft"
                        : "border-border bg-muted/40",
                      dimmed && "opacity-40",
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {ZONE_LABEL[zone]}
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {chipsHere.map((op) => (
                        <motion.div
                          key={op.id}
                          initial={
                            reduce ? false : { scale: 0.85, opacity: 0 }
                          }
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            duration: 0.18,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        >
                          <OperationChip
                            placed
                            label={op.label}
                            aria-label={`Remove ${op.label} from ${ZONE_LABEL[
                              zone
                            ].toLowerCase()}`}
                            onClick={() =>
                              dispatch({ type: "unplace-op", op: op.id })
                            }
                          />
                        </motion.div>
                      ))}
                    </div>
                    {active && (
                      <button
                        type="button"
                        aria-label={`Place at ${ZONE_LABEL[zone].toLowerCase()}`}
                        onClick={() => tapZone(zone)}
                        className="absolute inset-0 rounded-2xl"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {trayOps.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Operations
              </p>
              <div className="flex flex-wrap gap-2">
                {trayOps.map((op) => (
                  <OperationChip
                    key={op.id}
                    label={op.label}
                    armed={armedOp === op.id}
                    onClick={() => tapChip(op.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your design reads as
            </p>
            {hasPlacement ? (
              <RuleEcho
                structure={structure}
                mapping={state.mapping}
                operations={segment.operations}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Place an operation to see the rule it creates.
              </p>
            )}
          </div>
        </>
      )}

      <div>
        <Button
          variant="tactile"
          size="lg"
          className="w-full"
          disabled={!canRun}
          onClick={() => dispatch({ type: "run-stress" })}
        >
          Run the stress test
        </Button>
        {!structure && segment.offeredStructures.length > 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Choose a structure, then place each operation to run the stress test.
          </p>
        )}
      </div>
    </div>
  )
}
