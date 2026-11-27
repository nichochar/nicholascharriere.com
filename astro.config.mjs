import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Copy src/images/* to dist/images/* (unhashed) after the build. The RSS feed
// (src/pages/rss.xml.js) points <Image> figures at these stable URLs, so
// newsletter emails keep working after a redeploy. Never commit these to public/.
function stableImages() {
  return {
    name: "stable-images",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const from = fileURLToPath(new URL("./src/images/", import.meta.url));
        const to = fileURLToPath(new URL("./images/", dir));
        if (existsSync(to)) {
          throw new Error(
            `stable-images: ${to} already exists (is there a public/images/ dir?). ` +
              "It would collide with the copied src/images/ used by the RSS feed.",
          );
        }
        cpSync(from, to, { recursive: true });
        logger.info(`copied src/images/ -> ${to}`);
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: "https://nicholascharriere.com",
  integrations: [
    tailwind(),
    mdx(),
    // /family/* pages are private, shared by direct link only — keep them out of the sitemap.
    // /subscribed/ is the newsletter confirmation landing page — same treatment.
    sitemap({ filter: (page) => !page.includes("/family/") && !page.includes("/subscribed/") }),
    stableImages(),
  ],
});
