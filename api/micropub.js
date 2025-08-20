// MY ENDPOINT
// api/micropub.js
// ESM file (package.json has "type":"module")
import { Readable } from "node:stream";

// ---------- tiny utils ----------
const log = (...a) => {
  try {
    console.log("[micropub]", ...a);
  } catch {}
};

function getUrlFromRequestLike(reqOrRequest) {
  // Web Request
  if (
    typeof reqOrRequest?.url === "string" &&
    typeof reqOrRequest?.headers?.get === "function"
  ) {
    try {
      return new URL(reqOrRequest.url);
    } catch {
      /* fall through */
    }
  }
  // Node IncomingMessage (vercel dev / Node runtime)
  const rawUrl = reqOrRequest?.url || "/";
  const host =
    (reqOrRequest?.headers &&
      (reqOrRequest.headers.get?.("host") || reqOrRequest.headers.host)) ||
    "localhost:3000";
  const isLocal = host.includes("localhost") || host.startsWith("127.");
  const proto = isLocal ? "http" : "https";
  const path = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return new URL(`${proto}://${host}${path}`);
}

// Node req -> Web Request (with duplex for streaming bodies)
async function toWebRequest(reqLike) {
  // Already a Web Request?
  if (
    typeof reqLike?.headers?.get === "function" &&
    typeof reqLike?.text === "function"
  )
    return reqLike;

  const url = getUrlFromRequestLike(reqLike).toString();
  const method = reqLike.method || "GET";

  const HeadersCtor =
    globalThis.Headers || (await import("node-fetch")).Headers;
  const headers = new HeadersCtor();
  for (const [k, v] of Object.entries(reqLike.headers || {})) {
    if (Array.isArray(v)) headers.set(k, v.join(", "));
    else if (typeof v === "string") headers.set(k, v);
    else if (v != null) headers.set(k, String(v));
  }

  const isBodyless = method === "GET" || method === "HEAD";
  const body = isBodyless ? undefined : reqLike; // IncomingMessage stream

  const RequestCtor =
    globalThis.Request || (await import("node-fetch")).Request;
  const init = isBodyless
    ? { method, headers }
    : { method, headers, body, duplex: "half" };
  return new RequestCtor(url, init);
}

// Stream a Fetch Response to Node's res without “disturbing” the body
async function sendResponse(
  res /* Node res or null */,
  webResp /* Fetch Response */,
) {
  if (!res) return webResp; // in Fetch handler env, just return it

  res.statusCode = webResp.status;
  webResp.headers.forEach((v, k) => res.setHeader(k, v));
  if (!webResp.body) {
    res.end();
    return;
  }
  const nodeStream = Readable.fromWeb(webResp.body);
  nodeStream.on("error", () => {
    try {
      res.end();
    } catch {}
  });
  nodeStream.pipe(res);
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

// ---------- type/layout helpers for triage ----------
function deriveTypeFromFrontMatter(fmText) {
  const has = (key) => new RegExp(`(^|\\n)${key}:`, "i").test(fmText);
  if (has("type")) {
    const m = fmText.match(/(^|\n)type:\s*("?)([a-zA-Z0-9_-]+)\2/i);
    if (m?.[3]) return m[3].toLowerCase();
  }
  if (has("bookmark-of")) return "bookmark";
  if (has("like-of")) return "like";
  if (has("repost-of")) return "repost";
  if (has("in-reply-to")) return "reply";
  if (has("photo")) return "photo";
  if (has("name") || has("title")) return "article";
  return "note";
}
function layoutFor(type) {
  switch (type) {
    case "article":
      return "layouts/article.njk";
    case "photo":
      return "layouts/photo.njk";
    case "bookmark":
      return "layouts/bookmark.njk";
    case "like":
      return "layouts/like.njk";
    case "repost":
      return "layouts/repost.njk";
    case "reply":
      return "layouts/reply.njk";
    default:
      return "layouts/note.njk";
  }
}

// ---------- post-write patch to add collectionType/type/layout ----------
async function patchFrontMatterInGitHub({ slug }) {
  const {
    GITHUB_TOKEN,
    GITHUB_USER,
    GITHUB_REPO,
    GITHUB_BRANCH = "main",
  } = process.env;

  const base = "https://api.github.com";
  const authHeaders = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
  };

  // Try common content paths/extensions created by the Micropub lib
  const candidatePaths = [
    `src/posts/${slug}.md`,
    `src/posts/${slug}.mdx`,
    `src/posts/${slug}.markdown`,
    `src/posts/${slug}/index.md`,
  ];

  async function getContent(path) {
    const url = `${base}/repos/${encodeURIComponent(GITHUB_USER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
    const resp = await fetch(url, { headers: authHeaders });
    if (resp.ok) return { ok: true, json: await resp.json(), path };
    return { ok: false };
  }

  let found = null;
  for (const p of candidatePaths) {
    const r = await getContent(p);
    if (r.ok) {
      found = r;
      break;
    }
  }
  if (!found) {
    log("Could not find created file to patch for slug:", slug);
    return;
  }

  const { json, path } = found;
  const sha = json.sha;
  const contentBuf = Buffer.from(json.content || "", "base64");
  const contentStr = contentBuf.toString("utf8");

  // Parse front matter block
  const m = contentStr.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) {
    // No front matter; add a minimal one
    const type = "note";
    const fm = [
      "---",
      `collectionType: post`,
      `type: ${type}`,
      `layout: ${layoutFor(type)}`,
      "---",
      "",
    ].join("\n");
    return putContent(
      path,
      fm + contentStr,
      sha,
      "chore(micropub): add front matter defaults",
    );
  }

  let fmText = m[1];
  const body = m[2];

  const ensure = (key, value) => {
    const has = new RegExp(`(^|\\n)${key}:`).test(fmText);
    if (!has) fmText += `\n${key}: ${value}`;
  };

  // Always ensure collectionType
  ensure("collectionType", "post");

  // Ensure type
  let type = deriveTypeFromFrontMatter(fmText);
  ensure("type", type);

  // Ensure layout only if missing
  const hasLayout = /(^|\n)layout:/.test(fmText);
  if (!hasLayout) {
    fmText += `\nlayout: ${layoutFor(type)}`;
  }

  const updated = `---\n${fmText.replace(/\n{2,}$/, "\n")}\n---\n${body}`;
  await putContent(
    path,
    updated,
    sha,
    "chore(micropub): normalize front matter",
  );
  log("Patched front matter for:", path);

  async function putContent(path2, content, sha2, message) {
    const url = `${base}/repos/${encodeURIComponent(GITHUB_USER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodeURIComponent(path2)}`;
    const payload = {
      message,
      branch: GITHUB_BRANCH,
      sha: sha2,
      content: Buffer.from(content, "utf8").toString("base64"),
    };
    const resp = await fetch(url, {
      method: "PUT",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`GitHub content update failed: ${resp.status} ${text}`);
    }
  }
}

// ---------- lazy Micropub endpoint ----------
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

    // IndieAuth
    me: ME, // must end with /
    tokenEndpoint: TOKEN_ENDPOINT,

    // Your repo layout
    contentDir: "src/posts",
    mediaDir: "src/images",
    translateProps: true,

    // Advertised to clients
    config: {
      "media-endpoint": `${MICROPUB_BASE}/api/media`,
      // Keep this minimal; clients may still send other h-entry shapes
      "post-types": [
        { type: "note", name: "Note" },
        { type: "article", name: "Article" },
      ],
    },

    // Filenames like: src/posts/<slug>.md  (also capture slug for redirect fix)
    formatSlug: (_type, slug) => {
      _lastCreatedSlug = slug;
      return `${slug}`;
    },
  });

  return _endpoint;
}

// ---------- handler (supports both (req,res) and (Request)) ----------
export default async function handler(requestOrReq, resMaybe) {
  const url = getUrlFromRequestLike(requestOrReq);
  log(`${requestOrReq.method || "GET"} ${url.pathname}${url.search || ""}`);

  // q=config should *always* return, even without env or GitHub
  if (
    (requestOrReq.method || "GET") === "GET" &&
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

    const ResponseCtor =
      globalThis.Response || (await import("node-fetch")).Response;
    const webResp = new ResponseCtor(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    return sendResponse(resMaybe, webResp);
  }

  // Everything else requires env
  const miss = missingEnv();
  if (miss.length) {
    const ResponseCtor =
      globalThis.Response || (await import("node-fetch")).Response;
    const webResp = new ResponseCtor(
      JSON.stringify({ error: "Missing environment variables", missing: miss }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
    return sendResponse(resMaybe, webResp);
  }

  try {
    const ep = await getEndpoint();
    const webReq = await toWebRequest(requestOrReq); // uses duplex: 'half' when body exists
    const webResp = await ep.micropubHandler(webReq);

    // --- Patch Location to your real page URL: /posts/<slug>/ ---
    let patched = webResp;
    try {
      if (webResp.status === 201 && _lastCreatedSlug) {
        // Normalize front matter in GitHub now that the file exists
        try {
          await patchFrontMatterInGitHub({ slug: _lastCreatedSlug });
        } catch (patchErr) {
          log("Post-write patch failed:", patchErr?.message || patchErr);
        }

        const base =
          process.env.MICROPUB_BASE || `${url.protocol}//${url.host}`;
        const headers = new Headers(webResp.headers);
        headers.set(
          "Location",
          new URL(`/posts/${_lastCreatedSlug}/`, base).toString(),
        );
        patched = new Response(webResp.body, {
          status: webResp.status,
          headers,
        });
      }
    } catch {
      /* ignore and fall through */
    }
    // -------------------------------------------------------------

    return sendResponse(resMaybe, patched);
  } catch (err) {
    log("Handler error:", err?.stack || err?.message || String(err));
    const ResponseCtor =
      globalThis.Response || (await import("node-fetch")).Response;
    const webResp = new ResponseCtor(
      JSON.stringify({ error: err?.message || String(err) }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
    return sendResponse(resMaybe, webResp);
  }
}

// For /api/media to reuse this instance
export async function getMicropub() {
  return getEndpoint();
}
