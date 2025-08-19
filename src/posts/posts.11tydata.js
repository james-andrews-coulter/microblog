// src/posts/posts.11tydata.js  (ESM)
export default (data) => {
  const isArticle = Boolean(data.title || data.name);

  // Normalize Micropub content -> `body`
  const raw = data.content;
  const body =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && raw.html
        ? raw.html
        : raw && typeof raw === "object" && raw.text
          ? raw.text
          : "";

  return {
    tags: ["posts"],
    type: isArticle ? "article" : "note",
    layout: isArticle ? "layouts/article.njk" : "layouts/note.njk",
    permalink: `/posts/${data.page.fileSlug}/`,
    body,
    title: data.title || data.name || undefined,
  };
};
