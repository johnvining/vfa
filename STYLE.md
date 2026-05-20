# VFA Style Guide

A consolidated set of conventions for working in this repo. Pulls together rules from CLAUDE.md and accumulated feedback so the right call gets made the first time.

---

## 1. Workflow

The current mode of work is **updates** — individual additions/corrections to existing entries, driven by obituaries, contributor emails, and one-off research.

- **Do not commit.** The user handles all commits. Make the edits, leave them staged-or-not as you find them, and stop there.
- Do all editing inline in the main conversation — don't spawn background agents for genealogy edits.

---

## 2. Genealogy YAML — structure

### `parentDesc` format
Father's full name (including "Vining") and mother's **maiden name only** — no "Vining" for the mother.

```yaml
parentDesc: "Daniel Rutledge Vining and Margaret McClanahan"
```

### Never update `rawArchival`
The `rawArchival` field is a frozen legacy plain-text snapshot of the entry from before the site transitioned to structured YAML rendering. **Never modify it under any circumstances**, even when the structured fields change. Live data lives in `head`, `marriages`, `childrenGroups`, etc., and is rendered by `src/renderEntry.ts`.

### Headnames — when and how

**When to create a headname entry.** A person listed as a child in their parent's entry gets their own YAML headname as soon as we know they have **children of their own who carry the Vining surname**. Spouse is not required — known Vining-surnamed children alone is the trigger. Until there are such children, they stay inline as a child of the parent's entry.

The site itself frames the rule this way: *"Family units are arranged alphabetically by the first name of the Vining father (or single-parent mother)"* (rendered intro text on every letter page). So headname entries exist for **Vining fathers** and for **single-parent mothers whose children retained the Vining surname** — nothing else.

**File location and ID pattern.**
- New entries live in the folder for the **first name's first letter** (e.g. `John...` → `src/content/genealogy/j/`).
- The ID follows `GivenNameInitials##` — given name plus any middle initials, then a two-digit sequence: `JohnE04`, `MaryAB02`, `Allen03`.
- The filename matches the ID: `JohnE04.yaml`.

**When promoting an inline child to a headname:**
- Add `entryId` and `entryLetter` to the child line in the parent's entry so it links to the new headname.
- Keep the child line brief in the parent: a short birth/death/marriage summary is enough.
- Put the full family detail (spouse fields, children, sources, etc.) in the new file.
- In the new file, set the `updates` entry to `"created entry"` with the source URL.
- Promotion is a **structural change** — no `contributed by` credit, no letter-page `thanks` addition (see Section 3).

### Spouse modifier fields

A few non-obvious spouse fields render as parenthetical modifiers next to the name:

- **`from:`** → `"(of HOMETOWN)"`. Use for the spouse's **place of origin** before the marriage (where they came from), not their current or last residence.
- **`nee:`** → `"(née MAIDEN)"`. Use when the source gives a maiden name distinct from the recorded surname.
- **`widowOf:`** → renders as a separate `m. PRIOR_SPOUSE` line beneath the spouse. Use for a spouse's prior marriage(s); semicolon-separated for multiple.

### `docsUrl` and the `genealogy-docs` folder
Source documents (obituaries, census records, headstones, etc.) live in `src/content/genealogy-docs/[letter]/[ID].yaml`. Add `docsUrl: [Letter]sources/[ID]doc.htm` to the genealogy entry to link to its docs page. Captions in docs entries support HTML — links to online sources can be embedded directly.

**Keep captions barebones.** Identify the source (publication + date, or cemetery + location) and what is pictured. Do **not** narrate the document's content, list named people from inside the image, or summarize the facts it contains. The image carries its own content; the structured genealogy YAML carries the extracted facts. Good: `"Marriage announcement for X and Y, Lewisburg Journal, Thursday, June 23, 1932:"`. Bad: anything that goes on to describe who married, where, who witnessed, what the document says.

---

## 3. The `updates` array

### Always required when editing an entry
Every time a genealogy YAML entry is modified, **always**:
1. Bump `lastUpdated` to today's date.
2. Add an entry to the `updates` array describing the change.

### Structure
```yaml
updates:
  - date: "2026-04-29"
    what: "added Augusta's maiden name; source: Findagrave record, contributed by Jean Vining Springer"
    url: "https://www.findagrave.com/memorial/43390292/augusta-marie-alexander"
```

- **Quote the date** — unquoted ISO dates get parsed as Date objects by YAML.
- **`url` is a separate field** — never embed the URL inside `what`.
- **Keep `what` succinct. Default to omitting values.** Describe what changed — name the fields and people affected — but do not echo the actual dates, places, or names. Those are already visible in the surrounding YAML. Repeating them is noise.
  - Good: `"added daughter X's death and burial info; added spouses for brothers A, B, C, and D"`
  - Bad: `"added daughter X's death (16 May 2025, Oak Grove, LA; bur. Red Wing Cemetery) and spouses Ella Dean (A's wife), Dot (B's), ..."`
- **The test, applied strictly:** before writing any value, ask *"would a reader looking at the new YAML be unable to understand what changed without this value being repeated here?"* If no → omit. If unsure → omit. The bias is toward omission, not inclusion.
- **Source attribution ≠ value disclosure.** Naming the source ("from X's obituary," "per 1950 census") is useful metadata and belongs in `what` (or in the `url` field). It does *not* license including the value alongside it. Good: `"added birthplace from father's obituary"`. Bad: `"added birthplace (West Virginia, from father's obituary)"`. The first is source attribution; the second smuggles the value in under that cover.
- **Never use internal IDs in `what` strings.** Entry IDs like `RobertL02`, `JohnE04`, `HelenR01` are internal references for the YAML structure — the `what` field renders publicly on the News and Notes page. Refer to people by name and relationship ("father," "brother," "wife"), not by ID. Good: `"propagated from brother Robert Lucius's update"`. Bad: `"propagated from RobertL02 update"`.
- **Exception, narrow: corrections and replacements.** When a change replaces a previously incorrect, unsourced, or confusing value, name the old or new value so the changelog is intelligible. This is the *only* case where including a value is allowed. Examples:
  - `"corrected Augusta's birth year from 1923 to 1924 per Find A Grave headstone"`
  - `"replaced unsourced maiden name 'Smith' with 'Schmidt' from 1880 census"`
  - `"standardized birthplace spelling from 'Maple Crest' to 'Maplecrest'"`
  Routine additions — "added birthplace," "added death date," "added spouse" — never qualify, even when the field was previously empty. The new value is in the YAML, not in the changelog.
- **Open questions are welcome.** If something has been researched but not resolved, record it in `what` so the next person knows where to pick up. Use a clear "open question:" prefix:
  - `"added Mary's death date; open question: two Mary Vinings appear in 1900 census for Tangipahoa Parish — could not confirm which is ours"`
  - `"created entry; open question: spouse appears as both 'Eliza Jane Cole' and 'Eliza J. Coyle' in different sources"`
  Don't fabricate certainty — flag what's uncertain.

### Crediting contributors
- **Actual new genealogy info from someone** (birth date, spouse, hometown, nickname, family member not there before) → credit them: `"contributed by NAME"` in `what`, **and** add their name to the letter-page `thanks`.
- **Pure structural changes** (promoting an inline child to a head entry, splitting marriages into multiple records, restructuring fields) → **no `contributed by` credit**. Reserve credits for actual new data.
- **Propagation entries** (you update entry B because of something a contributor flagged in entry A) → credit only on the entry where they explicitly identified the issue. Don't add `contributed by` to propagation entries, and don't add the contributor to the letter's `thanks` just because the propagation touched that letter.

---

## 4. Letter page thanks
When someone contributes new information, add their name to `src/content/letters/[X].yaml`:
```yaml
thanks: "Thank you to Jane Doe, Kimberly Kreider-Dusek, ..."
```
This renders automatically on the letter's family page. Only add names for real contributions — same rule as the `contributed by` credit: not for structural changes, not for propagation.

---

## 5. News and Notes

### Genealogy data changes propagate automatically
The `updates` array on each genealogy entry renders on the News and Notes page as "Genealogy updates" — **do not create a manual news file** for ordinary genealogy data changes.

### Passing-notice files (manual)
Passing-notice news files DO get written by hand. They live in `src/content/news/` and use the shared list format:

```markdown
---
date: 2026-05-12
season: "Spring 2026"
---
It is with great sadness that we note the passing of the following members of the Vining family:
<ul>
<li><a href="OBIT_URL" target="_blank">Full Name</a>, age N, of City, State, passed away on Day, Month D, Year. NAME was the [relation] of <a href="Viningfamilies/[L]families.htm#[ID]">Linked Vining ancestor</a>.</li>
</ul>
The Vining Family Association extends its deepest condolences to their families and friends.
```

**One passing-notice list per month.** There is exactly one passing-notice file open at a time — the current month's list. When a new passing comes in, append it as another `<li>` inside that file's existing `<ul>`. Never create a second passing-notice file for the same month, and never create a new dated file just because a few days have passed. A new passing-notice file is only created when starting a fresh month's list.

**All other news goes in separate files.** Announcements, reunion notices, genealogy commentary, or anything else that isn't a passing notice gets its own dated news file — never mix non-passing content into the passing-notice list.

Other rules for passing-notice files:
- **Use the `<ul><li>` wrapper and standard preamble/closing every time**, even for a single death. No freeform paragraph version.
- **Use the plural closing** "their families and friends" — never localize to "her family" / "his family."

### News file naming
When a genuinely new news file is needed, name it with the actual date it's added (e.g., `2026-04-27.md`), not the first of the month.

---

## 6. Links

### News → genealogy
```
Viningfamilies/[Letter]families.htm#[ID]
```
Example: `Viningfamilies/Dfamilies.htm#DanielRJr01`

### Production base URL
```
https://vining-family.org/
```
Full example: `https://vining-family.org/Viningfamilies/Tfamilies.htm#TheronN01`

---

## 7. Quick checklist before finishing an entry edit

- [ ] Modified only structured fields, not `rawArchival`
- [ ] Bumped `lastUpdated` to today
- [ ] Added an `updates` entry — quoted date, `url` in its own field, describes what changed (not values), credit rules applied correctly
- [ ] Letter-page `thanks` updated if a contributor provided real new info
- [ ] News passing-notice (if applicable) appended to the current month's existing list, in the shared format
- [ ] **Do not commit** — leave that to the user
