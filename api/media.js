import { micropub } from "./micropub.js";

// Media uploads (returns 201 + Location of uploaded file)
export default async function handler(request) {
  return micropub.mediaHandler(request);
}
