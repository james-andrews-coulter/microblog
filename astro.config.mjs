// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import tailwind from "@astrojs/tailwind";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
<<<<<<< HEAD
  site: "https://blog.james.com",
  integrations: [mdx(), sitemap(), tailwind(), react()],
=======
    site: 'https://blog.james.com',
    integrations: [mdx(), sitemap(), tailwind(), react()],
>>>>>>> e6f07b92064a43221e25d3b913bc063c00da283f
});
