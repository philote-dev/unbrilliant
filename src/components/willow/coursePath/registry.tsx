import type { ComponentType } from "react"

import { CoursePath, type PathLayoutProps } from "../CoursePath"
import type { StructureKind } from "@/lessons/catalog"
import { QueuePath } from "./QueuePath"
import { ArrayPath } from "./ArrayPath"
import { LinkedListPath } from "./LinkedListPath"
import { HashTablePath } from "./HashTablePath"
import { TreePath } from "./TreePath"
import { HeapPath } from "./HeapPath"
import { GraphPath } from "./GraphPath"

/**
 * Themed course-path layouts, keyed by the structure the current lesson teaches.
 * Each StructureKind gets mapped to its own layout component here in later tasks
 * (e.g. "queue" -> QueuePath, "tree" -> TreePath, ...). While a kind is absent,
 * `pathLayoutFor` falls back to the generic CoursePath, so the path renders
 * identically for every structure until its themed layout lands.
 */
const REGISTRY: Partial<Record<StructureKind, ComponentType<PathLayoutProps>>> = {
  queue: QueuePath,
  array: ArrayPath,
  "linked-list": LinkedListPath,
  "hash-table": HashTablePath,
  tree: TreePath,
  heap: HeapPath,
  graph: GraphPath,
}

/** The layout component for a structure, or the generic CoursePath fallback. */
export function pathLayoutFor(
  kind: StructureKind | undefined,
): ComponentType<PathLayoutProps> {
  return (kind && REGISTRY[kind]) || CoursePath
}
