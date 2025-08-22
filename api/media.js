// api/media.js
// ESM file
import { Readable } from "node:stream";

function getUrlFromRequestLike(reqOrRequest) {
  if (
    typeof reqOrRequest?.url === "string" &&
    typeof reqOrRequest?.headers?.get === "function"
  ) {
    try {
      return new URL(reqOrRequest.url);
    } catch {}
  }
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

async function toWebRequest(reqLike) {
  if (
    typeof reqLike?.headers?.get === "function" &&
    typeof reqLike?.text === "function"
  )
    return reqLike;
  const url = getUrlFromRequestLike(reqLike).toString();
  const method = reqLike.method || "POST";

  const HeadersCtor =
    globalThis.Headers || (await import("node-fetch")).Headers;
  const headers = new HeadersCtor();
  for (const [k, v] of Object.entries(reqLike.headers || {})) {
    if (Array.isArray(v)) headers.set(k, v.join(", "));
    else if (typeof v === "string") headers.set(k, v);
    else if (v != null) headers.set(k, String(v));
  }

  const isBodyless = method === "GET" || method === "HEAD";
  const body = isBodyless ? undefined : reqLike;
  const RequestCtor =
    globalThis.Request || (await import("node-fetch")).Request;
  const init = isBodyless
    ? { method, headers }
    : { method, headers, body, duplex: "half" };
  return new RequestCtor(url, init);
}

async function sendResponse(res, webResp) {
  if (!res) return webResp;
  res.statusCode = webResp.status;
  webResp.headers.forEach((v, k) => res.setHeader(k, v));
  if (!webResp.body) return res.end();
  const nodeStream = Readable.fromWeb(webResp.body);
  nodeStream.on("error", () => {
    try {
      res.end();
    } catch {}
  });
  nodeStream.pipe(res);
}

export default async function handler(requestOrReq, resMaybe) {
  try {
    const mod = await import("./micropub.js");
    const ep = mod.getMicropub ? await mod.getMicropub() : null;
    if (!ep?.mediaHandler) {
      const ResponseCtor =
        globalThis.Response || (await import("node-fetch")).Response;
      return sendResponse(
        resMaybe,
        new ResponseCtor(
          JSON.stringify({ error: "Micropub not initialized" }),
          { status: 500, headers: { "content-type": "application/json" } },
        ),
      );
    }

    const reqUrl = getUrlFromRequestLike(requestOrReq);
    const webReq = await toWebRequest(requestOrReq);
    const resp = await ep.mediaHandler(webReq);

    // Rewrite Location: /src/images/...  ->  /images/...
    let patched = resp;
    try {
      if (resp.status === 201) {
        const headers = new Headers(resp.headers);
        const loc = headers.get("Location") || headers.get("location");
        if (loc) {
          const base =
            process.env.MICROPUB_BASE || `${reqUrl.protocol}//${reqUrl.host}`;
          const fixedPath = loc.replace(
            /(https?:\/\/[^/]+)?\/src\/images\//,
            "/images/",
          );
          headers.set("Location", new URL(fixedPath, base).toString());
          // Expose Location for browsers
          headers.set("Access-Control-Expose-Headers", "Location");
          patched = new Response(resp.body, { status: resp.status, headers });
        }
      }
    } catch {}

    return sendResponse(resMaybe, patched);
  } catch (err) {
    const ResponseCtor =
      globalThis.Response || (await import("node-fetch")).Response;
    return sendResponse(
      resMaybe,
      new ResponseCtor(JSON.stringify({ error: err?.message || String(err) }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
  }
}
