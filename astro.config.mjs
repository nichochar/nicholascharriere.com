import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://nicholascharriere.com",
  integrations: [
    tailwind(),
    mdx(),
    // /family/* pages are private, shared by direct link only — keep them out of the sitemap
    sitemap({ filter: (page) => !page.includes("/family/") }),
  ],
});
