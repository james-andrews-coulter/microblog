import { micropub } from "./micropub.js";

export default async function handler(request) {
  return micropub.mediaHandler(request);
}
