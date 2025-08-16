// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://blog.jamesandrewscoulter.com", // your custom domain
  base: "/", // root of the site since you have a CNAME
  integrations: [mdx(), sitemap(), tailwind(), react()],
});
