const { chromium } = require("playwright");

const base = process.env.BASE_URL || "http://127.0.0.1:8001";

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      await page.goto(base, { waitUntil: "domcontentloaded" });
      if (width < 640) check(!(await page.locator("nav button[aria-haspopup='dialog']").isVisible()), "Desktop search is hidden on mobile");
      if (width < 640) await page.locator("nav button:has(svg.lucide-menu)").click();
      await page.getByRole("button", { name: "Search", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Search posts" });
      await dialog.waitFor();
      check(await dialog.isVisible(), `Search opens at ${width}px`);
      const input = dialog.getByRole("searchbox", { name: "Search posts" });
      await input.fill("ESXi");
      await dialog.getByRole("link").first().waitFor();
      check((await dialog.getByRole("link").count()) > 0, `Matching posts appear at ${width}px`);
      await input.fill("not-a-real-post-987654");
      await dialog.getByText(/No articles found/).waitFor();
      check(true, `Empty-result message appears at ${width}px`);
      await page.keyboard.press("Escape");
      check((await dialog.count()) === 0, `Escape closes search at ${width}px`);
      if (width < 640) await page.locator("nav button:has(svg.lucide-menu)").click();
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.getByRole("dialog", { name: "Search posts" }).getByRole("searchbox").fill("ESXi");
      await page.getByRole("dialog", { name: "Search posts" }).getByRole("link").first().click();
      await page.waitForURL(/\/post\//);
      check(page.url().includes("/post/"), `Result opens its article at ${width}px`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
