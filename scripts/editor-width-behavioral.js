const { chromium } = require("playwright");

const base = process.env.BASE_URL || "http://127.0.0.1:8001";
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

function check(condition, message, detail = "") {
  if (!condition) throw new Error(`${message}${detail ? `: ${detail}` : ""}`);
  console.log(`[PASS] ${message}${detail ? ` - ${detail}` : ""}`);
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
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1024, 1440, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript((value) => localStorage.setItem("admin_token", value), token);
      const page = await context.newPage();
      await page.goto(`${base}/admin/post/new`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      const editor = page.locator(".tiptap-editor");
      await editor.waitFor({ timeout: 45_000 }).catch(() => { throw new Error(`Editor did not load at ${width}px; current URL: ${page.url()}`); });
      const box = await editor.boundingBox();
      check(box && box.width >= 620, `Editor is wide at ${width}px`, `${Math.round(box?.width || 0)}px`);
      check(box && box.height >= 640, `Editor writing area is tall at ${width}px`, `${Math.round(box?.height || 0)}px`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
