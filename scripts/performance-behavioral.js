const { chromium } = require("playwright");

const base = process.env.BASE_URL || "http://127.0.0.1:8001";

function check(condition, message, detail = "") {
  if (!condition) throw new Error(`${message}${detail ? `: ${detail}` : ""}`);
  console.log(`[PASS] ${message}${detail ? ` - ${detail}` : ""}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const apiRequests = [];
    let entryBytes = 0;
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("/api/")) apiRequests.push(new URL(url).pathname);
      if (/\/assets\/index-[^/]+\.js$/.test(url)) entryBytes = (await response.body()).byteLength;
    });

    const started = Date.now();
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.getByRole("link", { name: "Blog", exact: true }).waitFor();
    const interactiveMs = Date.now() - started;
    await page.waitForTimeout(1500);
    check(entryBytes > 0 && entryBytes < 300_000, "Public entry bundle remains below 300 KB", `${entryBytes} bytes`);
    check(interactiveMs < 5_000, "Header becomes interactive within 5 seconds", `${interactiveMs} ms`);

    await page.getByRole("link", { name: "Blog", exact: true }).click();
    await page.getByRole("heading", { name: "Archive" }).waitFor();
    await page.getByRole("link", { name: "About", exact: true }).click();
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.waitForTimeout(500);

    const postsRequests = apiRequests.filter((path) => path === "/api/posts").length;
    const settingsRequests = apiRequests.filter((path) => path === "/api/settings").length;
    check(postsRequests === 1, "Public navigation reuses the posts response", `${postsRequests} request; ${apiRequests.join(", ")}`);
    check(settingsRequests === 1, "Public navigation reuses the settings response", `${settingsRequests} request`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
