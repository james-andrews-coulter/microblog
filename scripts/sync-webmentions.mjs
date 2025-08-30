import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SITE_URL = "https://blog.jamesandrewscoulter.com";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(process.cwd(), "data", "webmentions");
const PER_PAGE = 100;

const ensureDir = (d) =>
  fs.existsSync(d) || fs.mkdirSync(d, { recursive: true });
ensureDir(CACHE_DIR);

const toFileName = (u) =>
  Buffer.from(String(u)).toString("base64url") + ".json";
const withSlash = (u) => (u.endsWith("/") ? u : u + "/");
const withoutSlash = (u) => (u.endsWith("/") ? u.slice(0, -1) : u);
const normalize = (u) => {
  try {
    const x = new URL(u);
    x.hash = "";
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
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g))
    .map((m) => m[1].trim())
    .filter((u) => u.startsWith(SITE_URL));
}

async function fetchAllMentionsFor(target) {
  const out = [];
  for (let page = 0; ; page++) {
    const url = new URL("https://webmention.io/api/mentions.jf2");
    url.searchParams.set("target", target);
    url.searchParams.set("per-page", String(PER_PAGE));
    url.searchParams.set("page", String(page));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WM API ${res.status} for ${target}`);
    const data = await res.json();
    const kids = data.children || [];
    out.push(...kids);
    if (kids.length < PER_PAGE) break;
  }
  return out;
}

async function fetchBothForms(targetInput) {
  const canon = withSlash(normalize(targetInput)); // save under with-slash
  const [A, B] = await Promise.all([
    fetchAllMentionsFor(withoutSlash(canon)).catch(() => []),
    fetchAllMentionsFor(canon).catch(() => []),
  ]);
  const map = new Map();
  for (const m of [...A, ...B]) {
    const key =
      m["wm-id"] ??
      (m["wm-source"] && m["wm-target"]
        ? `st:${m["wm-source"]}→${m["wm-target"]}`
        : m.url);
    if (key && !map.has(key)) map.set(key, m);
  }
  return { canon, items: [...map.values()] };
}

function summarize(items) {
  const counts = { reply: 0, like: 0, repost: 0, mention: 0, rsvp: 0 };
  const bucket = (p) =>
    ({
      "in-reply-to": "reply",
      reply: "reply",
      "like-of": "like",
      like: "like",
      "repost-of": "repost",
      repost: "repost",
      "mention-of": "mention",
      mention: "mention",
      rsvp: "rsvp",
      "rsvp-yes": "rsvp",
      "rsvp-no": "rsvp",
      "rsvp-maybe": "rsvp",
      "rsvp-interested": "rsvp",
    })[p] || "mention";
  for (const it of items)
    counts[bucket(it["wm-property"] || it["wm-type"] || "mention")]++;
  counts.total =
    counts.reply + counts.like + counts.repost + counts.mention + counts.rsvp;
  return counts;
}

async function main() {
  const urls = await getSitemapUrls();

  // per-page files
  for (const original of urls) {
    try {
      const { canon, items } = await fetchBothForms(original);
      const counts = summarize(items);
      const file = path.join(CACHE_DIR, toFileName(canon));
      fs.writeFileSync(
        file,
        JSON.stringify(
          { target: canon, counts, items, fetchedAt: new Date().toISOString() },
          null,
          2,
        ),
      );
      console.log(`✓ ${canon} (${counts.total})`);
    } catch (e) {
      console.log(`! ${original} (skipped: ${e.message})`);
    }
  }

  // lightweight index for totals
  const index = {};
  for (const original of urls) {
    const key = withSlash(normalize(original));
    const file = path.join(CACHE_DIR, toFileName(key));
    index[key] = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8")).counts || { total: 0 }
      : { total: 0 };
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
