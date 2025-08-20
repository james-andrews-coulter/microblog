// api/micropub.js
// ESM (package.json has "type":"module")
import { Readable } from "node:stream";

// ---------- small utils ----------
const log = (...a) => {
  try {
    console.log("[micropub]", ...a);
  } catch {}
};
const AMBIGUOUS_TYPES = new Set(["entry", "h-entry", "post"]);

function getUrlFromRequestLike(req) {
  if (typeof req?.url === "string" && typeof req?.headers?.get === "function") {
    try {
      return new URL(req.url);
    } catch {}
  }
  const rawUrl = req?.url || "/";
  const host =
    req?.headers?.get?.("host") || req?.headers?.host || "localhost:3000";
  const proto =
    host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  const path = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return new URL(`${proto}://${host}${path}`);
}

async function toWebRequest(req) {
  if (
    typeof req?.headers?.get === "function" &&
    typeof req?.text === "function"
  )
    return req;
  const url = getUrlFromRequestLike(req).toString();
  const method = req.method || "GET";
  const HeadersCtor = globalThis.Headers;
  const headers = new HeadersCtor();
  for (const [k, v] of Object.entries(req.headers || {})) {
    headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
  }
  const body = method === "GET" || method === "HEAD" ? undefined : req; // IncomingMessage stream
  const RequestCtor = globalThis.Request;
  return new RequestCtor(
    url,
    body ? { method, headers, body, duplex: "half" } : { method, headers },
  );
}

async function sendResponse(nodeRes, webResp) {
  if (!nodeRes) return webResp;
  nodeRes.statusCode = webResp.status;
  webResp.headers.forEach((v, k) => nodeRes.setHeader(k, v));
  if (!webResp.body) return nodeRes.end();
  const stream = Readable.fromWeb(webResp.body);
  stream.on("error", () => {
    try {
      nodeRes.end();
    } catch {}
  });
  stream.pipe(nodeRes);
}

function missingEnv() {
  const REQUIRED = [
    "ME",
    "TOKEN_ENDPOINT",
    "GITHUB_TOKEN",
    "GITHUB_USER",
    "GITHUB_REPO",
    "MICROPUB_BASE",
  ];
  return REQUIRED.filter(
    (k) => !process.env[k] || process.env[k].trim() === "",
  );
}

// ---------- type/layout helpers ----------
const hasKey = (fm, key) => new RegExp(`(^|\\n)\\s*${key}:`, "i").test(fm);

function inferTypeFromFM(fm) {
  if (hasKey(fm, "bookmark-of")) return "bookmark";
  if (hasKey(fm, "like-of")) return "like";
  if (hasKey(fm, "repost-of")) return "repost";
  if (hasKey(fm, "in-reply-to")) return "reply";
  if (hasKey(fm, "photo")) return "photo";
  if (hasKey(fm, "name") || hasKey(fm, "title")) return "article";
  return "note";
}

function layoutFor(type) {
  switch (type) {
    case "article":
      return "article.njk";
    case "photo":
      return "photo.njk";
    case "bookmark":
      return "bookmark.njk";
    case "like":
      return "like.njk";
    case "repost":
      return "repost.njk";
    case "reply":
      return "reply.njk";
    default:
      return "note.njk";
  }
}

const replaceLine = (fm, key, val) =>
  hasKey(fm, key)
    ? fm.replace(new RegExp(`^\\s*${key}:.*$`, "im"), `${key}: ${val}`)
    : `${fm}\n${key}: ${val}`;

// ---------- post-write patch (normalize front matter) ----------
async function patchFrontMatterInGitHub({ slug }) {
  const {
    GITHUB_TOKEN,
    GITHUB_USER,
    GITHUB_REPO,
    GITHUB_BRANCH = "main",
  } = process.env;
  const base = "https://api.github.com";
  const auth = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
  };

  const paths = [
    `src/posts/${slug}.md`,
    `src/posts/${slug}.mdx`,
    `src/posts/${slug}.markdown`,
    `src/posts/${slug}/index.md`,
  ];

  const getContent = async (p) => {
    const url = `${base}/repos/${encodeURIComponent(GITHUB_USER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodeURIComponent(p)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
    const r = await fetch(url, { headers: auth });
    if (!r.ok) return null;
    const j = await r.json();
    return {
      path: p,
      sha: j.sha,
      text: Buffer.from(j.content || "", "base64").toString("utf8"),
    };
  };

  let file = null;
  for (const p of paths) {
    file = await getContent(p);
    if (file) break;
  }
  if (!file) {
    log("patch: file not found for slug", slug);
    return;
  }

  const m = file.text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) {
    log("patch: no front matter block");
    return;
  }

  let fm = m[1];
  const body = m[2];

  // Read existing type and normalize ambiguity
  const typeMatch = fm.match(/^\s*type:\s*("?)([a-zA-Z0-9_-]+)\1\s*$/im);
  let existingType = typeMatch?.[2]?.toLowerCase();
  if (!existingType || AMBIGUOUS_TYPES.has(existingType)) existingType = null;

  const finalType = existingType || inferTypeFromFM(fm);
  fm = replaceLine(fm, "type", finalType);

  // Force layout to match finalType (clear, deterministic)
  fm = replaceLine(fm, "layout", layoutFor(finalType));

  const updated = `---\n${fm}\n---\n${body}`;
  const putUrl = `${base}/repos/${encodeURIComponent(GITHUB_USER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodeURIComponent(file.path)}`;
  const payload = {
    message: "chore(micropub): normalize type/layout/collectionType",
    branch: GITHUB_BRANCH,
    sha: file.sha,
    content: Buffer.from(updated, "utf8").toString("base64"),
  };
  const put = await fetch(putUrl, {
    method: "PUT",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!put.ok)
    throw new Error(`GitHub update failed: ${put.status} ${await put.text()}`);
  log("pathed:", file.path, "→ type:", finalType);
}

// ---------- Micropub endpoint ----------
let _endpoint = null;
let _lastCreatedSlug = null;

async function getEndpoint() {
  if (_endpoint) return _endpoint;
  const { default: MicropubEndpoint } = await import("@benjifs/micropub");
  const { default: GitHubStore } = await import("@benjifs/github-store");
  const {
    ME,
    TOKEN_ENDPOINT,
    GITHUB_TOKEN,
    GITHUB_USER,
    GITHUB_REPO,
    MICROPUB_BASE,
    GITHUB_BRANCH = "main",
  } = process.env;

  _endpoint = new MicropubEndpoint({
    store: new GitHubStore({
      token: GITHUB_TOKEN,
      user: GITHUB_USER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
    }),
    me: ME, // must end with /
    tokenEndpoint: TOKEN_ENDPOINT,
    contentDir: "src/posts",
    mediaDir: "src/images",
    translateProps: true,
    config: {
      "media-endpoint": `${MICROPUB_BASE}/api/media`,
      "post-types": [
        { type: "note", name: "Note" },
        { type: "article", name: "Article" },
      ],
    },
    formatSlug: (_type, slug) => {
      _lastCreatedSlug = slug;
      return `${slug}`;
    },
  });
  return _endpoint;
}

// ---------- handler ----------
export default async function handler(reqOrRequest, resMaybe) {
  const url = getUrlFromRequestLike(reqOrRequest);
  log(`${reqOrRequest.method || "GET"} ${url.pathname}${url.search || ""}`);

  // q=config always answers
  if (
    (reqOrRequest.method || "GET") === "GET" &&
    url.searchParams.get("q") === "config"
  ) {
    const base = process.env.MICROPUB_BASE || `${url.protocol}//${url.host}`;
    const body = {
      "media-endpoint": `${base}/api/media`,
      "post-types": [
        { type: "note", name: "Note" },
        { type: "article", name: "Article" },
      ],
    };
    const ResponseCtor = globalThis.Response;
    return sendResponse(
      resMaybe,
      new ResponseCtor(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }

  const miss = missingEnv();
  if (miss.length) {
    const ResponseCtor = globalThis.Response;
    return sendResponse(
      resMaybe,
      new ResponseCtor(
        JSON.stringify({
          error: "Missing environment variables",
          missing: miss,
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      ),
    );
  }

  try {
    const ep = await getEndpoint();
    const webReq = await toWebRequest(reqOrRequest);
    const webResp = await ep.micropubHandler(webReq);

    // After create, normalize FM and set Location to the on-site URL
    if (webResp.status === 201 && _lastCreatedSlug) {
      try {
        await patchFrontMatterInGitHub({ slug: _lastCreatedSlug });
      } catch (e) {
        log("patch error:", e.message);
      }
      const base = process.env.MICROPUB_BASE || `${url.protocol}//${url.host}`;
      const headers = new Headers(webResp.headers);
      headers.set(
        "Location",
        new URL(`/posts/${_lastCreatedSlug}/`, base).toString(),
      );
      const ResponseCtor = globalThis.Response;
      return sendResponse(
        resMaybe,
        new ResponseCtor(webResp.body, { status: 201, headers }),
      );
    }

    return sendResponse(resMaybe, webResp);
  } catch (err) {
    log("handler error:", err?.message || String(err));
    const ResponseCtor = globalThis.Response;
    return sendResponse(
      resMaybe,
      new ResponseCtor(JSON.stringify({ error: err?.message || String(err) }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
  }
}

// For /api/media reuse
export async function getMicropub() {
  return getEndpoint();
}
