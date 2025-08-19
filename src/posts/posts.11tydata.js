// src/posts/posts.11tydata.js
module.exports = (data) => {
  const isArticle = Boolean(data.title); // if it has a title, show as article
  return {
    tags: ["posts"],
    type: isArticle ? "article" : "note", // <- maps Micropub "entry" to your "note"
    layout: isArticle ? "layouts/article.njk" : "layouts/note.njk",
    permalink: `/posts/${data.page.fileSlug}/`,
  };
};
