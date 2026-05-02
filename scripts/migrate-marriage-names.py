#!/usr/bin/env python3
"""
Migrate marriage entries from name-in-date pattern to proper spouse field.

Two patterns are normalized:

1. Top-level (head) marriages with structured spouse object:

     marriages:
       - date: Louise Chatfield     # name in wrong field
         spouse:
           birth: ...

   becomes:

     marriages:
       - spouse:
           givenName: Louise
           surname: Chatfield
           birth: ...

2. Child marriages where spouse is just a string:

     marriages:
       - date: "[...] Preston"

   becomes:

     marriages:
       - spouse: "[...] Preston"

The renderer in src/renderEntry.ts must also be updated so that numbered
head marriages with no marriage date render the spouse name inline on
the "m. (1)" line. Without that change, numbered marriages will gain
extra vertical whitespace after migration. (Unnumbered head marriages
and child marriages already render correctly with the new structure.)

Usage:
    pip install ruamel.yaml
    python3 scripts/migrate-marriage-names.py L            # dry-run letter L
    python3 scripts/migrate-marriage-names.py L --apply    # write changes for letter L
"""

import argparse
import re
import sys
from pathlib import Path

try:
    from ruamel.yaml import YAML
    from ruamel.yaml.comments import CommentedMap
except ImportError:
    sys.exit("requires ruamel.yaml: python3 -m pip install ruamel.yaml")

GENEALOGY_DIR = Path("src/content/genealogy")

# A value in `date:` is a real date (not a misplaced name) if it:
#   - contains any digit (covers years, ages, full dates)
#   - starts with date-prefix keywords
#   - equals an "unknown date" placeholder
DATE_RE = re.compile(
    r'\d'
    r'|^ca\.'
    r'|^age\b'
    r'|^before\b'
    r'|^after\b'
    r'|January|February|March|April|May|June'
    r'|July|August|September|October|November|December'
)
PLACEHOLDER_DATES = {'?', '[?]'}


def is_real_date(value):
    """True if `value` looks like a date (or unknown-date placeholder), not a name."""
    if not isinstance(value, str):
        return False
    if value.strip() in PLACEHOLDER_DATES:
        return True
    return bool(DATE_RE.search(value))


def split_name(full_name):
    """
    Split a full name into (givenName, surname, from_suffix).

    Handles trailing "(of LOCATION)" which becomes the `from` field.
    Splits remaining on last whitespace: last token = surname, rest = givenName.
    Single-word names go entirely into givenName.
    """
    name = full_name.strip()
    from_suffix = None

    # Pull out trailing "(of ...)" suffix
    m = re.search(r'\s*\(of\s+([^)]+)\)\s*$', name)
    if m:
        from_suffix = m.group(1).strip()
        name = name[:m.start()].strip()

    parts = name.split()
    if not parts:
        return name, None, from_suffix
    if len(parts) == 1:
        return parts[0], None, from_suffix
    return ' '.join(parts[:-1]), parts[-1], from_suffix


def migrate_head_marriage(m):
    """
    Migrate one top-level marriage dict in place.
    Returns True if changed.
    """
    if not isinstance(m, dict):
        return False
    date = m.get('date')
    if not date or is_real_date(date):
        return False
    spouse = m.get('spouse')
    if isinstance(spouse, dict) and spouse.get('givenName'):
        return False  # already structured properly

    given, surname, from_suffix = split_name(date)

    if isinstance(spouse, CommentedMap) or isinstance(spouse, dict):
        # Inject given/surname/from at the front of existing spouse map
        new_spouse = CommentedMap()
        new_spouse['givenName'] = given
        if surname:
            new_spouse['surname'] = surname
        if from_suffix:
            new_spouse['from'] = from_suffix
        for k, v in spouse.items():
            if k not in new_spouse:
                new_spouse[k] = v
        m['spouse'] = new_spouse
    else:
        new_spouse = CommentedMap()
        new_spouse['givenName'] = given
        if surname:
            new_spouse['surname'] = surname
        if from_suffix:
            new_spouse['from'] = from_suffix
        m['spouse'] = new_spouse

    del m['date']
    return True


def migrate_child_marriage(m):
    """
    Migrate one child marriage dict in place.
    Returns True if changed.
    """
    if not isinstance(m, dict):
        return False
    date = m.get('date')
    if not date or is_real_date(date):
        return False
    if m.get('spouse'):
        return False  # already has spouse string
    m['spouse'] = date
    del m['date']
    return True


def process_file(path, yaml_io, apply):
    text = path.read_text()
    try:
        data = yaml_io.load(text)
    except Exception as e:
        print(f"  PARSE ERROR {path}: {e}", file=sys.stderr)
        return 0, 0
    if not isinstance(data, (dict, CommentedMap)):
        return 0, 0

    head_changes = 0
    child_changes = 0

    for m in (data.get('marriages') or []):
        if migrate_head_marriage(m):
            head_changes += 1

    for grp in (data.get('childrenGroups') or []):
        for child in (grp.get('children') or []):
            for m in (child.get('marriages') or []):
                if migrate_child_marriage(m):
                    child_changes += 1

    total = head_changes + child_changes
    if total and apply:
        with path.open('w') as f:
            yaml_io.dump(data, f)
    return head_changes, child_changes


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('letter', help='Single letter (A-Z) to migrate')
    parser.add_argument('--apply', action='store_true', help='Write changes to disk (default: dry-run)')
    parser.add_argument('--dir', default=str(GENEALOGY_DIR), help='Genealogy root directory')
    args = parser.parse_args()

    if len(args.letter) != 1 or not args.letter.isalpha():
        sys.exit(f"letter must be a single A-Z character, got {args.letter!r}")

    letter_dir = Path(args.dir) / args.letter.lower()
    if not letter_dir.is_dir():
        sys.exit(f"no such directory: {letter_dir}")

    yaml_io = YAML(typ='rt')
    yaml_io.preserve_quotes = True
    yaml_io.width = 4096
    yaml_io.indent(mapping=2, sequence=4, offset=2)

    files = sorted(letter_dir.glob('*.yaml'))
    files_changed = 0
    total_head = 0
    total_child = 0

    for path in files:
        head, child = process_file(path, yaml_io, args.apply)
        if head or child:
            files_changed += 1
            total_head += head
            total_child += child
            print(f"  {path}: {head} head, {child} child")

    action = "changed" if args.apply else "would change"
    print()
    print(f"Letter {args.letter.upper()}: scanned {len(files)} files.")
    print(f"{action.capitalize()} {files_changed} files: {total_head} head marriages, {total_child} child marriages.")
    if not args.apply:
        print(f"Dry run. Re-run with: python3 scripts/migrate-marriage-names.py {args.letter.upper()} --apply")


if __name__ == '__main__':
    main()
