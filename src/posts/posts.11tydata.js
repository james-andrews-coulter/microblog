// src/posts/posts.11tydata.js (ESM)
export default {
  // Everything in src/posts participates in your mixed feed
  collectionType: "post",

  eleventyComputed: {
    // Respect explicit type; otherwise infer from common Micropub props
    type: (d) => {
      if (d.type) return d.type;
      if (d["bookmark-of"]) return "bookmark";
      if (d["like-of"]) return "like";
      if (d["repost-of"]) return "repost";
      if (d["in-reply-to"]) return "reply";
      if (d.photo) return "photo";
      return d.title || d.name ? "article" : "note";
    },

    // Pick layout per type, unless already set
    layout: (d) => {
      if (d.layout) return d.layout;
      const t = d.type || (d.title || d.name ? "article" : "note");
      switch (t) {
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
    },

    // /posts/<slug>/
    permalink: (d) => {
      if (d.permalink) return d.permalink;
      const slug =
        d.page?.fileSlug ?? d.page?.filePathStem?.split("/").pop() ?? "";
      return `/posts/${slug}/`;
    },

    // Micropub niceties: normalize hyphenated/array properties
    bookmarkOf: (d) =>
      Array.isArray(d["bookmark-of"]) ? d["bookmark-of"][0] : d["bookmark-of"],
    inReplyTo: (d) =>
      Array.isArray(d["in-reply-to"]) ? d["in-reply-to"][0] : d["in-reply-to"],
    likeOf: (d) =>
      Array.isArray(d["like-of"]) ? d["like-of"][0] : d["like-of"],
    repostOf: (d) =>
      Array.isArray(d["repost-of"]) ? d["repost-of"][0] : d["repost-of"],
    photos: (d) =>
      Array.isArray(d.photo) ? d.photo : d.photo ? [d.photo] : [],

    // Normalize content to a single body string
    body: (d) => {
      const raw = d.content;
      if (typeof raw === "string") return raw;
      if (raw && typeof raw === "object") return raw.html ?? raw.text ?? "";
      return "";
    },

    // Nice-to-have: expose a title if present
    title: (d) => d.title || d.name || undefined,
  },
};
