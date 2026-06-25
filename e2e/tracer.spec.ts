import { expect, test, type Page } from "@playwright/test"

/**
 * The single wiring proof: start anonymously → play the redesigned Stacks &
 * Queues flow (demo → teach → predict → real-world → construct, for both
 * structures, then the compare gate) → sign in mid-run (carry-up) → drive to
 * completion → continue into Arrays → reload and confirm the signed-in learner
 * resumes (progress persisted). The winning option always carries a dev-only
 * `data-answer` marker (the redesign removed the TOP/FRONT tell), and construct
 * cards carry `data-push-order` so the tracer pushes them in the correct order.
 */

const EMAIL = `tracer_${Date.now()}@willow.test`
const PASSWORD = "willow-test-pass"
const NAME = "Tracer Learner"

async function continueOn(page: Page) {
  const cont = page.getByRole("button", { name: "Continue", exact: true })
  await cont.waitFor({ state: "visible" })
  await cont.click()
}

/** Free-play demo beat: exercise the structure, then move on. */
async function playDemo(page: Page, verb: RegExp) {
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: verb }).click()
  await continueOn(page)
}

/** Predict / real-world / compare: tap the marked winning option, check, continue. */
async function answerCell(page: Page) {
  await page.locator('[data-answer="1"]').first().click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Construct: push each loose card in ascending data-push-order. A single tap on
 * a card sends it into the structure (the accessible one-action path; dragging is
 * the tactile equivalent). */
async function buildConstruct(page: Page) {
  for (let step = 0; step < 3; step++) {
    const wrappers = page.locator("[data-push-order]")
    const n = await wrappers.count()
    let bestIdx = 0
    let bestOrder = Number.POSITIVE_INFINITY
    for (let i = 0; i < n; i++) {
      const order = Number(await wrappers.nth(i).getAttribute("data-push-order"))
      if (order < bestOrder) {
        bestOrder = order
        bestIdx = i
      }
    }
    await wrappers.nth(bestIdx).locator("[data-construct-card]").click()
  }
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

async function answerArrays(page: Page) {
  await page.locator('[data-testid="answer-card"][data-answer="1"]').click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Arrays de-cued access (A1/A3): the answer is a cell, not an MCQ card — tap the
 * one marked correct (dev-only data-answer hook), then Check. */
async function answerCellTap(page: Page) {
  await page.locator('[data-answer="1"]').first().click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Traverse (Linked Lists L1): the answer is a node — tap the one marked correct
 * (dev-only data-answer hook), then Check. No MCQ cards in this beat. */
async function answerTraverse(page: Page) {
  await page.locator('[data-answer="1"]').first().click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Rewire beats (Linked Lists insert/delete/playlist): commit each write in the
 * pinned SAFE order via tap — arm a node's arrow, drop it on its correct target —
 * using the dev-only data-write-order / data-rewire-correct-target hooks.
 * (Keyboard parity is covered by the NodeGraph unit test.) */
async function rewireInOrder(page: Page) {
  const markers = page.locator("[data-write-order]")
  const n = await markers.count()
  const plan: { order: number; srcId: string; target: string }[] = []
  for (let i = 0; i < n; i++) {
    const m = markers.nth(i)
    const order = Number(await m.getAttribute("data-write-order"))
    const target = (await m.getAttribute("data-rewire-correct-target")) ?? ""
    const srcId =
      (await m.locator("xpath=..").getAttribute("data-rewire-source")) ?? ""
    plan.push({ order, srcId, target })
  }
  plan.sort((a, b) => a.order - b.order)
  for (const w of plan) {
    await page.locator(`[data-rewire-source="${w.srcId}"]`).click()
    await page.locator(`[data-rewire-target="${w.target}"]`).click()
  }
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Same as rewireInOrder, but commits each write via the KEYBOARD fallback: focus
 * the arrow, Enter to arm, ArrowRight to cycle to its correct target (targets
 * register in DOM order), Enter to confirm. Proves the keyboard path end-to-end. */
async function rewireByKeyboard(page: Page) {
  const markers = page.locator("[data-write-order]")
  const n = await markers.count()
  const plan: { order: number; srcId: string; target: string }[] = []
  for (let i = 0; i < n; i++) {
    const m = markers.nth(i)
    plan.push({
      order: Number(await m.getAttribute("data-write-order")),
      srcId: (await m.locator("xpath=..").getAttribute("data-rewire-source")) ?? "",
      target: (await m.getAttribute("data-rewire-correct-target")) ?? "",
    })
  }
  plan.sort((a, b) => a.order - b.order)
  for (const w of plan) {
    await page.locator(`[data-rewire-source="${w.srcId}"]`).focus()
    await page.keyboard.press("Enter") // arm this arrow
    const targets = await page
      .locator("[data-rewire-target]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-rewire-target")))
    const idx = targets.indexOf(w.target)
    for (let i = 0; i <= idx; i++) await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Enter") // drop on the correct node
  }
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Hash key→bucket drop via the KEYBOARD fallback: focus the key, Enter to arm,
 * ArrowDown to the correct bucket (targets register in DOM order 0..B-1), Enter.
 * The correct bucket id is exposed via a dev-only data-hash-correct-bucket hook. */
async function hashDropByKeyboard(page: Page) {
  const correct =
    (await page
      .locator("[data-hash-correct-bucket]")
      .getAttribute("data-hash-correct-bucket")) ?? ""
  await page.locator("[data-rewire-source]").first().focus()
  await page.keyboard.press("Enter") // arm the key
  const targets = await page
    .locator("[data-rewire-target]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-rewire-target")))
  const idx = targets.indexOf(correct)
  for (let i = 0; i <= idx; i++) await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter") // drop on the correct bucket
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Hash key→bucket drop via tap: arm the key, then tap its correct bucket. */
async function hashDropByPointer(page: Page) {
  const correct =
    (await page
      .locator("[data-hash-correct-bucket]")
      .getAttribute("data-hash-correct-bucket")) ?? ""
  await page.locator("[data-rewire-source]").first().click() // arm via tap
  await page.locator(`[data-rewire-target="${correct}"]`).click() // drop
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Trees descend (find / insert / real-world / contrast): tap the marked correct
 * next step until Check enables, then check. The dev-only data-answer hook moves
 * to the next correct node/ghost each render (and, for the contrast beat, walks
 * the sorted list first, then descends the BST). */
async function treeDescend(page: Page) {
  const check = page.getByRole("button", { name: "Check" })
  for (let i = 0; i < 12; i++) {
    if (!(await check.isDisabled())) break
    await page.locator('[data-answer="1"]').first().click()
  }
  await check.click()
  await continueOn(page)
}

/** Trees in-order sequence: tap nodes in ascending data-inorder-rank (the unique
 * left→node→right order), independent of the compact pixel layout. */
async function treeSequence(page: Page) {
  const ranks = await page
    .locator("[data-inorder-rank]")
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-inorder-rank"))))
  for (const r of [...ranks].sort((a, b) => a - b)) {
    await page.locator(`[data-inorder-rank="${r}"]`).click()
  }
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Heaps index-map / same-data: tap the slot marked correct (dev-only
 * data-heap-correct-slot), then check. */
async function answerHeapSlot(page: Page) {
  await page.locator("[data-heap-correct-slot]").first().click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Graphs tap-the-neighbors multi-select: tap every node marked correct (dev-only
 * data-answer), then check — the verdict is set equality on the selection. */
async function tapNeighbors(page: Page) {
  const nodes = page.locator('[data-answer="1"]')
  const n = await nodes.count()
  for (let i = 0; i < n; i++) await nodes.nth(i).click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Graphs draw-the-missing-edge via tap: arm the correct source node (its dev-only
 * data-graph-correct-target names the target node), drop on that node, then check. */
async function drawGraphEdge(page: Page) {
  const src = page.locator("[data-graph-correct-target]").first()
  const target = (await src.getAttribute("data-graph-correct-target")) ?? ""
  await src.click() // arm the source node
  await page.locator(`[data-rewire-target="${target}"]`).click() // drop on the target node
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

test("vision → browse → enter course → play → sign in (carry-up) → complete → resume", async ({
  page,
}) => {
  await page.goto("/")

  // First-run vision hero → pick a course → enter Data Structures, start.
  await page.getByRole("button", { name: "Choose a course" }).click()
  await page.getByRole("button", { name: /Data Structures/ }).click()
  await page.getByRole("button", { name: "Start", exact: true }).click()

  // Stack (signed out): demo → teach → predict → real-world → construct.
  await playDemo(page, /Push/)
  await continueOn(page) // stack teach
  await answerCell(page) // stack predict
  await answerCell(page) // stack real-world (undo)
  await buildConstruct(page) // stack construct

  // A third of the way in the nudge is up: sign in mid-run so the stack progress
  // carries up. Done between beats (not mid-construct) so the run state is settled.
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.getByPlaceholder("Email address").fill(EMAIL)
  await page.getByPlaceholder("Password").fill(PASSWORD)
  await page.getByPlaceholder("Display name").fill(NAME)
  await page.getByRole("button", { name: "Create account" }).click()

  // Queue (signed in): demo → teach → predict → real-world → construct.
  await playDemo(page, /Enqueue/)
  await continueOn(page) // queue teach
  await answerCell(page) // queue predict
  await answerCell(page) // queue real-world (printer)
  await buildConstruct(page) // queue construct

  // Compare gate: classify, then contrast.
  await answerCell(page) // classify
  await answerCell(page) // contrast

  // Completion → the CTA leads into the now-unlocked Arrays.
  await expect(page.getByText("Lesson complete")).toBeVisible()
  await expect(page.getByText("You mastered Stacks & Queues.")).toBeVisible()
  await page.getByRole("button", { name: /Continue to Arrays/ }).click()

  // Arrays (redesign): demo → teach → A1 access → A3 (jump, then scan) →
  // shift demo → teach → A2 shift → A2 spreadsheet skin → A4 classify →
  // A5 construct (append in order) → A6 grow → A6 cheap. 8 graded beats.
  await continueOn(page) // demo (read the strip)
  await continueOn(page) // teach: instant access
  await answerCellTap(page) // A1 access (tap the de-cued cell)
  await answerCellTap(page) // A3 index ask (jump)
  await answerCellTap(page) // A3 value ask (scan)
  await continueOn(page) // shift demo
  await continueOn(page) // teach: the shift cascade
  await answerArrays(page) // A2 shift-predict (resulting row)
  await answerArrays(page) // A2 spreadsheet skin (row count)
  await answerArrays(page) // A4 classify-by-position
  await rewireInOrder(page) // A5 construct-to-target (append in order)
  await answerArrays(page) // A6 grow-predict
  await answerArrays(page) // A6 amortized verdict

  // Arrays completion — a real two-lesson progression.
  await expect(page.getByText("You mastered Arrays.")).toBeVisible()

  // Continue into the now-unlocked Linked Lists and play all ten beats.
  await page.getByRole("button", { name: /Continue to Linked Lists/ }).click()
  await continueOn(page) // node demo
  await continueOn(page) // teach
  await answerTraverse(page) // traverse (L1) — tap the target node
  await rewireByKeyboard(page) // insert (L2) — via the keyboard fallback
  await rewireInOrder(page) // delete (L3)
  await answerArrays(page) // predict-the-break (L4)
  await rewireInOrder(page) // playlist (real-world)
  await answerArrays(page) // array-vs-list insert (L5)
  await answerArrays(page) // array-vs-list reach (L5)
  await page.getByRole("button", { name: "Finish lesson" }).click() // doubly coda
  await expect(page.getByText("You mastered Linked Lists.")).toBeVisible()

  // Continue into the now-unlocked Hash Tables and play all twelve beats.
  await page.getByRole("button", { name: /Continue to Hash Tables/ }).click()
  await continueOn(page) // demo
  await continueOn(page) // teach: key → location
  await hashDropByKeyboard(page) // hash cat → bucket (keyboard fallback)
  await answerCell(page) // hash cat again (tap-locate, same bucket)
  await hashDropByPointer(page) // hash dog → bucket
  await continueOn(page) // teach: collisions chain
  await answerCell(page) // collide sun
  await answerCell(page) // collide ant
  await answerCell(page) // collide pig
  await answerCell(page) // lookup found
  await answerCell(page) // lookup absent
  await hashDropByPointer(page) // contacts real-world
  await expect(page.getByText("You mastered Hash Tables.")).toBeVisible()

  // Continue into the now-unlocked Trees (BST) and play all eleven beats.
  await page.getByRole("button", { name: /Continue to Trees/ }).click()
  await continueOn(page) // tree demo (free-play descend)
  await continueOn(page) // teach: compare & descend
  await treeDescend(page) // find-hit
  await treeDescend(page) // find-miss (falls off → ghost)
  await treeDescend(page) // insert (descend to the ghost slot)
  await continueOn(page) // teach: in-order
  await treeSequence(page) // sequence-a
  await treeSequence(page) // sequence-b (compact ≠ pixel order)
  await treeDescend(page) // real-world higher/lower
  await answerArrays(page) // compare-shape (balanced vs stick)
  await treeDescend(page) // contrast-list (walk the list, then descend)
  await expect(page.getByText("You mastered Trees.")).toBeVisible()

  // Continue into the now-unlocked Heaps and play all twelve beats.
  await page.getByRole("button", { name: /Continue to Heaps/ }).click()
  await continueOn(page) // heap demo (dual view)
  await continueOn(page) // teach: lives in an array
  await continueOn(page) // teach: the heap rule
  await answerArrays(page) // sift-up predict
  await answerArrays(page) // sift-up leaderboard skin
  await continueOn(page) // teach: extract top
  await answerArrays(page) // sift-down predict
  await answerArrays(page) // sift-down deeper
  await answerHeapSlot(page) // index-map: larger child
  await answerHeapSlot(page) // index-map: parent
  await answerArrays(page) // contrast: heap vs BST placement
  await answerHeapSlot(page) // contrast: tree node ⇔ array cell
  await expect(page.getByText("You mastered Heaps.")).toBeVisible()

  // Continue into the now-unlocked Graphs and play all twelve beats.
  await page.getByRole("button", { name: /Continue to Graphs/ }).click()
  await continueOn(page) // graph demo (drag a node, nothing changes)
  await continueOn(page) // teach: adjacency is the data
  await tapNeighbors(page) // read connection list
  await tapNeighbors(page) // read degree
  await answerArrays(page) // path? (yes/no)
  await answerArrays(page) // which adjacency list matches? (MCQ)
  await continueOn(page) // draw-edges demo
  await drawGraphEdge(page) // draw the missing edge
  await drawGraphEdge(page) // transit skin: add the connection
  await continueOn(page) // redraw demo
  await answerArrays(page) // same graph? (classify)
  await answerArrays(page) // tree or graph? (classify)
  await expect(page.getByText("You mastered Graphs.")).toBeVisible()

  // Persisted + resumes: after a reload the signed-in learner lands on the
  // dashboard and resuming routes straight to a completed lesson.
  await page.reload()
  await page.getByRole("button", { name: "Continue learning" }).click()
  await expect(page.getByText("Lesson complete")).toBeVisible({ timeout: 30_000 })
})
