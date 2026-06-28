import {
  BarChart3,
  BookOpen,
  Home,
  Settings,
  type LucideIcon,
} from "lucide-react"

import type { Screen, Tab } from "@/lib/navigation"

export interface NavItem {
  tab: Tab
  label: string
  Icon: LucideIcon
  target: Screen
}

/** The four primary destinations, shared by the mobile BottomNav and desktop SideNav. */
export const NAV_ITEMS: NavItem[] = [
  { tab: "home", label: "Home", Icon: Home, target: { name: "home" } },
  { tab: "learn", label: "Learn", Icon: BookOpen, target: { name: "courses" } },
  {
    tab: "progress",
    label: "Progress",
    Icon: BarChart3,
    target: { name: "progress" },
  },
  {
    tab: "settings",
    label: "Settings",
    Icon: Settings,
    target: { name: "settings" },
  },
]
