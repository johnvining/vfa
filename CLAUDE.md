# VFA Codebase Guide

## Genealogy YAML conventions

### `parentDesc` format
Father's full name (including Vining) and mother's **maiden name only** — no "Vining" for the mother.

Example: `parentDesc: "Daniel Rutledge Vining and Margaret McClanahan"`

### `rawArchival` field
Genealogy YAML files may contain a `rawArchival` field. This is a frozen snapshot of the entry's HTML from before the site transitioned to structured YAML rendering. **Never update it under any circumstances** — not even when other fields in the same entry change. It exists solely to preserve the pre-transition state. All live data is in the structured fields (`head`, `marriages`, `childrenGroups`, etc.), which are rendered by `src/renderEntry.ts`.

### Always update `lastUpdated` and add an `updates` entry
Whenever you modify a genealogy YAML entry, always: (1) update the `lastUpdated` field to today's date, and (2) add an entry to the `updates` array with the date, what changed, and the source URL if one exists.

### `updates` field
Use the `updates` field to record changes to an entry, including the source. **Always quote the date string** — unquoted ISO dates are parsed as Date objects by YAML. Put the source URL in a separate `url` field — never embed it in the `what` string. If the information was contributed by someone, credit them in `what`:
```yaml
updates:
  - date: "2026-04-29"
    what: "added Augusta's maiden name Gaetke; source: Findagrave record, contributed by Jean Vining Springer"
    url: "https://www.findagrave.com/memorial/43390292/augusta-marie-alexander"
```
These appear on the News and Notes page automatically as "Genealogy updates." **Do not create a manual news file for genealogy data changes** — the `updates` array handles that automatically.

### Letter page thanks
When someone contributes information, add their name to `src/content/letters/[X].yaml`:
```yaml
thanks: "Thank you to Jane Doe, Kimberly Kreider-Dusek, ..."
```
This appears on the letter's family page automatically.

### When to create a headname entry
A person listed as a child in their parent's entry should get their own YAML entry (headname) when we have enough information to fill it out — specifically when we know their spouse **and** their children. A child line with only a name and birth date stays inline; once we have a family to document, promote them to their own entry. When promoting, add `entryId` and `entryLetter` to the child line in the parent's entry, keep the child line brief (birth/death/marriage summary), and put the full family detail in the new file. New entries go in the folder for their first name's letter, and the ID follows the pattern `GivenNameInitials##` (e.g. `JohnE04`). The `updates` entry in the new file should say `"created entry"` with the source.

### `docsUrl` and genealogy-docs
Source documents (obituaries, census records, etc.) go in `src/content/genealogy-docs/[letter]/[ID].yaml`. Add `docsUrl: [Letter]sources/[ID]doc.htm` to the genealogy entry to link to the docs page. Captions in docs entries support HTML, so links to online sources can be included directly in the caption.

## News entries
News files live in `src/content/news/` and are named with the actual date they are added (e.g., `2026-04-27.md`), not the first of the month.

## Linking from news to genealogy
Use the format `Viningfamilies/[Letter]families.htm#[ID]` — e.g., `Viningfamilies/Dfamilies.htm#DanielRJr01`.
