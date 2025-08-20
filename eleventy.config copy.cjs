// eleventy.config.cjs
module.exports = function (eleventyConfig) {
  // Static assets
  eleventyConfig.addPassthroughCopy("src/images");

  // ---- Robust date helpers (parse strings or Dates consistently) ----
  const toMs = (d) => {
    if (d == null) return 0;
    if (d instanceof Date) return d.getTime();
    if (typeof d === "number") return d;
    const t = new Date(d).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  const itemTime = (item) =>
    toMs(item.date) || toMs(item.data?.date) || toMs(item.data?.page?.date);
  const sortByDateDesc = (a, b) => itemTime(b) - itemTime(a);

  // ---- Collections ----
  // Mixed homepage feed
  eleventyConfig.addCollection("posts", (c) =>
    c
      .getAll()
      .filter((it) => it.data?.collectionType === "post")
      .sort(sortByDateDesc),
  );

  // Per-type collections
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

  // ---- Filters ----
  const { DateTime } = require("luxon");
  const normalizeDate = (d) => {
    const ms = toMs(d);
    return ms ? new Date(ms) : null;
  };

  eleventyConfig.addFilter("htmlDateString", (d) => {
    const nd = normalizeDate(d);
    return nd
      ? DateTime.fromJSDate(nd, { zone: "utc" }).toFormat("yyyy-MM-dd")
      : "";
  });

  eleventyConfig.addFilter("readableDate", (d) => {
    const nd = normalizeDate(d);
    return nd
      ? DateTime.fromJSDate(nd, { zone: "utc" }).toFormat("dd-MM-yyyy")
      : "";
  });

  eleventyConfig.addFilter("first", (v) => (Array.isArray(v) ? v[0] : v));
  eleventyConfig.addFilter("asArray", (v) =>
    Array.isArray(v) ? v : v ? [v] : [],
  );

  // ---- Dirs ----
  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "_includes/layouts",
      output: "public",
    },
  };
};
