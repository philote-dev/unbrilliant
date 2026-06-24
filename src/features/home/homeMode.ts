/**
 * The pure adaptive-Home decision. A first-timer who has not entered a course
 * yet sees the vision/marketing hero; the moment they enter/select a course it
 * becomes a personalized dashboard. The flip trigger is "entered a course",
 * not "answered a question" and not "signed in", so it is verifiable here
 * without rendering anything.
 */
export type HomeMode = "vision" | "dashboard"

export interface HomeModeState {
  currentCourseId: string | null
}

export function homeMode(state: HomeModeState): HomeMode {
  return state.currentCourseId ? "dashboard" : "vision"
}
