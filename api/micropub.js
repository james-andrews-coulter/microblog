// api/micropub.js
// ESM file (package.json has "type":"module")

// --- tiny utils -------------------------------------------------------------
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

async function toWebRequest(reqLike) {
  // Already a Web Request?
  if (
    typeof reqLike?.headers?.get === "function" &&
    typeof reqLike?.text === "function"
  )
    return reqLike;

  // Node IncomingMessage -> Web Request
  const url = getUrlFromRequestLike(reqLike).toString();
  const method = reqLike.method || "GET";

  // Build Headers from Node headers object
  const HeadersCtor =
    globalThis.Headers || (await import("node-fetch")).Headers;
  const headers = new HeadersCtor();
  const nodeHeaders = reqLike.headers || {};
  for (const [k, v] of Object.entries(nodeHeaders)) {
    if (Array.isArray(v)) headers.set(k, v.join(", "));
    else if (typeof v === "string") headers.set(k, v);
    else if (v != null) headers.set(k, String(v));
  }

  const isBodyless = method === "GET" || method === "HEAD";
  const body = isBodyless ? undefined : reqLike; // Node IncomingMessage is a readable stream
  const RequestCtor =
    globalThis.Request || (await import("node-fetch")).Request;
  return new RequestCtor(url, { method, headers, body });
}

async function sendResponse(
  res /* Node res or null */,
  webResp /* Fetch Response */,
) {
  if (!res) return webResp; // in Fetch handler, just return it

  // Bridge to Node res
  res.statusCode = webResp.status;
  webResp.headers.forEach((v, k) => res.setHeader(k, v));
  const buf = Buffer.from(await webResp.arrayBuffer());
  res.end(buf);
}

// --- lazy Micropub endpoint -------------------------------------------------
let _endpoint = null;
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
      "post-types": [
        { type: "note", name: "Note" },
        { type: "article", name: "Article" },
      ],
    },

    // Filenames like: src/posts/<slug>.md
    formatSlug: (_type, slug) => `${slug}`,
  });

  return _endpoint;
}

// --- handler (works for both (req,res) and (Request)) -----------------------
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

  // For everything else, require env and delegate
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
    const webReq = await toWebRequest(requestOrReq);
    const webResp = await ep.micropubHandler(webReq);
    return sendResponse(resMaybe, webResp);
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

// Optional: let /api/media reuse the same instance
export async function getMicropub() {
  return getEndpoint();
}
