import type { LessonModule } from "@/features/lesson/lessonModule"
import { introModule } from "@/lessons/intro"
import { stacksQueuesModule } from "@/lessons/stacksQueues"
import { arraysModule } from "@/lessons/arrays"
import { linkedListsModule } from "@/lessons/linkedLists"
import { hashTablesModule } from "@/lessons/hashTables"
import { treesModule } from "@/lessons/trees"
import { heapsModule } from "@/lessons/heaps"
import { graphsModule } from "@/lessons/graphs"

/**
 * The registry of playable lessons, keyed by id. The run provider, player
 * chrome, and persistence all look a lesson up here, so adding a real lesson is
 * a module plus one entry. Never a change to the shared seam.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LESSONS: Record<string, LessonModule<any>> = {
  [introModule.id]: introModule,
  [stacksQueuesModule.id]: stacksQueuesModule,
  [arraysModule.id]: arraysModule,
  [linkedListsModule.id]: linkedListsModule,
  [hashTablesModule.id]: hashTablesModule,
  [treesModule.id]: treesModule,
  [heapsModule.id]: heapsModule,
  [graphsModule.id]: graphsModule,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLessonModule(id: string): LessonModule<any> {
  return LESSONS[id] ?? stacksQueuesModule
}
