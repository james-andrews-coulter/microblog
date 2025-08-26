import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SITE_URL = "https://blog.jamesandrewscoulter.com";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "..", "data", "webmentions");

const ensureDir = (dir) =>
  fs.existsSync(dir) || fs.mkdirSync(dir, { recursive: true });
ensureDir(CACHE_DIR);

const toFileName = (url) => Buffer.from(url).toString("base64url") + ".json";

const normalize = (u) => {
  try {
    const x = new URL(u);
    x.hash = ""; // drop only the fragment
    return x.toString(); // keep the trailing slash as-is
  } catch {
    return u;
  }
};

const withSlash = (u) => (u.endsWith("/") ? u : u + "/");
const withoutSlash = (u) => (u.endsWith("/") ? u.slice(0, -1) : u);

async function getSitemapUrls() {
  const res = await fetch(new URL("/sitemap.xml", SITE_URL));
  if (!res.ok)
    throw new Error(`Couldn't load sitemap: ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) =>
    m[1].trim(),
  );
  return urls.filter((u) => u.startsWith(SITE_URL));
}

async function fetchAllMentionsFor(target) {
  const out = [];
  let page = 1;
  while (true) {
    const url = new URL("https://webmention.io/api/mentions.jf2");
    url.searchParams.set("target", target);
    url.searchParams.set("per-page", "100");
    url.searchParams.set("page", String(page));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WM API error ${res.status} for ${target}`);
    const data = await res.json();
    const kids = data.children || [];
    out.push(...kids);
    if (kids.length < 100) break;
    page++;
  }
  return out;
}

// NEW: fetch both /post and /post/ then merge (dedupe by wm-id/url/source)
async function fetchBothForms(targetInput) {
  const canon = withSlash(normalize(targetInput)); // always save under with-slash
  const [A, B] = await Promise.all([
    fetchAllMentionsFor(withoutSlash(canon)).catch(() => []),
    fetchAllMentionsFor(canon).catch(() => []),
  ]);
  const map = new Map();
  for (const m of [...A, ...B]) {
    const key = m["wm-id"] ?? m.url ?? m["wm-source"];
    if (!map.has(key)) map.set(key, m);
  }
  return { canon, items: [...map.values()] };
}

function summarize(children) {
  const counts = { reply: 0, like: 0, repost: 0, mention: 0, rsvp: 0 };

  const mapProp = (p) => {
    switch (p) {
      case "in-reply-to":
      case "reply":
        return "reply";
      case "like-of":
      case "like":
        return "like";
      case "repost-of":
      case "repost":
        return "repost";
      case "mention-of":
      case "mention":
        return "mention";
      case "rsvp":
      case "rsvp-yes":
      case "rsvp-no":
      case "rsvp-maybe":
      case "rsvp-interested":
        return "rsvp";
      default:
        return "mention";
    }
  };

  for (const c of children || []) {
    const prop = c["wm-property"] || c["wm-type"] || "mention";
    counts[mapProp(prop)]++;
  }
  counts.total =
    counts.reply + counts.like + counts.repost + counts.mention + counts.rsvp;
  return counts;
}

async function main() {
  const urls = await getSitemapUrls();

  for (const original of urls) {
    try {
      const { canon, items } = await fetchBothForms(original);
      const counts = summarize(items);
      const file = path.join(CACHE_DIR, toFileName(canon));
      const payload = {
        target: canon,
        counts,
        items,
        fetchedAt: new Date().toISOString(),
      };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2));
      console.log(`✓ ${canon} (${counts.total})`);
    } catch (e) {
      console.log(`! ${original} (skipped: ${e.message})`);
    }
  }

  // light index for quick totals in templates
  const index = {};
  for (const original of urls) {
    const canon = withSlash(normalize(original));
    const file = path.join(CACHE_DIR, toFileName(canon));
    if (fs.existsSync(file)) {
      const j = JSON.parse(fs.readFileSync(file, "utf8"));
      index[canon] = j.counts || { total: 0 };
    } else {
      index[canon] = { total: 0 };
    }
  }
  fs.writeFileSync(
    path.join(CACHE_DIR, "index.json"),
    JSON.stringify({ totalsByUrl: index }, null, 2),
  );
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
