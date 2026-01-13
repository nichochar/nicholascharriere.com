# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` - Start development server at localhost:4321
- `npm run build` - Type-check with `astro check` then build to `./dist/`
- `npm run preview` - Preview production build locally

## Architecture

This is a personal website built with Astro 4, using Tailwind CSS for styling and MDX for blog content.

### Key Structure

- **Layouts**: `src/layouts/Layout.astro` is the base layout with header/footer. `Post.astro` and `Blog.astro` wrap content in the `Prose` component for typography.
- **Content Collections**: Blog posts live in `src/content/blog/` as MDX files. Schema defined in `src/content/config.ts` requires `title`, `tags`, and `published` date.
- **Pages**: Static pages in `src/pages/` (index, quotes, projects). Blog uses dynamic routing via `[...slug].astro`.

### Styling

Custom Tailwind theme in `tailwind.config.mjs`:
- Colors: `bg` (cream background), `text-*` (gray scale), `froly-*` (coral accent for hover states)
- Fonts: Roboto (sans), Source Code Pro (mono)

### Adding Content

- **New quote**: Add object to the `quotes` array in `src/pages/quotes.astro`
- **New blog post**: Create MDX file in `src/content/blog/` with frontmatter: `title`, `tags`, `published` (date)
- **New font**: Install via fontsource (`npm install @fontsource/font-name`), import in Layout.astro
