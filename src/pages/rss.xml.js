import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { existsSync } from "node:fs";
import { posix } from "node:path";

// This feed is consumed by feed readers AND by RSS-to-email (newsletter), so
// every item must be self-contained, email-safe HTML whose URLs are absolute
// and point at real static files. See AGENTS.md ("RSS feed") before changing.

const SITE = "https://nicholascharriere.com";
const parser = new MarkdownIt({ html: true, linkify: true });

// Every image a post can import. Keys look like "../images/butlers.png".
// astro.config.mjs copies src/images/ to dist/images/ (unhashed) at build time,
// so "src/images/foo.png" is served at the stable URL /images/foo.png.
const localImages = import.meta.glob("../images/**/*", { eager: true });

const escapeAttr = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Parse JSX-ish attributes: name="x", name='x', name={x}, or bare `name`.
const ATTR_RE = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g;
function parseAttrs(source) {
  const attrs = {};
  for (const [, name, dq, sq, expr] of source.matchAll(ATTR_RE)) {
    attrs[name] = { value: dq ?? sq ?? expr?.trim() ?? "", isExpr: expr !== undefined };
  }
  return attrs;
}

// Map `import ident from "../../images/foo.png"` lines to { ident: "/images/foo.png" }.
function imageImports(body, postDir, postId) {
  const map = new Map();
  const re = /^\s*import\s+(\w+)\s+from\s+["']([^"']+)["'];?\s*$/gm;
  for (const [, ident, specifier] of body.matchAll(re)) {
    if (!/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(specifier)) continue;
    const resolved = posix.normalize(posix.join(postDir, specifier));
    const rel = resolved.startsWith("src/images/") ? resolved.slice("src/images/".length) : null;
    const mod = rel && localImages[`../images/${rel}`];
    if (!mod) {
      throw new Error(
        `rss.xml: ${postId}: image import "${specifier}" (${ident}) does not resolve to a file ` +
          "under src/images/, so it has no stable feed URL. Move it to src/images/ or teach rss.xml.js about it.",
      );
    }
    map.set(ident, { path: `/images/${rel}`, meta: /** @type {any} */ (mod).default });
  }
  return map;
}

// Replace <Image ... /> (one-line or multiline) with a plain, single-line <img>.
function replaceImages(body, images, postId) {
  const out = body.replace(
    /<Image\b((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\}))?)*)\s*\/>/g,
    (_match, attrSource) => {
      const attrs = parseAttrs(attrSource);
      const ident = attrs.src?.isExpr ? attrs.src.value : null;
      const image = ident ? images.get(ident) : null;
      if (!image) {
        throw new Error(`rss.xml: ${postId}: cannot resolve <Image src=${attrs.src?.value ?? "?"}>`);
      }
      const parts = [`src="${SITE}${image.path}"`, `alt="${escapeAttr(attrs.alt?.value ?? "")}"`];
      const { width: w, height: h } = image.meta ?? {};
      const width = Number(attrs.width?.value) || w;
      if (width) {
        parts.push(`width="${Math.round(width)}"`);
        if (w && h) parts.push(`height="${Math.round((width * h) / w)}"`);
      }
      return `<img ${parts.join(" ")}>`;
    },
  );
  if (/<Image\b/.test(out)) {
    throw new Error(`rss.xml: ${postId}: found an <Image> tag the feed could not parse`);
  }
  return out;
}

// Figcaptions are raw HTML blocks, so markdown-it never sees their contents.
function renderFigcaptions(body) {
  return body.replace(
    /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/g,
    (_m, inner) => `<figcaption>${parser.renderInline(inner.trim())}</figcaption>`,
  );
}

// Many email clients can't play <video>; give empty ones a linked poster fallback
// (clients that support video ignore it).
function addVideoFallbacks(body) {
  return body.replace(/<video\b([^>]*)>\s*<\/video>/g, (match, attrSource) => {
    const attrs = parseAttrs(attrSource);
    const src = attrs.src?.value;
    const poster = attrs.poster?.value;
    if (!src || !poster) return match;
    return `<video${attrSource}><a href="${escapeAttr(src)}"><img src="${escapeAttr(poster)}" alt="Video (click to play)"></a></video>`;
  });
}

// Turn a raw MDX body into clean, email-safe HTML for feed readers + email.
function bodyToHtml(post) {
  const postId = post.id;
  const postUrl = `${SITE}/blog/${post.slug}/`;
  const images = imageImports(post.body, posix.join("src/content/blog", posix.dirname(postId)), postId);

  let markdown = renderFigcaptions(replaceImages(post.body, images, postId));
  markdown = addVideoFallbacks(markdown)
    .split("\n")
    .filter((line) => !/^\s*import\s.+from\s.+;?\s*$/.test(line))
    .filter((line) => !/^\s*export\s/.test(line))
    .join("\n")
    .trim();

  // The item already has a <title>; drop a leading H1 that just repeats it.
  const h1 = markdown.match(/^#\s+(.+?)\s*#*\s*(?:\n|$)/);
  const norm = (s) => s.trim().replace(/\s+/g, " ").toLowerCase();
  if (h1 && norm(h1[1]) === norm(post.data.title)) {
    markdown = markdown.slice(h1[0].length).trim();
  }

  const absolutize = (value, checkFile) => {
    // Leave values that already have a scheme (https:, mailto:, ...) untouched.
    if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
    const url = new URL(value, postUrl).href;
    // Assets on our own site must exist in the build (public/ or src/images/).
    if (checkFile && url.startsWith(`${SITE}/`)) {
      const path = decodeURIComponent(new URL(url).pathname);
      const ok = path.startsWith("/images/")
        ? `../images/${path.slice("/images/".length)}` in localImages
        : existsSync(`public${path}`);
      if (!ok) throw new Error(`rss.xml: ${postId}: ${url} is not a static file in the build`);
    }
    return url;
  };
  const absolutizeAttrs = (fileAttrs) => (tagName, attribs) => {
    if (attribs.href) attribs.href = absolutize(attribs.href, false);
    for (const name of fileAttrs) {
      if (attribs[name]) attribs[name] = absolutize(attribs[name], true);
    }
    return { tagName, attribs };
  };

  return sanitizeHtml(parser.render(markdown), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "sup",
      "sub",
      "small",
      "figure",
      "figcaption",
      "video",
      "source",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      video: ["src", "poster", "controls", "loop", "muted", "playsinline", "preload", "width", "height"],
      source: ["src", "type"],
    },
    transformTags: {
      a: absolutizeAttrs([]),
      img: absolutizeAttrs(["src"]),
      source: absolutizeAttrs(["src"]),
      video: (tagName, attribs) => {
        // No autoplay in feeds/email; always give readers playback controls.
        return absolutizeAttrs(["src", "poster"])(tagName, { ...attribs, controls: "" });
      },
    },
  });
}

export async function GET(context) {
  const posts = (await getCollection("blog", ({ data }) => data.published)).sort(
    (a, b) => (a.data.published < b.data.published ? 1 : -1),
  );

  return rss({
    title: "Nicholas Charriere",
    description:
      "Writing about AI agents, coding agents, agent infrastructure, harnesses, startups, and building software.",
    site: context.site ?? SITE,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.published,
      link: `/blog/${post.slug}/`,
      categories: post.data.tags,
      content: bodyToHtml(post),
    })),
    customData: `<language>en-us</language>`,
  });
}
