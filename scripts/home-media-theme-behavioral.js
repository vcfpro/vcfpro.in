const { chromium } = require("playwright");

const base = process.env.BASE_URL || "http://127.0.0.1:8001";

function check(condition, message, detail = "") {
  if (!condition) throw new Error(`${message}${detail ? `: ${detail}` : ""}`);
  console.log(`[PASS] ${message}${detail ? ` - ${detail}` : ""}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.locator(".home-tile-media").first().waitFor();

    const darkStyles = await page.locator(".home-tile-media").evaluateAll((items) =>
      items.map((item) => ({ blend: getComputedStyle(item).mixBlendMode, opacity: getComputedStyle(item).opacity })),
    );
    check(darkStyles.every(({ blend }) => blend === "screen"), "Dark-mode tile media retains screen blending", JSON.stringify(darkStyles));

    await page.getByTitle("Switch to Light Mode").click();
    const lightStyles = await page.locator(".home-tile-media").evaluateAll((items) =>
      items.map((item) => ({ blend: getComputedStyle(item).mixBlendMode, opacity: getComputedStyle(item).opacity })),
    );
    check(lightStyles.every(({ blend }) => blend === "normal"), "Light-mode tile media avoids washout blending", JSON.stringify(lightStyles));
    check(lightStyles.every(({ opacity }) => Number(opacity) >= 0.9), "Light-mode tile media remains clearly visible");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
