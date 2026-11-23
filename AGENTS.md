# AGENTS.md

General project guidance (commands, architecture, styling, deployment) is in
[`CLAUDE.md`](./CLAUDE.md). This file adds rules that agents must follow when
touching blog content or the feed.

## RSS feed (`/rss.xml`) — it is also the newsletter

The feed at `/rss.xml` is implemented in `src/pages/rss.xml.js`. It is consumed
by **feed readers and by RSS-to-email** (Buttondown / Kit), so each item's
`content:encoded` must be **self-contained, email-safe HTML**: full post content,
no scripts or JS, and every URL absolute (`https://nicholascharriere.com/…`)
and pointing at a real static file in the build. Emails are opened long after
they are sent, so asset URLs must be stable across redeploys.

Keep the path `/rss.xml` and the `<link rel="alternate" type="application/rss+xml">`
in `src/layouts/Layout.astro` unchanged.

### How post bodies become feed HTML (`bodyToHtml` in `rss.xml.js`)

1. **Astro `<Image>` figures.** `import ident from "../../images/foo.png"` lines
   are parsed and resolved against `import.meta.glob("../images/**/*")`. Every
   `<Image … src={ident} … />` (one-line or multiline) is rewritten to
   `<img src="https://nicholascharriere.com/images/foo.png" alt="…" width height>`
   (width from the `width` prop if given, else intrinsic; height from aspect ratio).
2. **Stable image URLs.** The `stable-images` integration in `astro.config.mjs`
   copies `src/images/` → `dist/images/` (unhashed, original filenames) on
   `astro:build:done`. Do **not** put copies in `public/` (the build fails if
   `public/images/` exists, since it would collide). Hashed `/_astro/…` URLs
   are deliberately not used in the feed. Note: `/images/…` only exists in the
   build output, not in `astro dev`.
3. **Captions.** `<figcaption>` contents are raw HTML to markdown-it, so they are
   run through `parser.renderInline` — `[text](url)` becomes a real `<a>`.
4. **Videos.** `<video>`/`<source>` are allowed. Empty `<video>` tags get a
   fallback (poster image linked to the video file) for email clients that
   can't play video; `autoplay` is dropped and `controls` is forced on.
5. JS `import`/`export` lines are stripped, and a leading `# H1` that matches
   the post title is removed (the item already has a `<title>`). Other headings stay.
6. markdown-it renders (`html: true`, `linkify: true`), then sanitize-html
   keeps default tags (incl. tables) + `img`, `figure`, `figcaption`, `video`,
   `source`, `sup`, `sub`, `small`, and makes every relative `href`/`src`/`poster`
   absolute (query strings preserved, e.g. `?v=2`). Root-relative markdown
   images like `/migrated/foo.webp` become `https://nicholascharriere.com/migrated/foo.webp`.

The build **fails loudly** if an `<Image>` identifier or image import can't be
resolved to a file under `src/images/`, if an `<Image>` tag can't be parsed,
or if an on-site `src`/`poster` in the feed doesn't exist in `public/` or
`src/images/`. Don't "fix" those errors by dropping images.

### How to verify

Run `npm run build`, then inspect `dist/rss.xml` (`content:encoded` is
HTML-escaped: `&lt;img src=&quot;…`, so unescape or grep for the escaped form):

- No root-relative values: `grep -oE '(src|href|poster)=&quot;/' dist/rss.xml` prints nothing.
- Posts that use `<Image>` contain `<img>` tags with
  `https://nicholascharriere.com/images/…` sources, and those files exist under
  `dist/` (e.g. `dist/images/butlers.png`).
- Figcaptions contain `<a href="https://…">`, not raw `[text](url)`
  (`grep -c '](http' dist/rss.xml` should be 0).
- Item content does not start with a duplicate `<h1>` of the post title.
- Videos (disposable-tools-for-thought) have absolute `src` and `poster`.

### When adding new content patterns

Whenever you add a new MDX component, a new image/figure pattern, images
outside `src/images/`, or new embedded media, check that the feed still renders
it as email-safe HTML with absolute URLs (run the checks above). If a component
can't be represented reasonably in the feed, handle it in `rss.xml.js`
(convert it to plain HTML or a link) and update this section.

## Newsletter subscribe card

- Component: `src/components/SubscribeCta.astro`. Rendered at the end of every
  post (`src/pages/blog/[...slug].astro`, after the body and the optional HN
  line, wrapped in `not-prose`) and on `/blog` under the H1 (`src/pages/blog.astro`).
- Provider config: `src/config/newsletter.ts`. Set `action` to the provider's
  form-post URL (and `emailField` if it doesn't use `email`, e.g. Kit's
  `email_address`) to enable the email form. No embed scripts or iframes.
- While `action` is `""`, the card renders title + copy + "Or follow via RSS"
  only: no `<form>`, no email field, no button. Nothing looks submittable and
  nothing posts to a broken URL, so it is safe to ship before choosing a provider.
- With a provider, submit goes through `fetch` (same FormData, `mode: "no-cors"`)
  and only after the request is sent does the card crossfade to the success line.
  On network failure the form stays visible.

## Dates

Content calendar dates must be formatted in **UTC** with `formatDate` from
`src/lib/formatDate.ts`. YAML date-only frontmatter (`published: 2026-11-22`)
is parsed as UTC midnight, so formatting in local time shows the previous day
in US timezones. Hand-built dates (e.g. TIL entries) use `new Date(Date.UTC(y, m, d))`.
Machine dates (`toISOString().slice(0, 10)` in llms.txt / `.md` endpoints, RSS
`pubDate`) are already UTC.
