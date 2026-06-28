import { expect, test, type Page } from "@playwright/test"

/**
 * The single wiring proof: sign in up front, enter the course, and play every
 * lesson end to end one beat at a time the way a learner would, focusing on the
 * five redesigned lessons (Linked Lists, Hash Tables, Trees, Heaps, Graphs). Each
 * lesson is driven to its mastery completion and unlocks the next; a final reload
 * confirms the signed-in learner resumes (progress persisted). Every winning option
 * carries a dev-only `data-answer` marker (the redesign removed the visible tell);
 * the active beats (do-the-sift, forced walks, scripted writes, traces, builds,
 * edge draws) carry their own dev-only `data-*` hooks so the tracer drives them
 * deterministically.
 *
 * Why sign in BEFORE playing (not mid-run): cross-lesson progression needs durable
 * progress, and `CourseProgressProvider` overlays only the ACTIVE lesson run, so a
 * signed-out run forgets earlier lessons once it leaves them. Signing in first also
 * sidesteps the broken anonymous carry-up: the deployed firestore.rules
 * `isValidLessonProgress` evaluates `d.completedAt == null` without a
 * `'completedAt' in d` guard, so the sign-in reconcile write (which omits the field)
 * is rejected. Starting clean (no anonymous progress to carry up) keeps every
 * per-lesson save valid, so progress persists and the course unlocks in order.
 */

const EMAIL = `tracer_${Date.now()}@willow.test`
const PASSWORD = "willow-test-pass"
const NAME = "Tracer Learner"

/** A generous click timeout so a beat that opens with a short hand-off / draw-on
 * animation (the hook appears a few hundred ms in) still lands. */
const ACT = 12_000

async function continueOn(page: Page) {
  const cont = page.getByRole("button", { name: "Continue", exact: true })
  await cont.waitFor({ state: "visible" })
  await cont.click()
}

/** Move to the next lesson from a completion screen. Signed in there is no
 * save-progress prompt, but dismiss one if it ever appears, then take the
 * "Continue to X" CTA. */
async function nextLesson(page: Page, cta: RegExp) {
  const maybeLater = page.getByRole("button", { name: "Maybe later", exact: true })
  if (await maybeLater.isVisible().catch(() => false)) await maybeLater.click()
  await page.getByRole("button", { name: cta }).click()
}

/** Stacks & Queues shows a Poly "quick check" after each construct (cp-stacks /
 * cp-queues). It opens in voice mode, which is unavailable in the headless run, so
 * fall back to typing: open the keyboard, give any explanation, submit, and tap
 * Continue on the recap. The AI scorer is unreachable in the emulator-only run, so
 * the beat resolves straight to the recap. */
async function polyCheckpoint(page: Page) {
  // Voice is unavailable headless, so the checkpoint falls back to the keyboard
  // sheet on its own; if it ever stays in voice mode, reveal the keyboard.
  const box = page.getByPlaceholder("Type your explanation...")
  await box.waitFor({ state: "visible", timeout: ACT }).catch(async () => {
    await page.getByRole("button", { name: "Type instead" }).click()
    await box.waitFor({ state: "visible", timeout: ACT })
  })
  await box.fill("A stack is last in, first out; a queue is first in, first out.")
  await page.getByRole("button", { name: "Submit", exact: true }).click()
  await continueOn(page) // the recap → Continue dismisses the checkpoint
}

/** Free-play demo beat: exercise the structure, then move on. */
async function playDemo(page: Page, verb: RegExp) {
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: verb }).click()
  await continueOn(page)
}

/** Predict / real-world / compare: tap the marked winning option (the dev-only
 * `data-answer` hook, on any element), check, continue. */
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

/** MCQ-card beats (the shared AnswerCard hook): tap the card marked correct, then
 * Check + Continue. Covers Arrays predicts, LL predict, Hash collisions, Trees
 * compare-shape, Heaps contrast-place, and the Graphs match/classify beats (whose
 * themed option buttons replicate the `answer-card` testid + `data-answer` hook). */
async function answerArrays(page: Page) {
  await page.locator('[data-testid="answer-card"][data-answer="1"]').first().click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Arrays de-cued jump (A1): the answer is a cell, not an MCQ card. Tap the one
 * marked correct (dev-only data-answer hook), then Check. */
async function answerCellTap(page: Page) {
  await page.locator('[data-answer="1"]').first().click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Arrays scan walk (A3): a value search has no shortcut. Reveal cells rightward
 * one at a time until the value turns up and the beat auto-commits (no Check). */
async function walkScanArrays(page: Page) {
  const cont = page.getByRole("button", { name: "Continue", exact: true })
  await page.getByRole("button", { name: "Reveal cell 0" }).click()
  for (let i = 1; i < 8; i++) {
    if (await cont.isVisible()) break
    await page.getByRole("button", { name: `Reveal cell ${i}` }).click()
  }
  await continueOn(page)
}

/** Rewire beats (Arrays place-cheapest, Linked Lists insert/delete): commit each
 * write in the pinned SAFE order via tap. Arm a node's arrow (its
 * data-rewire-source), drop it on its correct target, using the dev-only
 * data-write-order / data-rewire-correct-target hooks. */
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

/* ------------------------------- linked lists ------------------------------ */

/** Traverse / forced walk (Linked Lists L1): only the next hop is tappable, so the
 * walk is performed, not jumped. Tap the single enabled node in the figure to take
 * one hop; the target node carries the dev-only data-answer hook on the final hop,
 * so once it appears tap it and commit with Check. */
async function walkTraverse(page: Page) {
  for (let i = 0; i < 10; i++) {
    const answer = page.locator('[data-testid="node-graph"] [data-answer="1"]')
    if (await answer.count()) {
      await answer.first().click()
      break
    }
    // The frontier (next hop) is the only enabled node button in the figure.
    await page.locator('[data-testid="node-graph"] button:not([disabled])').first().click()
  }
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** The playlist synthesis (Linked Lists, one graded slot, many writes): perform the
 * scripted insert -> delete -> reorder writes strictly in order. The next write's
 * source row carries data-write-order="1" plus its data-rewire-correct-target, so
 * arm that source and drop on the target, repeating until the queue is built. */
async function playlistSynthesis(page: Page) {
  const cont = page.getByRole("button", { name: "Continue", exact: true })
  for (let i = 0; i < 10; i++) {
    if (await cont.isVisible().catch(() => false)) break
    const marker = page.locator('[data-write-order="1"]').first()
    await marker.waitFor({ state: "visible", timeout: ACT })
    const target = (await marker.getAttribute("data-rewire-correct-target")) ?? ""
    const srcId = (await marker.locator("xpath=..").getAttribute("data-rewire-source")) ?? ""
    await page.locator(`[data-rewire-source="${srcId}"]`).first().click()
    await page.locator(`[data-rewire-target="${target}"]`).first().click()
  }
  await continueOn(page)
}

/** Contrast two-step (Linked Lists contrast-insert / contrast-reach): make the
 * de-cued pick (marked correct), Check to advance, then answer the graded why-MCQ
 * (also marked correct) and Check. */
async function contrastTwoStep(page: Page) {
  await page.locator('[data-testid="answer-card"][data-answer="1"]').first().click() // pick
  await page.getByRole("button", { name: "Check" }).click()
  await page.getByText(/Now, why/).waitFor({ state: "visible", timeout: ACT }) // why phase
  await page.locator('[data-testid="answer-card"][data-answer="1"]').first().click() // why-MCQ
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Doubly splice (Linked Lists): tap the four write chips in the SAFE order (the
 * newcomer's own pointers first, then redirect each neighbour). The chips are
 * scrambled on screen, so tap them by their write label; a wrong order only nudges. */
async function doublySplice(page: Page) {
  for (const re of [/X\.next/, /X\.prev/, /A\.next/, /B\.prev/]) {
    await page.getByRole("button", { name: re }).click()
  }
  await continueOn(page)
}

/** Doubly backward walk (Linked Lists): start at the tail and follow prev one hop
 * at a time (only the next hop is tappable). The DoublyChain has no answer hook, so
 * read the target letter from the prompt and tap the enabled node until it is the
 * target, then commit with Check. */
async function walkDoublyBackward(page: Page) {
  const heading = await page.getByRole("heading", { name: /Walk back to/ }).innerText()
  const answer = heading.match(/back to ([A-Z])/)?.[1] ?? null
  for (let i = 0; i < 8; i++) {
    const enabled = page.locator('[data-testid="doubly-graph"] button:not([disabled])').first()
    await enabled.waitFor({ state: "visible", timeout: ACT })
    const text = (await enabled.innerText()).trim()
    await enabled.click()
    if (text === answer) break
  }
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/* ------------------------------- hash tables ------------------------------- */

/** Hash insert / stow (drag): scan the key, then drop it on the bin its hash points
 * to. The figure exposes the correct bin via data-hash-correct-bucket; arm the lone
 * draggable source and drop on that bin's data-rewire-target, then Check. Covers
 * hash-cat, hash-dog, and the warehouse realworld payoff. */
async function hashDrag(page: Page) {
  const correct =
    (await page.locator("[data-hash-correct-bucket]").getAttribute("data-hash-correct-bucket")) ?? ""
  await page.locator("[data-rewire-source]").first().click() // arm the key / package
  await page.locator(`[data-rewire-target="${correct}"]`).click() // drop on its bin
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Hash design challenge (Hash Tables): pick a combine rule that reads the whole key
 * (Sum the letters) and a bucket count that spreads the target keys (5), so no keys
 * collide, then Check. The opening choice (first-letter, 5 bins) deliberately
 * collides. */
async function hashDesign(page: Page) {
  await page.getByRole("button", { name: "Sum the letters" }).click()
  await page.getByRole("button", { name: "5", exact: true }).click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/* ---------------------------------- trees --------------------------------- */

/** Trees descend / sequence / contrast (every tap-the-correct-step beat): tap the
 * single marked correct next step until Check enables, then Check. The dev-only
 * data-answer hook moves to the next correct node / ghost slot / in-order frontier
 * each render (and, for the contrast beat, walks the sorted list before the BST
 * descend). Covers find-hit/miss, insert, find-big, the frontier-gated sequences,
 * the bracket realworld, and the list-vs-tree contrast. */
async function treeDescend(page: Page) {
  const check = page.getByRole("button", { name: "Check" })
  for (let i = 0; i < 18; i++) {
    if (!(await check.isDisabled())) break
    const ans = page.locator('[data-answer="1"]')
    if ((await ans.count()) === 0) break
    await ans.first().click()
  }
  await check.click()
  await continueOn(page)
}

/** Trees build-the-BST (build-bst-1 / build-bst-2): grow the tree by descending each
 * key to its empty slot and dropping it in. Each correct next step (a child to step
 * to, or the ghost slot to drop into) carries the data-answer hook; tap it until the
 * tree is grown and the Continue button appears (the build commits via taps, never
 * Check). */
async function buildBst(page: Page) {
  const cont = page.getByRole("button", { name: "Continue", exact: true })
  for (let i = 0; i < 40; i++) {
    if (await cont.isVisible().catch(() => false)) break
    await page.locator('[data-answer="1"]').first().click({ timeout: ACT })
  }
  await continueOn(page)
}

/* ---------------------------------- heaps --------------------------------- */

/** Heaps do-the-sift / build / synthesis (every swap-performed beat): perform each
 * correct swap by tapping the node, then its swap target, until the heap rule holds
 * and the Continue button appears. The two cells of the next correct swap carry the
 * dev-only data-sift-from / data-sift-to hooks (on both the dual-view array cells
 * and the ER triage cells); extract beats play a short hand-off first, so the
 * generous click timeout waits the hooks in. */
async function doTheSift(page: Page) {
  const cont = page.getByRole("button", { name: "Continue", exact: true })
  for (let i = 0; i < 16; i++) {
    if (await cont.isVisible().catch(() => false)) break
    await page.locator("[data-sift-from]").first().click({ timeout: ACT })
    await page.locator("[data-sift-to]").first().click({ timeout: ACT })
  }
  await continueOn(page)
}

/** Heaps index-map / same-data: tap the slot marked correct (dev-only
 * data-heap-correct-slot), then Check. */
async function answerHeapSlot(page: Page) {
  await page.locator("[data-heap-correct-slot]").first().click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/* --------------------------------- graphs --------------------------------- */

/** Graphs tap-the-neighbors multi-select (read-list, read-degree): tap every node
 * marked correct (dev-only data-answer), then Check. The verdict is set equality on
 * the selection. */
async function tapNeighbors(page: Page) {
  const nodes = page.locator('[data-testid="graph-canvas"] [data-answer="1"]')
  const n = await nodes.count()
  for (let i = 0; i < n; i++) await nodes.nth(i).click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Graphs trace (read-path, read-trace-far): walk the edges node to node along a
 * known reachable path. Only the current node's neighbors are tappable buttons
 * (aria-label "node X"); tap each step in turn, and reaching the target settles the
 * beat (no Check). */
async function traceWalk(page: Page, path: string[]) {
  const canvas = page.locator('[data-testid="graph-canvas"]')
  for (const n of path) {
    await canvas.getByRole("button", { name: `node ${n}`, exact: true }).click({ timeout: ACT })
  }
  await continueOn(page)
}

/** Graphs draw-the-missing-edge via tap (draw-edge, draw-transit): arm the correct
 * source node (its dev-only data-graph-correct-target names the target node), drop
 * on that node, then Check. */
async function drawGraphEdge(page: Page) {
  const src = page.locator("[data-graph-correct-target]").first()
  const target = (await src.getAttribute("data-graph-correct-target")) ?? ""
  await src.click() // arm the source node
  await page.locator(`[data-rewire-target="${target}"]`).click() // drop on the target node
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Graphs build-the-line synthesis: draw every missing track until the live network
 * matches the ghost plan. The figure has no per-edge hook, so read the remaining
 * tracks off the live "Tracks still to lay" status, then draw each pair (arm the
 * source station, drop on the target station). The build commits by drawing (no
 * Check); when it matches the plan the Continue button appears. */
async function buildLine(page: Page) {
  let text = ""
  const status = page.getByText(/Tracks still to lay/)
  if (await status.count()) text = (await status.first().textContent()) ?? ""
  let pairs = [...text.matchAll(/([A-Z]) to ([A-Z])/g)].map((m) => [m[1], m[2]])
  // Safety net: the curated METRO plan's missing tracks, if the status can't be read.
  if (pairs.length === 0) pairs = [["A", "M"], ["B", "H"], ["D", "G"], ["D", "J"]]
  for (const [u, v] of pairs) {
    await page.locator(`[data-rewire-source="${u}"]`).first().click()
    await page.locator(`[data-rewire-target="${v}"]`).first().click()
  }
  await continueOn(page)
}

test("enter course → play intro, S&Q, Arrays, and the five redesigned lessons to mastery", async ({
  page,
}) => {
  await page.goto("/")

  // Sign in up front (before any progress) via Settings, so the broken anonymous
  // carry-up never runs and every later per-lesson save persists for real.
  const nav = page.getByRole("navigation")
  await nav.getByRole("button", { name: "Settings", exact: true }).click()
  await page.getByRole("button", { name: /Sign in to save your progress/ }).click()
  await page.getByPlaceholder("Email address").fill(EMAIL)
  await page.getByPlaceholder("Password").fill(PASSWORD)
  await page.getByPlaceholder("Display name").fill(NAME)
  await page.getByRole("button", { name: "Create account" }).click()

  // Back on Settings (signed in) → Home → vision hero → pick the course, start.
  await nav.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Choose a course" }).click()
  await page.getByRole("button", { name: /Data Structures/ }).click()
  await page.getByRole("button", { name: "Start", exact: true }).click()

  // Introduction lesson (the schema-activation opener that now gates Lesson 1):
  // an animated welcome, three reading pages, then four checks (three job MCQs and
  // the "which finds it faster" object pick). Completing it unlocks Stacks & Queues.
  await page.getByRole("button", { name: "Begin" }).click() // welcome hero
  await continueOn(page) // page 1: look at your phone
  await continueOn(page) // page 2: why bother organizing
  await page.getByRole("button", { name: "Start the questions" }).click() // page 3: the three jobs
  await answerArrays(page) // check: store (save a Wi-Fi password)
  await answerArrays(page) // check: sort (contacts A to Z)
  await answerArrays(page) // check: categorize (photo albums)
  await page.getByRole("button", { name: "Alphabetized" }).click() // why: the faster object
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page) // commits the last check → completes the intro
  await expect(page.getByText("You mastered Introduction.")).toBeVisible()
  await nextLesson(page, /Continue to Stacks & Queues/)

  // Stacks & Queues: demo → teach → predict → real-world → construct, for the stack
  // then the queue (each construct followed by a Poly quick-check), then the compare
  // gate (classify + contrast).
  await playDemo(page, /Push/)
  await continueOn(page) // stack teach
  await answerCell(page) // stack predict
  await answerCell(page) // stack real-world (undo)
  await buildConstruct(page) // stack construct
  await polyCheckpoint(page) // cp-stacks quick-check

  await playDemo(page, /Enqueue/)
  await continueOn(page) // queue teach
  await answerCell(page) // queue predict
  await answerCell(page) // queue real-world (printer)
  await buildConstruct(page) // queue construct
  await polyCheckpoint(page) // cp-queues quick-check

  await answerCell(page) // compare: classify
  await answerCell(page) // compare: contrast

  await expect(page.getByText("Lesson complete")).toBeVisible()
  await expect(page.getByText("You mastered Stacks & Queues.")).toBeVisible()
  await nextLesson(page, /Continue to Arrays/)

  // Arrays (rebuild): play-access → jump → scan → play-mutate → insert → delete →
  // place-cheapest → realworld → teach-grow → grow → grow-summary. 7 graded beats.
  await continueOn(page) // play-access (read the strip)
  await answerCellTap(page) // jump (tap the de-cued cell)
  await walkScanArrays(page) // scan (walk the row until the value turns up)
  await continueOn(page) // play-mutate (insert/delete playground)
  await answerArrays(page) // insert (predict the shift count)
  await answerArrays(page) // delete (predict the shift count)
  await rewireInOrder(page) // place-cheapest (drop the cell on the cheapest gap)
  await answerArrays(page) // realworld (spreadsheet row shift)
  await continueOn(page) // teach-grow (full block rejects a new cell)
  await answerArrays(page) // grow (pick the cleanest fix: double + copy)
  await continueOn(page) // grow-summary (average-cost teach) → completes the lesson

  await expect(page.getByText("You mastered Arrays.")).toBeVisible()

  // Linked Lists (12 beats): node-demo → teach → traverse (forced walk) →
  // rewire-insert → rewire-delete → predict → playlist synthesis →
  // contrast-insert → contrast-reach → doubly-demo → doubly-splice → doubly-walk.
  await nextLesson(page, /Continue to Linked Lists/)
  await continueOn(page) // node-demo
  await continueOn(page) // teach
  await walkTraverse(page) // traverse (forced hop-walk)
  await rewireByKeyboard(page) // rewire-insert (save-first, via the keyboard fallback)
  await rewireInOrder(page) // rewire-delete (bypass)
  await answerArrays(page) // predict-the-break (animated orphaning MCQ)
  await playlistSynthesis(page) // playlist (insert → delete → reorder)
  await contrastTwoStep(page) // array-vs-list insert (pick → why-MCQ)
  await contrastTwoStep(page) // array-vs-list reach (pick → why-MCQ)
  await continueOn(page) // doubly-demo (two-way sandbox)
  await doublySplice(page) // doubly-splice (4 ordered writes)
  await walkDoublyBackward(page) // doubly-walk (backward forced walk) → completes
  await expect(page.getByText("You mastered Linked Lists.")).toBeVisible()

  // Hash Tables (14 beats): abstract demo → interactive teach → hash-cat (drag) →
  // hash-cat-again (fresh key, tap) → hash-dog (drag) → teach-collision →
  // collide ×3 → hash-builder sandbox → hash-design → lookup-found → lookup-absent
  // → warehouse realworld.
  await nextLesson(page, /Continue to Hash Tables/)
  await continueOn(page) // demo (abstract two-scenario sandbox)
  await continueOn(page) // teach-hash (interactive HashBox)
  await hashDrag(page) // hash-cat → its bin
  await answerCell(page) // hash-cat-again (tap the computed bin)
  await hashDrag(page) // hash-dog → its bin
  await continueOn(page) // teach-collision (chaining)
  await answerArrays(page) // collide sun
  await answerArrays(page) // collide ant
  await answerArrays(page) // collide pig
  await continueOn(page) // hash-build-demo (rule + bucket sandbox)
  await hashDesign(page) // hash-design (pick a rule + bucket count that spreads)
  await answerCell(page) // lookup found (tap the computed bin; decoys + sealed)
  await answerCell(page) // lookup absent (tap the computed bin)
  await hashDrag(page) // warehouse realworld (stow in its bin)
  await expect(page.getByText("You mastered Hash Tables.")).toBeVisible()

  // Trees (16 beats): demo → teach-descend → find-hit/miss → insert →
  // watched-build → build-bst ×2 → find-big → teach-inorder → sequence ×3 →
  // realworld bracket → compare-shape → contrast-list.
  await nextLesson(page, /Continue to Trees/)
  await continueOn(page) // tree demo (free-play descend)
  await continueOn(page) // teach: compare & descend
  await treeDescend(page) // find-hit
  await treeDescend(page) // find-miss (falls off → ghost slot)
  await treeDescend(page) // insert (descend to the ghost slot)
  await continueOn(page) // watched-build (a BST grown key by key)
  await buildBst(page) // build-bst-1 (grow it yourself)
  await buildBst(page) // build-bst-2 (a different shape)
  await treeDescend(page) // find-big (deep path in a large tree)
  await continueOn(page) // teach: in-order
  await treeDescend(page) // sequence-a (frontier-gated in-order)
  await treeDescend(page) // sequence-b (zigzag)
  await treeDescend(page) // sequence-c (larger shape)
  await treeDescend(page) // realworld (tournament bracket)
  await answerArrays(page) // compare-shape (de-cued: balanced vs stick)
  await treeDescend(page) // contrast-list (walk the list, then descend)
  await expect(page.getByText("You mastered Trees.")).toBeVisible()

  // Heaps (16 beats): demo → teach-array → teach-rule → siftup ×2 (do-the-sift) →
  // watched-build → build-a-heap → teach-extract → siftdown ×2 → ER extract skin →
  // map-child → map-parent → contrast-place → contrast-samedata → ER synthesis.
  await nextLesson(page, /Continue to Heaps/)
  await continueOn(page) // demo (free-play insert sandbox)
  await continueOn(page) // teach: lives in an array
  await continueOn(page) // teach: the heap rule
  await doTheSift(page) // siftup-1 (perform the swaps up)
  await doTheSift(page) // siftup-2 (bigger heap)
  await continueOn(page) // watched-build (a heap built from nothing)
  await doTheSift(page) // build-a-heap (sift each inserted key)
  await continueOn(page) // teach: extract top (ER monitor)
  await doTheSift(page) // siftdown-1 (sink the new root)
  await doTheSift(page) // siftdown-2 (deeper)
  await doTheSift(page) // ER extract skin (discharge the most urgent)
  await answerHeapSlot(page) // map-child (tap the larger child's slot)
  await answerHeapSlot(page) // map-parent (tap the parent's slot)
  await answerArrays(page) // contrast: heap vs BST placement (arrangement card)
  await answerHeapSlot(page) // contrast: tree node ⇔ array cell
  await doTheSift(page) // ER synthesis (admit + discharge + re-triage) → completes
  await expect(page.getByText("You mastered Heaps.")).toBeVisible()

  // Graphs (14 beats): demo → teach → read-list → read-degree → trace near →
  // trace far → match-list → draw-demo → draw-edge → draw-transit →
  // build-the-line → redraw-demo → same-graph → tree-or-not.
  await nextLesson(page, /Continue to Graphs/)
  await continueOn(page) // demo (drag a node, the data does not move)
  await continueOn(page) // teach: adjacency is the data
  await tapNeighbors(page) // read connection list
  await tapNeighbors(page) // read degree
  await traceWalk(page, ["B", "D"]) // read-path trace (A → D)
  await traceWalk(page, ["C", "E", "F"]) // read-trace-far (A → F)
  await answerArrays(page) // which adjacency list matches? (MCQ)
  await continueOn(page) // draw-demo
  await drawGraphEdge(page) // draw the missing edge (B–D)
  await drawGraphEdge(page) // transit skin: route the missing track (C–D)
  await buildLine(page) // build-the-line (draw the missing tracks to the plan)
  await continueOn(page) // redraw-demo (same network, new layout)
  await answerArrays(page) // same graph? (classify)
  await answerArrays(page) // tree or graph? (classify)
  await expect(page.getByText("You mastered Graphs.")).toBeVisible()

  // Persisted + resumes: after a reload the signed-in learner lands on the
  // dashboard and resuming routes straight to a completed lesson.
  await page.reload()
  await page.getByRole("button", { name: "Continue learning" }).click()
  await expect(page.getByText("Lesson complete")).toBeVisible({ timeout: 30_000 })
})
