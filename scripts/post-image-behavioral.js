const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://127.0.0.1:8001";

function assert(condition, message, detail = "") {
  if (!condition) throw new Error(`${message}${detail ? `: ${detail}` : ""}`);
  console.log(`[PASS] ${message}${detail ? ` - ${detail}` : ""}`);
}

async function openPost(page, slug) {
  await page.goto(`${BASE}/post/${slug}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator("article").waitFor({ state: "visible" });
}

(async () => {
  const response = await fetch(`${BASE}/api/posts`);
  const posts = await response.json();
  const withoutImage = posts.find((post) => post.status === "published" && !post.featured_image);
  const withImage = posts.find((post) => post.status === "published" && post.featured_image);
  assert(Boolean(withoutImage), "Fixture includes a published post without a featured image");
  assert(Boolean(withImage), "Fixture includes a published post with a featured image");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await openPost(page, withoutImage.slug);
  assert((await page.locator("article > figure").count()) === 0, "No blank featured-image area is rendered");

  await openPost(page, withImage.slug);
  const bounds = await page.locator("article").evaluate((article) => {
    const articleBox = article.getBoundingClientRect();
    const imageBox = article.querySelector("figure img").getBoundingClientRect();
    return { articleLeft: articleBox.left, articleRight: articleBox.right, imageLeft: imageBox.left, imageRight: imageBox.right };
  });
  assert(bounds.imageLeft >= bounds.articleLeft && bounds.imageRight <= bounds.articleRight, "Featured image stays inside the article", JSON.stringify(bounds));

  const featuredSrc = await page.locator("figure img").getAttribute("src");
  const bodyBounds = await page.locator(".article-prose").evaluate(async (container, src) => {
    const image = document.createElement("img");
    image.src = src;
    image.style.width = "5000px";
    container.append(image);
    await image.decode();
    const containerBox = container.getBoundingClientRect();
    const imageBox = image.getBoundingClientRect();
    return { containerWidth: containerBox.width, imageWidth: imageBox.width, imageLeft: imageBox.left, containerLeft: containerBox.left, imageRight: imageBox.right, containerRight: containerBox.right };
  }, featuredSrc);
  assert(bodyBounds.imageWidth > 0 && bodyBounds.imageWidth <= bodyBounds.containerWidth && bodyBounds.imageLeft >= bodyBounds.containerLeft && bodyBounds.imageRight <= bodyBounds.containerRight, "Oversized in-body image stays inside article content", JSON.stringify(bodyBounds));

  await browser.close();
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
