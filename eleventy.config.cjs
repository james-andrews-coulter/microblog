const fs = require("fs");
const path = require("path");

module.exports = function (eleventyConfig) {
  // Static assets
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });

  eleventyConfig.addFilter("head", (arr, n = 20) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("rfc822", (d) =>
    DateTime.fromJSDate(d, { zone: "utc" }).toRFC2822(),
  );

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
    "checkin",
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

  eleventyConfig.addFilter("wmLoad", function (targetUrl) {
    try {
      const slug = Buffer.from(String(targetUrl)).toString("base64url");
      const file = path.join(
        process.cwd(),
        "data",
        "webmentions",
        `${slug}.json`,
      );
      const raw = fs.readFileSync(file, "utf8");
      return JSON.parse(raw);
    } catch (e) {
      return {
        counts: { total: 0, reply: 0, like: 0, repost: 0, mention: 0 },
        items: [],
      };
    }
  });

  eleventyConfig.addFilter("rfc822", (dateObj) =>
    DateTime.fromJSDate(dateObj, { zone: "utc" }).toRFC2822(),
  );

  // rss feed webmention auto-sending
  eleventyConfig.addFilter("autolink", (html) => {
    if (!html) return html;
    // Linkify bare http(s) URLs that aren’t already inside an href
    return String(html).replace(
      /(^|[\s>])(https?:\/\/[^\s<>"']+[^\s<>"'.,!?)]?)(?=$|[\s<])/g,
      (m, pre, url) => `${pre}<a href="${url}">${url}</a>`,
    );
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "_includes/layouts",
      output: "public",
    },
  };
};
