const base = process.env.BASE_URL || "http://127.0.0.1:8001";

function check(condition, message, detail = "") {
  if (!condition) throw new Error(`${message}${detail ? `: ${detail}` : ""}`);
  console.log(`[PASS] ${message}${detail ? ` - ${detail}` : ""}`);
}

(async () => {
  const [fullResponse, summaryResponse] = await Promise.all([
    fetch(`${base}/api/posts?summary=0`),
    fetch(`${base}/api/posts?summary=1`),
  ]);
  check(fullResponse.ok, "Full posts endpoint responds", `${fullResponse.status}`);
  check(summaryResponse.ok, "Summary posts endpoint responds", `${summaryResponse.status}`);

  const fullText = await fullResponse.text();
  const summaryText = await summaryResponse.text();
  const summaries = JSON.parse(summaryText);
  check(summaryText.length < fullText.length * 0.25, "Summary payload is at least 75% smaller", `${summaryText.length} vs ${fullText.length} bytes`);
  check(summaries.length > 0, "Summary endpoint returns posts", `${summaries.length} posts`);
  check(summaries.every((post) => post.content === ""), "Summary endpoint omits article bodies");

  const detailResponse = await fetch(`${base}/api/posts/slug/${encodeURIComponent(summaries[0].slug)}`);
  const detail = await detailResponse.json();
  check(detailResponse.ok && detail.content.length > 0, "Post detail retains full article content", `${detail.content.length} characters`);
})().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
