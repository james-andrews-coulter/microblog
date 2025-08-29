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
  let page = 0;
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

async function fetchBothForms(targetInput) {
  const canon = withSlash(normalize(targetInput)); // cache key (with-slash)
  const vars = variantsFor(targetInput);

  const batches = await Promise.all(
    vars.map(async (t) => {
      const items = await fetchAllMentionsFor(t).catch(() => []);
      console.log(`[wm fetch] target=${t} -> ${items.length} items`);
      return items;
    }),
  );

  const map = new Map();
  for (const m of batches.flat()) {
    const key =
      (m["wm-id"] != null ? `id:${m["wm-id"]}` : null) ||
      (m["wm-source"] && m["wm-target"]
        ? `st:${m["wm-source"]}→${m["wm-target"]}`
        : null) ||
      (m.url ? `url:${m.url}` : null) ||
      Math.random().toString(36);
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

function variantsFor(u) {
  const base = new URL(normalize(u));
  const hosts = new Set([base.host]);

  // common host aliases
  if (base.host.startsWith("www.")) hosts.add(base.host.slice(4));
  else hosts.add("www." + base.host);

  if (base.host.startsWith("blog.")) hosts.add(base.host.slice(5));
  else hosts.add("blog." + base.host);

  const p = base.pathname.replace(/\/+$/, ""); // drop trailing slash for building
  const paths = [p, p + "/", p + "/index.html"];

  const out = [];
  for (const protocol of ["https:", "http:"]) {
    for (const host of hosts) {
      for (const path of paths) {
        const v = new URL(base);
        v.protocol = protocol;
        v.host = host;
        v.pathname = path;
        v.hash = "";
        out.push(v.toString());
      }
    }
  }
  // de-dupe
  return [...new Set(out)];
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
