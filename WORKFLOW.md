# Astro Conversion Workflow

The `astro` branch contains the Astro version of the site. `main` is the untouched static original — permanent ground truth.

## Converting a page

1. Find the original `.htm` file in the repo root (e.g. `Viningresearchproblemshome.htm`)
2. Create a matching `.astro` file in `src/pages/` with the same base name
3. Wrap the page body in `<Base>`, passing `title`, `description`, `keywords`, and `activePage`
4. Build: `npm run build`
5. Diff: `node textdiff.mjs ../<pagename>.htm dist/<pagename>.htm`
6. If clean, commit. If not, fix and repeat from step 4.

## Commands

```
# from astro-src/
npm run build
node textdiff.mjs ../Viningfamilieshome.htm dist/Viningfamilieshome.htm
```

## What the build does

`npm run build` runs Astro, then `rename-htm.mjs` renames all `.html` output to `.htm` so URLs match the original site.

## What textdiff does

Strips all HTML tags and normalizes whitespace, then compares the visible text content of the original and the built output. Formatting differences are ignored — only content matters.

## Nav active state

Pass `activePage` matching the label exactly (e.g. `activePage="Online Genealogy"`). The layout renders that item as plain text; all others as links.
