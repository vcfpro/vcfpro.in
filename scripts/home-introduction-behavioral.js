const { chromium } = require("playwright");

const base = process.env.BASE_URL || "https://vcfpro.in/?release=65d0337";
const sectionHeadings = ["Why I Created vcfpro.in", "How This Blog Will Help VCF Admins and Consultants"];
const leadIns = ["Real-World Troubleshooting:", "Deployment & Migration Guidance:", "Operational Best Practices:", "Time-Saving Tips:"];

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
    const description = page.locator(".home-description");
    await description.waitFor();

    for (const heading of sectionHeadings) {
      const element = description.getByRole("heading", { name: heading, exact: true });
      check(await element.count() === 1, `${heading} renders as a heading`);
      check(Number(await element.evaluate((node) => getComputedStyle(node).fontWeight)) >= 700, `${heading} is bold`);
    }

    for (const label of leadIns) {
      const element = description.locator("strong", { hasText: label });
      check(await element.count() === 1, `${label} renders as a highlighted lead-in`);
      check(Number(await element.evaluate((node) => getComputedStyle(node).fontWeight)) >= 700, `${label} is bold`);
    }

    const opacity = Number(await description.evaluate((node) => getComputedStyle(node).opacity));
    check(opacity === 1, "Introduction no longer uses the dull 60% container opacity");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
