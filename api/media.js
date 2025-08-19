// api/media.js
import {} from "./micropub.js"; // ensure same module is loaded (side effect logs)

export default async function handler(request) {
  try {
    const { micropub } = await import("./micropub.js").catch(() => ({}));
    if (micropub?.mediaHandler) return micropub.mediaHandler(request);
    // Fallback: reuse the default export (it will return a helpful error)
    const defaultHandler = (await import("./micropub.js")).default;
    return defaultHandler(request);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
