import MicropubEndpoint from "@benjifs/micropub";
import GitHubStore from "@benjifs/github-store";

// Required env vars (we’ll add them in Vercel):
const {
  ME,
  TOKEN_ENDPOINT,
  GITHUB_TOKEN,
  GITHUB_USER,
  GITHUB_REPO,
  MICROPUB_BASE, // e.g., https://yourdomain.com (we’ll set this too)
} = process.env;

// Map post types to your 11ty folders.
// We'll put "note" posts in /src/notes and "article" posts in /src/articles
const formatSlug = (type, slug) => {
  const dir =
    type === "note" ? "notes" : type === "article" ? "articles" : type;
  return `${dir}/${slug}`;
};

// Build the endpoint
export const micropub = new MicropubEndpoint({
  store: new GitHubStore({
    token: GITHUB_TOKEN,
    user: GITHUB_USER,
    repo: GITHUB_REPO,
  }),
  me: ME, // must have trailing slash!
  tokenEndpoint: TOKEN_ENDPOINT,
  contentDir: "src", // change if your 11ty input dir isn’t "src"
  mediaDir: "uploads", // where uploaded files go in your repo
  translateProps: true, // maps microformats to 11ty front matter (name->title, category->tags, etc.)

  // Client-facing config (returned by GET ?q=config):
  config: {
    "media-endpoint": `${MICROPUB_BASE}/api/media`,
    "post-types": [
      { type: "note", name: "Note" },
      { type: "article", name: "Article" },
    ],
  },

  formatSlug,
});

export default async function handler(request) {
  // Just forward the Request to the Micropub handler
  return micropub.micropubHandler(request);
}
