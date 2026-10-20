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
    if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
      await page.locator('input[type="text"]').fill(process.env.ADMIN_USERNAME);
      await page.locator('input[type="password"]').fill(process.env.ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Access Dashboard" }).click();
      await page.waitForURL(/\/admin$/);
      const sidebarLogo = page.getByRole("img", { name: "VCF PRO" });
      await sidebarLogo.waitFor();
      check((await sidebarLogo.getAttribute("src")) === "/logoo.jpg", "Authenticated admin sidebar uses the current VCF Pro logo");
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
