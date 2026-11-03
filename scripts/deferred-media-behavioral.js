const { chromium } = require("playwright");

const base = process.env.BASE_URL || "https://vcfpro.in/?release=d609812";
const apiOrigin = process.env.API_ORIGIN;
const remoteVideoHosts = ["pexels.com", "videotourl.com"];
const optimizedVideos = ["/media/experience-background.mp4", "/media/explore-background.mp4", "/media/software-background.mp4"];
const optimizedPosters = ["/media/experience-background.webp", "/media/explore-background.webp", "/media/software-background.webp"];

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

async function proxyApi(page) {
  if (!apiOrigin) return;

  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const response = await route.fetch({ url: `${apiOrigin}${requestUrl.pathname}${requestUrl.search}` });
    await route.fulfill({ response });
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await proxyApi(mobile);
    const mobileVideoRequests = [];
    mobile.on("request", (request) => {
      if (request.resourceType() === "media") mobileVideoRequests.push(request.url());
    });
    await mobile.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
    await mobile.getByRole("heading", { level: 1 }).waitFor();
    await mobile.waitForTimeout(2000);
    check(mobileVideoRequests.length <= 1, "Mobile initial load does not download distant background videos");
    await mobile.close();

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await proxyApi(desktop);
    const desktopVideoRequests = [];
    const desktopPosterRequests = [];
    desktop.on("request", (request) => {
      if (request.resourceType() === "media") {
        desktopVideoRequests.push({ url: request.url(), time: Date.now() });
      }
      if (optimizedPosters.some((path) => request.url().includes(path))) desktopPosterRequests.push(request.url());
    });
    await desktop.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
    await desktop.getByRole("heading", { level: 1 }).waitFor();
    const contentReadyAt = Date.now();
    await desktop.waitForTimeout(1000);
    await desktop.locator("video").last().scrollIntoViewIfNeeded();
    const softwareCardRevealedAt = Date.now();
    await desktop.waitForTimeout(1500);
    const optimizedRequests = desktopVideoRequests.filter(({ url }) => optimizedVideos.some((path) => url.includes(path)));
    check(desktopPosterRequests.length === 3, "All local poster images are requested independently of video playback");
    check(optimizedRequests.length === 3, "Visible desktop cards request all optimized local videos");
    const experienceRequest = optimizedRequests.find(({ url }) => url.includes("experience-background.mp4"));
    const softwareRequest = optimizedRequests.find(({ url }) => url.includes("software-background.mp4"));
    check(experienceRequest.time - contentReadyAt < 1000, "Initially visible experience video starts promptly");
    check(softwareRequest.time - softwareCardRevealedAt < 1000, "Software video starts promptly when its card approaches the viewport");
    check(desktopVideoRequests.every(({ url }) => !remoteVideoHosts.some((host) => url.includes(host))), "Replaced videos are not downloaded from third-party hosts");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
