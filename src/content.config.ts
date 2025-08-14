import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),

    // Dates
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(), // <- add this (or rename to modDate and change template)

    // Media & meta
    hero: z.string().optional(), // allow relative paths; don't force URL()
    tags: z.array(z.string()).default([]), // default to [] so .map is safe

    // Post-type-of links (all optional)
    inReplyTo: z.string().url().optional(),
    likeOf: z.string().url().optional(),
    repostOf: z.string().url().optional(),
    bookmarkOf: z.string().url().optional(),

    // POSSE / syndication permalinks
    syndication: z.array(z.string().url()).optional(),
  }),
});

const info = defineCollection({
  loader: glob({ base: "./src/content/info", pattern: "**/*.{md,mdx}" }),
  schema: z.any(),
});

export const collections = { blog, info };
