module.exports = function (eleventyConfig) {
  /*COPY FILES */
  eleventyConfig.addPassthroughCopy("src/images");

  // All posts
  eleventyConfig.addCollection("posts", (collection) =>
    collection.getFilteredByTag("posts").sort((a, b) => b.date - a.date),
  );

  eleventyConfig.addCollection("notes", (collection) =>
    collection
      .getFilteredByTag("posts")
      .filter((item) => item.data.type === "note"),
  );

  eleventyConfig.addCollection("articles", (collection) =>
    collection
      .getFilteredByTag("posts")
      .filter((item) => item.data.type === "article"),
  );

  /*DATE TIME */
  const { DateTime } = require("luxon");

  // https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return DateTime.fromJSDate(dateObj, {
      zone: "utc",
    }).toFormat("yyyy-MM-dd");
  });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, {
      zone: "utc",
    }).toFormat("dd-MM-yyyy");
  });

  /*GENERATION */
  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "public",
    },
  };
};
