// src/posts/posts.11tydata.js
export default (data = {}) => {
  const isArticle = Boolean(data.title || data.name);

  // Normalize Micropub `content` → `body`
  const raw = data.content;
  const body =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && raw.html
        ? raw.html
        : raw && typeof raw === "object" && raw.text
          ? raw.text
          : "";

  // Some posts (esp. new ones written by Micropub) might not have `page.fileSlug`
  const slug =
    data.page && data.page.fileSlug
      ? data.page.fileSlug
      : data.fileSlug || null;

  return {
    tags: ["posts"],
    type: isArticle ? "article" : "note",
    layout: isArticle ? "layouts/article.njk" : "layouts/note.njk",
    permalink: slug ? `/posts/${slug}/` : false, // `false` = let Eleventy decide if slug missing
    body,
    title: data.title || data.name || undefined,
  };
};
