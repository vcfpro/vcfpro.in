const { chromium } = require("playwright");

const base = process.env.BASE_URL || "http://127.0.0.1:8001";
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const fallbackOrder = ["accolades", "timeline", "software", "philosophy", "blogs", "contact", "stats"];

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

async function saveOrder(token, order) {
  const response = await fetch(`${base}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ homepageTileOrder: order }),
  });
  check(response.ok, "Layout restore request succeeds");
}

(async () => {
  if (!username || !password) throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD for this test");
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  check(login.ok, "Admin authentication succeeds");
  const { token } = await login.json();
  const originalSettings = await (await fetch(`${base}/api/settings`)).json();
  const originalOrder = originalSettings.homepageTileOrder || fallbackOrder;
  const browser = await chromium.launch({ headless: true });

  try {
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminContext.addInitScript((value) => localStorage.setItem("admin_token", value), token);
    const adminPage = await adminContext.newPage();
    await adminPage.goto(base, { waitUntil: "domcontentloaded" });
    await adminPage.getByTitle("Move Right").first().waitFor();
    const saved = adminPage.waitForResponse((response) => response.url().endsWith("/api/settings") && response.request().method() === "POST");
    await adminPage.getByTitle("Move Right").first().click({ force: true });
    check((await saved).ok(), "Tile move is saved to the server");

    const expectedOrder = [...originalOrder];
    const timelineIndex = expectedOrder.indexOf("timeline");
    [expectedOrder[timelineIndex], expectedOrder[timelineIndex + 1]] = [expectedOrder[timelineIndex + 1], expectedOrder[timelineIndex]];
    const visitorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(base, { waitUntil: "domcontentloaded" });
    await visitorPage.getByText("Professional Experience", { exact: false }).first().waitFor();
    const timelineTile = visitorPage.locator("div.group").filter({ hasText: "Professional Experience" }).first();
    const displayedOrder = await timelineTile.evaluate((element) => Number(element.style.order));
    check(displayedOrder === expectedOrder.indexOf("timeline"), `A separate browser receives the saved tile order (expected ${expectedOrder.indexOf("timeline")}, got ${displayedOrder})`);
  } finally {
    await saveOrder(token, originalOrder);
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
