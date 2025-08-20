// src/posts/posts.11tydata.js (ESM)
// Minimal + pragmatic: keep templates clean and robust.
export default {
  collectionType: "post",
  permalink: "posts/{{ page.fileSlug }}/index.html",

  eleventyComputed: {
    // Friendly aliases for hyphenated Micropub props (clients often send arrays)
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

    // Optional nicety for layouts that show a heading if present
    title: (d) => d.title || d.name || undefined,
  },
};
