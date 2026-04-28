# VFA Codebase Guide

## Genealogy YAML conventions

### `parentDesc` format
Father's full name (including Vining) and mother's **maiden name only** — no "Vining" for the mother.

Example: `parentDesc: "Daniel Rutledge Vining and Margaret McClanahan"`

### `rawArchival` field
Genealogy YAML files may contain a `rawArchival` field. This is a frozen snapshot of the entry's HTML from before the site transitioned to structured YAML rendering. **Never update it under any circumstances** — not even when other fields in the same entry change. It exists solely to preserve the pre-transition state. All live data is in the structured fields (`head`, `marriages`, `childrenGroups`, etc.), which are rendered by `src/renderEntry.ts`.

### `updates` field
Use the `updates` field to record changes to an entry, including the source. **Always quote the date string** — unquoted ISO dates are parsed as Date objects by YAML:
```yaml
updates:
  - date: "2026-04-27"
    what: "added death, wife, and children; source: obituary in The Retrospect, 21 April 2026"
```
These appear on the News and Notes page automatically as "Genealogy updates."

### `docsUrl` and genealogy-docs
Source documents (obituaries, census records, etc.) go in `src/content/genealogy-docs/[letter]/[ID].yaml`. Add `docsUrl: [Letter]sources/[ID]doc.htm` to the genealogy entry to link to the docs page. Captions in docs entries support HTML, so links to online sources can be included directly in the caption.

## News entries
News files live in `src/content/news/` and are named with the actual date they are added (e.g., `2026-04-27.md`), not the first of the month.

## Linking from news to genealogy
Use the format `Viningfamilies/[Letter]families.htm#[ID]` — e.g., `Viningfamilies/Dfamilies.htm#DanielRJr01`.
