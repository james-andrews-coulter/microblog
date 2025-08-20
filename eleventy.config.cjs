// eleventy.config.cjs
module.exports = function (eleventyConfig) {
  // Layout aliases (add more if you introduce more types)
  eleventyConfig.addLayoutAlias("base", "layouts/base.njk");
  eleventyConfig.addLayoutAlias("article", "layouts/article.njk");
  eleventyConfig.addLayoutAlias("note", "layouts/note.njk");
  // eleventyConfig.addLayoutAlias("photo", "layouts/photo.njk"); // if you add one, etc.

  // Static assets
  eleventyConfig.addPassthroughCopy("src/images");

  // --- Collections ---
  const sortByDateDesc = (a, b) =>
    (b.date || b.data?.date || 0) - (a.date || a.data?.date || 0);

  // Mixed homepage feed: all entries that declare collectionType: "post"
  eleventyConfig.addCollection("posts", (c) =>
    c
      .getAll()
      .filter((it) => it.data?.collectionType === "post")
      .sort(sortByDateDesc),
  );

  // Per-type collections for index pages
  const TYPES = [
    "article",
    "note",
    "photo",
    "bookmark",
    "like",
    "repost",
    "reply",
  ];
  TYPES.forEach((t) => {
    eleventyConfig.addCollection(`${t}s`, (c) =>
      c
        .getAll()
        .filter(
          (it) => it.data?.collectionType === "post" && it.data?.type === t,
        )
        .sort(sortByDateDesc),
    );
  });

  // --- Filters ---
  const { DateTime } = require("luxon");
  const toDate = (d) => (d instanceof Date ? d : new Date(d));

  eleventyConfig.addFilter("htmlDateString", (d) =>
    DateTime.fromJSDate(toDate(d), { zone: "utc" }).toFormat("yyyy-MM-dd"),
  );
  eleventyConfig.addFilter("readableDate", (d) =>
    DateTime.fromJSDate(toDate(d), { zone: "utc" }).toFormat("dd-MM-yyyy"),
  );
  eleventyConfig.addFilter("first", (v) => (Array.isArray(v) ? v[0] : v));
  eleventyConfig.addFilter("asArray", (v) =>
    Array.isArray(v) ? v : v ? [v] : [],
  );

  // Dirs
  return {
    dir: {
      input: "src",
      includes: "_includes",
      // no 'layouts' key on purpose; we use aliases into _includes/layouts
      output: "public",
    },
  };
};
