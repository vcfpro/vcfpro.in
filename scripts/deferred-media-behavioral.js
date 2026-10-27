const { chromium } = require("playwright");

const base = process.env.BASE_URL || "https://vcfpro.in/?release=d609812";
const videoHosts = ["pexels.com", "videotourl.com"];

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileVideoRequests = [];
    mobile.on("request", (request) => {
      if (videoHosts.some((host) => request.url().includes(host))) mobileVideoRequests.push(request.url());
    });
    await mobile.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
    await mobile.getByRole("heading", { level: 1 }).waitFor();
    await mobile.waitForTimeout(2000);
    check(mobileVideoRequests.length === 0, "Mobile initial load does not download off-screen background videos");
    await mobile.close();

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const desktopVideoRequestTimes = [];
    desktop.on("request", (request) => {
      if (videoHosts.some((host) => request.url().includes(host))) {
        desktopVideoRequestTimes.push(Date.now());
      }
    });
    await desktop.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
    await desktop.getByRole("heading", { level: 1 }).waitFor();
    const contentReadyAt = Date.now();
    await desktop.waitForTimeout(3200);
    const desktopVideoStarts = desktopVideoRequestTimes.map((time) => time - contentReadyAt);
    check(desktopVideoStarts.every((start) => start >= 400), "Desktop background media waits until after primary content renders");
    const roundedStarts = [...new Set(desktopVideoStarts.map((start) => Math.round(start / 500) * 500))];
    check(roundedStarts.length === desktopVideoStarts.length, "Visible desktop videos start in separate staggered windows");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
