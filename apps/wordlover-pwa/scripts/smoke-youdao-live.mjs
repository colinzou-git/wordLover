const terms = ["charge", "isosceles"];
const timeoutMs = 8000;

for (const term of terms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://m.youdao.com/dict?le=eng&q=${encodeURIComponent(term)}`;
    const response = await fetch(url, {
      headers: { "user-agent": "WordFan-Youdao-PR-Smoke/1.0" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${term}: HTTP ${response.status}`);
    const html = await response.text();
    const hasHeadword = html.toLowerCase().includes(term);
    const hasBasicEntryMarker = /基本释义|英汉|base-trans|wordbook-js/i.test(html);
    if (!hasHeadword || !hasBasicEntryMarker) {
      throw new Error(`${term}: public entry did not contain the expected headword/basic-entry marker`);
    }
    console.log(`${term}: reachable (${response.status})`);
  } finally {
    clearTimeout(timer);
  }
}
