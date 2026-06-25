import { Award, Flame, Hash, Target, Trophy, type LucideIcon } from "lucide-react"

import type { AchievementId, AchievementsVM } from "./types"

import { Badge } from "./Badge"
import { MetricCard } from "./MetricCard"

/* Each achievement maps to a lucide glyph. Flame here is lucide's, not the app's
   animated streak flame. */
const ACHIEVEMENT_ICONS: Record<AchievementId, LucideIcon> = {
  "first-mastery": Award,
  "perfect-lesson": Target,
  "streak-7": Flame,
  "answers-100": Hash,
  "course-complete": Trophy,
}

/**
 * Grid of achievement badges, earned or locked per item. With nothing earned
 * every badge falls back to Badge's built-in locked styling, so the all-locked
 * state needs no separate placeholder.
 */
export function AchievementsTile({ items }: AchievementsVM) {
  return (
    <MetricCard title="Achievements">
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
        {items.map((item) => (
          <Badge
            key={item.id}
            icon={ACHIEVEMENT_ICONS[item.id]}
            label={item.label}
            earned={item.earned}
          />
        ))}
      </div>
    </MetricCard>
  )
}
