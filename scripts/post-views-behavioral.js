const { chromium } = require("playwright");

const base = process.env.BASE_URL || "https://vcfpro.in";
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

async function dashboard(token) {
  const response = await fetch(`${base}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(response.ok, "Admin dashboard API responds");
  return response.json();
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
  const before = await dashboard(token);
  const post = before.posts.find((item) => item.status === "published");
  check(Boolean(post), "A published article is available for the view test");
  const initialViews = Number(post.views || 0);

  const browser = await chromium.launch({ headless: true });
  try {
    const publicPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const firstView = publicPage.waitForResponse(
      (response) => response.url().endsWith(`/api/posts/${post.id}/view`) && response.request().method() === "POST",
    );
    await publicPage.goto(`${base}/post/${post.slug}?release=429cd6e`, { waitUntil: "domcontentloaded", timeout: 60000 });
    check((await firstView).ok(), "Opening an article records a view");

    await publicPage.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await publicPage.waitForTimeout(2500);
    const after = await dashboard(token);
    const updated = after.posts.find((item) => item.id === post.id);
    check(Number(updated.views) === initialViews + 1, "Reloading in the same browser session does not add another view");

    const adminPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await adminPage.addInitScript((value) => localStorage.setItem("admin_token", value), token);
    await adminPage.goto(`${base}/admin?release=429cd6e`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await adminPage.getByRole("columnheader", { name: "Views" }).waitFor();
    const row = adminPage.getByRole("row").filter({ hasText: post.title });
    const displayedViews = Number((await row.getByRole("cell").nth(2).innerText()).replace(/[^\d]/g, ""));
    check(displayedViews >= initialViews + 1, "Admin dashboard displays the article view count");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
