import MicropubEndpoint from "@benjifs/micropub";
import GitHubStore from "@benjifs/github-store";

const {
  // Required:
  ME, // e.g. https://example.com/  (MUST end with /)
  TOKEN_ENDPOINT, // e.g. https://tokens.indieauth.com/token
  GITHUB_TOKEN, // GitHub PAT with repo write access
  GITHUB_USER, // your GitHub username
  GITHUB_REPO, // repo name only, e.g. microblog
  MICROPUB_BASE, // e.g. https://example.com

  // Optional (but helpful to be explicit):
  GITHUB_BRANCH = "main",
} = process.env;

const endpoint = new MicropubEndpoint({
  store: new GitHubStore({
    token: GITHUB_TOKEN,
    user: GITHUB_USER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
  }),

  // IndieAuth
  me: ME,
  tokenEndpoint: TOKEN_ENDPOINT,

  // Where to write files in your repo
  contentDir: "src/posts", // <-- your posts live here
  mediaDir: "src/images", // <-- your images live here

  // Map MF2 props -> front matter (title/tags/etc.)
  translateProps: true,

  // Tell clients what you support
  config: {
    "media-endpoint": `${MICROPUB_BASE}/api/media`,
    "post-types": [
      { type: "note", name: "Note" },
      { type: "article", name: "Article" },
    ],
  },

  // Put everything in src/posts with a simple slug
  // (the library will pass us a slug; we keep it as-is)
  formatSlug: (_type, slug) => `${slug}`,
});

export const micropub = endpoint;
export default async function handler(request) {
  return endpoint.micropubHandler(request);
}
