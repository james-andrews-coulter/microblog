module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/images");

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

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "public",
    },
  };
};
