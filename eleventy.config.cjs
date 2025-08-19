// eleventy.config.cjs
module.exports = function (eleventyConfig) {
  // Where includes live (inside your input dir)
  // We won't set a layouts dir at all.
  // We'll use an alias that points into _includes/layouts.
  eleventyConfig.addLayoutAlias("base", "layouts/base.njk");
  eleventyConfig.addLayoutAlias("article", "layouts/article.njk");
  eleventyConfig.addLayoutAlias("note", "layouts/note.njk");

  // Passthroughs, collections, filters (keep yours)
  eleventyConfig.addPassthroughCopy("src/images");

  eleventyConfig.addCollection("posts", (c) =>
    c.getFilteredByTag("posts").sort((a, b) => b.date - a.date),
  );
  eleventyConfig.addCollection("notes", (c) =>
    c.getFilteredByTag("posts").filter((it) => it.data.type === "note"),
  );
  eleventyConfig.addCollection("articles", (c) =>
    c.getFilteredByTag("posts").filter((it) => it.data.type === "article"),
  );

  const { DateTime } = require("luxon");
  eleventyConfig.addFilter("htmlDateString", (d) =>
    DateTime.fromJSDate(d, { zone: "utc" }).toFormat("yyyy-MM-dd"),
  );
  eleventyConfig.addFilter("readableDate", (d) =>
    DateTime.fromJSDate(d, { zone: "utc" }).toFormat("dd-MM-yyyy"),
  );

  // Explicit dirs: includes is _includes; don't set layouts here
  return {
    dir: {
      input: "src",
      includes: "_includes",
      // NOTE: no `layouts` key here on purpose
      output: "public",
    },
  };
};
