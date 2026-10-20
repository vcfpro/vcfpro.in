const { chromium } = require("playwright");

const base = process.env.BASE_URL || "http://127.0.0.1:4174";

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    await page.goto(`${base}/admin/login`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const logo = page.getByRole("img", { name: "VCF PRO" });
    await logo.waitFor();
    check((await logo.getAttribute("src")) === "/logoo.jpg", "Admin login uses the current VCF Pro logo");
    check((await page.title()) === "VCF Pro", "Admin browser tab keeps the VCF Pro title");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
