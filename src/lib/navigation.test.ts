import { describe, expect, it } from "vitest"

import { initialScreenFromLocation } from "@/lib/initialScreen"

describe("initialScreenFromLocation", () => {
  it("opens the hidden playtest screen from a lesson query", () => {
    const screen = initialScreenFromLocation(
      new URL("https://willow.test/playtest?lesson=graphs"),
    )

    expect(screen).toEqual({ name: "playtest", lessonId: "graphs" })
  })

  it("falls back home when the playtest lesson is missing or unknown", () => {
    expect(
      initialScreenFromLocation(new URL("https://willow.test/playtest")),
    ).toEqual({ name: "home" })
    expect(
      initialScreenFromLocation(
        new URL("https://willow.test/playtest?lesson=bogus"),
      ),
    ).toEqual({ name: "home" })
  })
})
