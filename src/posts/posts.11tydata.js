// src/posts/posts.11tydata.js (ESM)
export default {
  // ensure everything here is part of your "posts" collection
  tags: ["posts"],

  eleventyComputed: {
    // If it has a title/name, treat as article; otherwise a note
    type: (data) => (data.title || data.name ? "article" : "note"),

    // Pick layout per type
    layout: (data) =>
      data.title || data.name ? "layouts/article.njk" : "layouts/note.njk",

    // Build at /posts/<slug>/
    permalink: (data) => {
      const slug =
        data.page?.fileSlug ?? data.page?.filePathStem?.split("/").pop() ?? "";
      return `/posts/${slug}/`;
    },

    // Normalize Micropub content into a `body` value (optional)
    body: (data) => {
      const raw = data.content;
      if (typeof raw === "string") return raw;
      if (raw && typeof raw === "object") return raw.html ?? raw.text ?? "";
      return "";
    },

    // Optional: expose title for articles
    title: (data) => data.title || data.name || undefined,
  },
};
