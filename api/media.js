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
    const ResponseCtor =
      globalThis.Response || (await import("node-fetch")).Response;

    if (!ep?.mediaHandler) {
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

    const ct = (webReq.headers.get("content-type") || "").toLowerCase();
    const isMultipart = ct.startsWith("multipart/form-data");

    // ---------- NEW: multi-file support ----------
    if (isMultipart && webReq.method !== "GET" && webReq.method !== "HEAD") {
      let fd;
      try {
        fd = await webReq.clone().formData();
      } catch {
        fd = null; // fall back to single-file path
      }

      if (fd) {
        const files = [];
        const fields = [];
        for (const [k, v] of fd.entries()) {
          // Web File objects have a stream() method
          if (v && typeof v === "object" && typeof v.stream === "function") {
            files.push([k, v]);
          } else {
            fields.push([k, v]);
          }
        }

        // If multiple files present, fan-out to mediaHandler per file
        if (files.length > 1) {
          const RequestCtor =
            globalThis.Request || (await import("node-fetch")).Request;

          const results = [];
          for (const [name, file] of files) {
            const one = new FormData();
            // carry over all non-file fields once per upload
            for (const [k, v] of fields) one.append(k, v);
            // keep the same field name for best compatibility (file/photo/photo[])
            one.append(name, file, file.name);

            const headers = new Headers(webReq.headers);
            // Let fetch set correct boundary & length
            headers.delete("content-type");
            headers.delete("content-length");

            const singleReq = new RequestCtor(webReq.url, {
              method: webReq.method,
              headers,
              body: one,
              duplex: "half",
            });

            const singleResp = await ep.mediaHandler(singleReq);

            // --- reuse your Location rewrite logic per file
            let outUrl = null;
            try {
              if (singleResp.status === 201) {
                const h = new Headers(singleResp.headers);
                const loc = h.get("Location") || h.get("location");
                if (loc) {
                  const base =
                    process.env.MICROPUB_BASE ||
                    `${reqUrl.protocol}//${reqUrl.host}`;
                  const fixedPath = loc.replace(
                    /(https?:\/\/[^/]+)?\/src\/images\//,
                    "/images/",
                  );
                  outUrl = new URL(fixedPath, base).toString();
                }
              }
            } catch {}
            results.push(outUrl);
          }

          // Respond with JSON containing all the image URLs (order matches upload order)
          return sendResponse(
            resMaybe,
            new ResponseCtor(JSON.stringify({ locations: results }), {
              status: 201,
              headers: {
                "content-type": "application/json",
                // helpful if you ever keep a Location header for first item
                "access-control-expose-headers": "Location",
              },
            }),
          );
        }
      }
    }
    // ---------- END: multi-file support ----------

    // Fallback / single-file path (unchanged)
    const resp = await ep.mediaHandler(webReq);

    // Rewrite Location: /src/images/... -> /images/...
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
