const claimPattern = /\b(?:promotions?|giveaways?|discounts?|cashback|free (?:trial|subscription|upgrade)|for free|limited.time offer|(?:announces?|announced|launches|launched)\b|investment (?:opportunit(?:y|ies)|scheme)|invest (?:in|now)|guaranteed returns?|\d+%\s*(?:off|returns?))\b/i;
const websitePattern = /\b(?:https?:\/\/|www\.)[^\s<>]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|my|io|xyz|top|online|site|shop)\b(?:[/?#][^\s<>]*)?/gi;

function buildSearchQuery(text) {
  const hosts = [];
  const clean = String(text || "")
    .replace(/\S+@\S+/g, " ")
    .replace(websitePattern, (value) => {
      try {
        const url = new URL(/^https?:/i.test(value) ? value : "https://" + value);
        hosts.push(url.hostname.replace(/\.$/, ""));
      } catch { /* Ignore malformed links. */ }
      return " ";
    })
    .replace(/\+?\d[\d ()-]{5,}\d/g, " ")
    .replace(/\s+/g, " ").trim();
  const claim = claimPattern.exec(clean);
  if (!claim) return hosts.length ? hosts[0] + " website legitimacy" : null;
  const before = clean.slice(0, claim.index).trim().split(" ").slice(-7);
  const after = clean.slice(claim.index).split(" ").slice(0, 12);
  return [...before, ...after, hosts[0] || ""].join(" ").trim().slice(0, 220);
}

async function searchClaim(text) {
  const query = buildSearchQuery(text);
  if (!query) return null;
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, search_depth: "basic", max_results: 3 }),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return [];
    const { results } = await response.json();
    return results.filter(r => /^https?:\/\//i.test(r?.url) && typeof r.content === "string" && r.content.trim())
      .slice(0, 3).map((r, i) => ({
        id: i + 1, url: r.url, title: String(r.title || "").slice(0, 180),
        summary: r.content.slice(0, 700),
      }));
  } catch {
    return [];
  }
}

module.exports = { searchClaim };
