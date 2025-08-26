import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SITE_URL = "https://blog.jamesandrewscoulter.com";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "data", "webmentions");

const ensureDir = (dir) =>
  fs.existsSync(dir) || fs.mkdirSync(dir, { recursive: true });
ensureDir(CACHE_DIR);

const toFileName = (url) => Buffer.from(url).toString("base64url") + ".json";

const normalize = (u) => {
  try {
    const x = new URL(u);
    x.hash = "";
    if (x.pathname.endsWith("/")) x.pathname = x.pathname.slice(0, -1);
    return x.toString();
  } catch {
    return u;
  }
};

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

function summarize(children) {
  const counts = { reply: 0, like: 0, repost: 0, mention: 0 };
  for (const c of children) {
    const t = c["wm-property"] || c["wm-type"] || "mention";
    if (t in counts) counts[t]++;
    else counts.mention++;
  }
  counts.total = counts.reply + counts.like + counts.repost + counts.mention;
  return counts;
}

async function main() {
  const urls = await getSitemapUrls();
  for (const original of urls) {
    const target = normalize(original);
    try {
      const items = await fetchAllMentionsFor(target);
      const counts = summarize(items);
      const file = path.join(CACHE_DIR, toFileName(target));
      const payload = {
        target,
        counts,
        items,
        fetchedAt: new Date().toISOString(),
      };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2));
      console.log(`✓ ${target} (${counts.total})`);
    } catch (e) {
      console.log(`! ${target} (skipped: ${e.message})`);
    }
  }

  // light index for quick totals in templates
  const index = {};
  for (const original of urls) {
    const target = normalize(original);
    const file = path.join(CACHE_DIR, toFileName(target));
    if (fs.existsSync(file)) {
      const j = JSON.parse(fs.readFileSync(file, "utf8"));
      index[target] = j.counts || { total: 0 };
    } else {
      index[target] = { total: 0 };
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
