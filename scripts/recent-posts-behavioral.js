const { chromium } = require("playwright");

const base = process.env.BASE_URL || "https://vcfpro.in/?release=232d0c6";

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });

      const heading = page.getByText("Recently Published", { exact: true });
      await heading.waitFor();
      const panel = heading.locator("xpath=ancestor::div[contains(@class, 'glass-panel')]");
      const posts = panel.locator('a[href^="/post/"]');
      const count = await posts.count();
      const dimensions = await panel.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));

      check(count === 5, `${name} Recently Published panel shows five articles`);
      check(dimensions.scrollHeight <= dimensions.clientHeight + 2, `${name} Recently Published panel does not clip its content`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
