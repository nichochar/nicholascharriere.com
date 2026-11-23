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
  It is a compact card (max-width ~30rem, left-aligned): a headline and an
  inline email field + Subscribe button on one row. RSS is not in the card; it
  is a quiet "RSS" link (`/rss.xml`) at the bottom of the `/blog` list.
- The form is **always shown**. The client `fetch`es `POST /api/subscribe`
  (same-origin, JSON `{ email, source_path, website }`, no `no-cors`) and only
  crossfades to the success line on a `{ ok: true }` response. Errors show
  inline and the form stays usable. Config: `src/config/newsletter.ts`.
- The form has `data-astro-reload` so the `<ViewTransitions />` router in
  `Layout.astro` doesn't take over the submit and navigate to the JSON endpoint.
  Keep it.
- **Honeypot:** the hidden `website` input (clipped off-screen, `tabindex="-1"`,
  `aria-hidden` wrapper) is intentional bot protection. Don't "clean it up".
  The function rejects any request where it is non-empty (400 `rejected`, no insert).
  The name is set in both `src/config/newsletter.ts` and `HONEYPOT_FIELD` in the function.

### Storage: Pages Function + D1

- Function: `functions/api/subscribe.ts` (Pages Functions convention, so it
  serves `/api/subscribe`). `functions/` sits at the repo root and is not part
  of the Astro build. Pages picks it up on deploy. `npm run build` typechecks
  it with `tsc -p functions` (`@cloudflare/workers-types`), and the root
  `tsconfig.json` excludes it from `astro check`.
- Database: D1 `nicholascharriere-subscribers`
  (id `a14e9bcc-f3d7-4eee-9592-af3b59a2afd9`), table `subscribers`
  (`id`, `email` UNIQUE, `created_at`, `source_path`, `user_agent`, `country`),
  plus `rate_limits` (8 requests / 10 min per SHA-256-hashed IP).
- Binding: `DB`, already set on Pages project `nicholascharriere-com` for both
  preview and production (dashboard → Settings → Bindings). Nothing to turn on
  per deploy.
- Schema changes are new files in `migrations/` applied with
  `npx wrangler d1 migrations apply nicholascharriere-subscribers --remote`.
  `wrangler.toml` exists only for D1 migrations and local dev. Do **not** add
  `pages_build_output_dir` to it, because this is a Git-integrated Pages project
  configured in the dashboard.
- **Never add a public endpoint that lists or exports emails.**

### Buttondown (primary list) + D1 (backup)

- Signups go to **Buttondown** (newsletter username `nichochar`) **and** to D1
  as a backup. The form still posts to `/api/subscribe`; the function is what
  talks to Buttondown (`POST https://api.buttondown.com/v1/subscribers`). It
  writes D1 first, then Buttondown, so a Buttondown outage never blocks the backup.
- Double opt-in is Buttondown's default (subscriber starts `unactivated` and gets
  a confirmation email). Don't bypass it: no `type`, no
  `X-Buttondown-Bypass-Firewall`, no `X-Buttondown-Collision-Behavior: overwrite`.
- "Already subscribed" errors from Buttondown (400/409 with `email_already_exists`
  or similar) count as success.
- If Buttondown is down, times out (8s), or the secret is missing, the function
  still saves to D1 and returns `{ ok: true }`; it logs the Buttondown failure
  (status + short code, never the key or the email).
- Secret: encrypted Cloudflare Pages secret `BUTTONDOWN_API_KEY`, already set on
  project `nicholascharriere-com` for both preview and production. Read in the
  function as `env.BUTTONDOWN_API_KEY`. Never commit it or put it in
  `wrangler.toml`. To rotate:

  ```sh
  # pipe the value; do not echo it
  printf '%s' "$BUTTONDOWN_API_KEY" | npx wrangler pages secret put BUTTONDOWN_API_KEY --project-name nicholascharriere-com
  printf '%s' "$BUTTONDOWN_API_KEY" | npx wrangler pages secret put BUTTONDOWN_API_KEY --project-name nicholascharriere-com --env preview
  ```

  Wrangler warns about `pages_build_output_dir` missing from `wrangler.toml`;
  ignore it, do not add that field. A new Pages deployment is required before a
  changed secret is picked up.

### Exporting subscribers

**From Buttondown (the primary list):** in the Buttondown dashboard, open the
Subscribers tab and click Export (no need to select everyone). You get a CSV
(id, email, subscriber_type, referrer_url, dates, metadata, etc.). If it takes a
while, Buttondown emails the file.

**From D1 (the backup, CLI only)**, for when Buttondown is unavailable or you
want a local copy. Needs wrangler auth (`npx wrangler login` or a `CLOUDFLARE_API_TOKEN` in your env, never in the repo):

```sh
npx wrangler d1 execute nicholascharriere-subscribers --remote --json \
  --command "SELECT email, created_at, source_path, country FROM subscribers ORDER BY created_at" \
  | jq -r '.[0].results | (["email","created_at","source_path","country"] | @csv), (.[] | [.email, .created_at, .source_path, .country] | @csv)' \
  > subscribers.csv
```

Without jq, pipe the same `--json` output to:

```sh
python3 -c 'import sys,json,csv; r=json.load(sys.stdin)[0]["results"]; w=csv.DictWriter(sys.stdout,["email","created_at","source_path","country"],extrasaction="ignore"); w.writeheader(); w.writerows(r)' > subscribers.csv
```

Count only: `npx wrangler d1 execute nicholascharriere-subscribers --remote --command "SELECT COUNT(*) FROM subscribers"`.
Don't commit `subscribers.csv`.

## Dates

Content calendar dates must be formatted in **UTC** with `formatDate` from
`src/lib/formatDate.ts`. YAML date-only frontmatter (`published: 2026-11-22`)
is parsed as UTC midnight, so formatting in local time shows the previous day
in US timezones. Hand-built dates (e.g. TIL entries) use `new Date(Date.UTC(y, m, d))`.
Machine dates (`toISOString().slice(0, 10)` in llms.txt / `.md` endpoints, RSS
`pubDate`) are already UTC.
