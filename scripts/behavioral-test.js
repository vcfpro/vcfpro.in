// PART 5 behavioural parity test: confirms the ORIGINAL bundle (:8000) and
// the rebuilt frontend (:8001) behave identically for the post page's
// interactive features, not just look identical in a screenshot. Both
// servers share the same local-dev database (see local-dev/README.md and
// scripts/seed-local-comments.php), so actions taken against one are
// visible to the other - this script relies on that deliberately, the same
// way the seeding step in PART 1 did.
//
// Plain Playwright script (not @playwright/test), matching the existing
// convention in scripts/parity-capture.js. Exits 0 if every check passes,
// 1 otherwise, printing a PASS/FAIL line per check.
const { chromium } = require("playwright");

const OLD_BASE = "http://localhost:8000";
const NEW_BASE = "http://localhost:8001";
const ROUTE = "/post/fixing-the-no-healthy-stream-certificate-error-in-vcenter-vcf-5-x";
const OWNED_AUTHOR_KEY = "e2e-test-owner-key"; // seeded in scripts/seed-local-comments.php
const OWNED_COMMENT_TEXT = "This is my own comment, used to test the edit/delete-if-owned behaviour.";
const TEST_AUTHOR_KEY = "pw-behavioral-test-key";
const TEST_COMMENT_NAME = "PW Behavioral Test";
const TEST_COMMENT_TEXT = "Testing comment posting behavioural parity between old and new.";
const TEST_COMMENT_TEXT_EDITED = "Testing comment posting behavioural parity between old and new (edited).";

const results = [];
function check(label, passed, detail) {
  results.push({ label, passed, detail });
  console.log(`[${passed ? "PASS" : "FAIL"}] ${label}${detail ? " - " + detail : ""}`);
}

async function withAuthorKey(browser, key) {
  const context = await browser.newContext();
  await context.addInitScript((k) => {
    window.localStorage.setItem("vcf_my_author_key", k);
  }, key);
  return context;
}

async function gotoPost(context, base) {
  const page = await context.newPage();
  await page.goto(base + ROUTE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return page;
}

async function getUpvoteState(page) {
  const button = page.getByRole("button", { name: /Upvote/ });
  const text = await button.textContent();
  const count = parseInt(text.match(/\((\d+)\)/)[1], 10);
  const disabled = await button.isDisabled();
  return { button, count, disabled };
}

// --- Test 1: like/vote behaviour parity ---
async function testLikeBehaviour(browser, base, label) {
  const context = await browser.newContext();
  const page = await gotoPost(context, base);

  const before = await getUpvoteState(page);
  check(`${label}: Upvote button starts enabled`, before.disabled === false, `count=${before.count}`);

  // Wait for the actual /like response rather than a fixed sleep - the
  // shared local-dev PHP dev server is single-threaded (see
  // scripts/parity-capture.js) and can queue behind other in-flight
  // requests, making a fixed short timeout flaky under load.
  const likeResponse = page.waitForResponse((r) => /\/posts\/\d+\/like$/.test(r.url()), { timeout: 15000 });
  await before.button.click();
  await likeResponse;
  await page.waitForTimeout(300);
  const afterFirstClick = await getUpvoteState(page);
  check(
    `${label}: first click increments count by 1`,
    afterFirstClick.count === before.count + 1,
    `${before.count} -> ${afterFirstClick.count}`,
  );
  check(`${label}: button becomes disabled after voting`, afterFirstClick.disabled === true);

  // Second click while still disabled must not change anything (button is
  // disabled, so Playwright's click would throw if we didn't force it -
  // force-clicking simulates "what if a user bypassed the disabled state",
  // matching the ORIGINAL's own lack of a persistent lock: only the
  // in-memory `disabled` prop is what stops a normal click).
  await afterFirstClick.button.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  const afterSecondClick = await getUpvoteState(page);
  check(
    `${label}: second click blocked (count unchanged)`,
    afterSecondClick.count === afterFirstClick.count,
    `count stayed ${afterSecondClick.count}`,
  );

  // Confirmed in PART 2/3: there is NO persistent (localStorage) vote lock
  // in the original - reloading re-enables the button. Reproduced
  // faithfully, so the same must be true here.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const afterReload = await getUpvoteState(page);
  check(
    `${label}: button re-enabled after reload (no persistent lock)`,
    afterReload.disabled === false,
    `count persisted at ${afterReload.count}`,
  );
  check(
    `${label}: vote count persisted across reload`,
    afterReload.count === afterFirstClick.count,
  );

  await context.close();
  return afterReload.count;
}

// --- Test 2: posting a comment - same DOM shape on both ---
async function postTestComment(browser, base, label) {
  const context = await withAuthorKey(browser, TEST_AUTHOR_KEY);
  const page = await gotoPost(context, base);

  await page.getByPlaceholder("E.g. Guest Reader").fill(TEST_COMMENT_NAME);
  const editor = page.locator("form").filter({ hasText: "Post Comment" }).locator("[contenteditable]");
  await editor.click();
  await editor.type(TEST_COMMENT_TEXT);
  await page.getByRole("button", { name: "Post Comment" }).click();
  await page.waitForTimeout(1500);

  const card = page.locator(".comment-content-html", { hasText: TEST_COMMENT_TEXT }).first();
  const appeared = await card.count();
  check(`${label}: posted comment appears in the list`, appeared > 0);

  await context.close();
}

function cardWithText(page, text) {
  // Comment cards are a "flex gap-4" (top-level) or "flex gap-3" (reply) row
  // (see CommentItem.tsx) - a stable structural selector, unlike
  // ".comment-content-html" which only exists in the non-edit-mode view and
  // disappears (replaced by the edit form) once Edit is clicked.
  return page.locator(".flex.gap-4, .flex.gap-3").filter({ hasText: text }).first();
}

async function captureCommentShape(browser, base, label) {
  const context = await withAuthorKey(browser, TEST_AUTHOR_KEY);
  const page = await gotoPost(context, base);

  const card = cardWithText(page, TEST_COMMENT_NAME);

  const shape = await card.evaluate((el) => {
    const nameEl = el.querySelector("span.font-semibold");
    const hasEditBtn = Array.from(el.querySelectorAll("button")).some((b) => b.textContent.includes("Edit"));
    const hasDeleteBtn = Array.from(el.querySelectorAll("button")).some((b) => b.textContent.includes("Delete"));
    return {
      authorName: nameEl ? nameEl.textContent : null,
      hasEditButton: hasEditBtn,
      hasDeleteButton: hasDeleteBtn,
      roleBadgeText: el.querySelector(".uppercase.tracking-wider")?.textContent || null,
    };
  });

  await context.close();
  return shape;
}

// --- Test 3: edit an owned comment - same result on both ---
async function testEditBehaviour(browser, base, label) {
  const context = await withAuthorKey(browser, TEST_AUTHOR_KEY);
  const page = await gotoPost(context, base);

  const card = cardWithText(page, TEST_COMMENT_NAME);
  const editBtn = card.getByRole("button", { name: "Edit" });
  const editVisible = await editBtn.isVisible().catch(() => false);
  check(`${label}: Edit button visible for own comment`, editVisible);
  if (!editVisible) return;

  await editBtn.click();
  await page.waitForTimeout(300);
  const editEditor = card.locator("[contenteditable]");
  await editEditor.click();
  await page.keyboard.press("Control+A");
  await editEditor.type(TEST_COMMENT_TEXT_EDITED);
  await card.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(1000);

  const updated = page.locator(".comment-content-html", { hasText: TEST_COMMENT_TEXT_EDITED });
  check(`${label}: edited content shows after save`, (await updated.count()) > 0);

  await context.close();
}

// --- Test 4: reload -> seeded owned comment still shows as owned ---
async function testOwnershipPersistence(browser, base, label) {
  const context = await withAuthorKey(browser, OWNED_AUTHOR_KEY);
  const page = await gotoPost(context, base);

  const contentDiv = page.locator(".comment-content-html", { hasText: OWNED_COMMENT_TEXT }).first();
  const card = contentDiv.locator("xpath=ancestor::div[contains(@class,'rounded-2xl') or contains(@class,'rounded-xl')][1]");
  const hasEdit = await card.getByRole("button", { name: "Edit" }).isVisible().catch(() => false);
  const hasDelete = await card.getByRole("button", { name: "Delete" }).isVisible().catch(() => false);
  check(`${label}: seeded owned comment shows Edit`, hasEdit);
  check(`${label}: seeded owned comment shows Delete`, hasDelete);

  await context.close();
}

// --- Cleanup: delete the comment this test posted ---
// --- Test 5: contact form (homepage) - valid / empty / over-200-words ---
async function gotoHome(context, base) {
  const page = await context.newPage();
  // Block the real formsubmit.co forwarding call (see Home.tsx comment) -
  // the component code itself is untouched and still fires the real
  // fetch(), this just stops it leaving the test environment and hitting
  // a live third-party service tied to the real site owner's email.
  await page.route("https://formsubmit.co/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' }));
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return page;
}

async function testContactFormEmpty(browser, base, label) {
  const context = await browser.newContext();
  const page = await gotoHome(context, base);

  let apiCalled = false;
  page.on("request", (req) => {
    if (req.url().includes("/api/contact")) apiCalled = true;
  });

  const submitBtn = page.getByRole("button", { name: /Send Message/i });
  await submitBtn.click();
  await page.waitForTimeout(1000);

  check(`${label}: empty submission blocked client-side (no /api/contact call)`, !apiCalled);

  await context.close();
}

async function testContactFormWordLimit(browser, base, label) {
  const context = await browser.newContext();
  const page = await gotoHome(context, base);

  const textarea = page.locator("textarea");
  await textarea.click();
  const words = Array.from({ length: 205 }, () => "word").join(" ");
  await textarea.type(words, { delay: 0 });
  await page.waitForTimeout(300);

  const value = await textarea.inputValue();
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  check(`${label}: typing 205 words truncates to 200`, wordCount === 200, `actual=${wordCount}`);

  const counterText = await page.evaluate(() => {
    const span = document.querySelector("textarea")?.parentElement?.querySelector("span");
    return span ? span.textContent : null;
  });
  check(`${label}: word counter shows 200`, counterText === "200", `counter="${counterText}"`);

  await context.close();
}

async function testContactFormValidSubmit(browser, base, label) {
  const context = await browser.newContext();
  const page = await gotoHome(context, base);

  let apiStatus = null;
  page.on("response", (res) => {
    if (res.url().includes("/api/contact")) apiStatus = res.status();
  });

  await page.locator('input[type="email"]').fill(`behavioral-test-${label.toLowerCase()}@example.com`);
  await page.locator("textarea").fill("Behavioural test message - confirming identical contact form submission handling.");
  await page.getByRole("button", { name: /Send Message/i }).click();
  await page.waitForTimeout(2000);

  check(`${label}: valid submission returns 200 from /api/contact`, apiStatus === 200, `status=${apiStatus}`);

  const successText = await page.evaluate(() => document.querySelector("form button[type=submit]")?.textContent || "");
  check(`${label}: success state shows "Message Sent! ✓"`, successText.includes("Message Sent"), `text="${successText}"`);

  const emailDisabled = await page.locator('input[type="email"]').isDisabled();
  const emailValue = await page.locator('input[type="email"]').inputValue();
  check(`${label}: email field disabled and cleared after send`, emailDisabled && emailValue === "");

  // Confirmed from source: setTimeout(() => setStatus("idle"), 3000) - the
  // success state is not permanent, it resets after 3s.
  await page.waitForTimeout(3200);
  const resetText = await page.evaluate(() => document.querySelector("form button[type=submit]")?.textContent || "");
  check(`${label}: form resets to idle 3s after success`, resetText.includes("Send Message"), `text="${resetText}"`);

  await context.close();
}

async function cleanupTestComment(browser, base) {
  const context = await withAuthorKey(browser, TEST_AUTHOR_KEY);
  const page = await gotoPost(context, base);
  const contentDiv = page.locator(".comment-content-html", { hasText: TEST_COMMENT_TEXT_EDITED }).first();
  const exists = await contentDiv.count();
  if (exists > 0) {
    const card = contentDiv.locator("xpath=ancestor::div[contains(@class,'rounded-2xl') or contains(@class,'rounded-xl')][1]");
    const deleteBtn = card.getByRole("button", { name: "Delete" });
    if (await deleteBtn.isVisible().catch(() => false)) {
      page.on("dialog", (d) => d.accept());
      await deleteBtn.click();
      await page.waitForTimeout(1000);
    }
  }
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  console.log("\n=== Test 1: Like/vote behaviour parity ===");
  await testLikeBehaviour(browser, OLD_BASE, "OLD");
  await testLikeBehaviour(browser, NEW_BASE, "NEW");

  console.log("\n=== Test 2: Posting a comment - same DOM shape on both ===");
  await postTestComment(browser, OLD_BASE, "OLD");
  const oldShape = await captureCommentShape(browser, OLD_BASE, "OLD");
  const newShape = await captureCommentShape(browser, NEW_BASE, "NEW");
  check(
    "Comment DOM shape matches between old and new (author name)",
    oldShape.authorName === newShape.authorName,
    `OLD="${oldShape.authorName}" NEW="${newShape.authorName}"`,
  );
  check(
    "Comment DOM shape matches between old and new (role badge)",
    oldShape.roleBadgeText === newShape.roleBadgeText,
    `OLD="${oldShape.roleBadgeText}" NEW="${newShape.roleBadgeText}"`,
  );
  check(
    "Comment DOM shape matches between old and new (Edit button present)",
    oldShape.hasEditButton === newShape.hasEditButton,
  );
  check(
    "Comment DOM shape matches between old and new (Delete button present)",
    oldShape.hasDeleteButton === newShape.hasDeleteButton,
  );

  console.log("\n=== Test 3: Edit an owned comment ===");
  await testEditBehaviour(browser, OLD_BASE, "OLD");
  await testEditBehaviour(browser, NEW_BASE, "NEW");

  console.log("\n=== Test 4: Reload -> seeded owned comment still shows as owned ===");
  await testOwnershipPersistence(browser, OLD_BASE, "OLD");
  await testOwnershipPersistence(browser, NEW_BASE, "NEW");

  console.log("\n=== Cleanup: removing the test comment this run posted ===");
  await cleanupTestComment(browser, OLD_BASE);

  console.log("\n=== Test 5: Contact form (homepage) - empty submission blocked ===");
  await testContactFormEmpty(browser, OLD_BASE, "OLD");
  await testContactFormEmpty(browser, NEW_BASE, "NEW");

  console.log("\n=== Test 6: Contact form - over-200-words truncation ===");
  await testContactFormWordLimit(browser, OLD_BASE, "OLD");
  await testContactFormWordLimit(browser, NEW_BASE, "NEW");

  console.log("\n=== Test 7: Contact form - valid submission and success state ===");
  await testContactFormValidSubmit(browser, OLD_BASE, "OLD");
  await testContactFormValidSubmit(browser, NEW_BASE, "NEW");

  await browser.close();

  console.log("\n=== Summary ===");
  const failed = results.filter((r) => !r.passed);
  console.log(`${results.length - failed.length} / ${results.length} checks passed`);
  if (failed.length > 0) {
    console.log("Failed checks:");
    failed.forEach((f) => console.log(`  - ${f.label}${f.detail ? " (" + f.detail + ")" : ""}`));
  }
  process.exit(failed.length > 0 ? 1 : 0);
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
