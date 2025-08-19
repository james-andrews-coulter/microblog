// eleventy.config.cjs
module.exports = function (eleventyConfig) {
  // Tell Eleventy where layouts live (relative to `includes`)
  eleventyConfig.setIncludesDirectory("_includes");
  eleventyConfig.setLayoutsDirectory("layouts"); // <-- not "_includes/layouts"

  eleventyConfig.addPassthroughCopy("src/images");

  // Collections (unchanged)
  eleventyConfig.addCollection("posts", (c) =>
    c.getFilteredByTag("posts").sort((a, b) => b.date - a.date),
  );
  eleventyConfig.addCollection("notes", (c) =>
    c.getFilteredByTag("posts").filter((it) => it.data.type === "note"),
  );
  eleventyConfig.addCollection("articles", (c) =>
    c.getFilteredByTag("posts").filter((it) => it.data.type === "article"),
  );

  // Filters
  const { DateTime } = require("luxon");
  eleventyConfig.addFilter("htmlDateString", (d) =>
    DateTime.fromJSDate(d, { zone: "utc" }).toFormat("yyyy-MM-dd"),
  );
  eleventyConfig.addFilter("readableDate", (d) =>
    DateTime.fromJSDate(d, { zone: "utc" }).toFormat("dd-MM-yyyy"),
  );

  // Dirs (input/output)
  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "layouts", // <-- also just "layouts" here
      output: "public",
    },
  };
};
