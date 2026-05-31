# Broken parent/child links to fix

Scan of every `parentId` and child `entryId` across all 1966 entries. A link breaks when the target ID doesn't exist, the letter points to the wrong page, or the letter is omitted but the target is on another page. To-do list: **delete each item as fixed. No fixes applied yet.**

**Totals:** dangling parentId 14 · wrong parentLetter 0 · missing parentLetter (cross-page) 1 · dangling child entryId 3 · wrong child entryLetter 0 · missing child entryLetter (cross-page) 0 — **18 total**

**Missing IDs referenced more than once** (one underlying entry to identify fixes several links): `Shadrack04` ×3 · `Daniel02` ×3 · `AaronF01` ×2

---

## Dangling `parentId` — points to a non-existent entry (14)

### BeverlyL01 — Beverly Lawrence
- [b/BeverlyL01.yaml](src/content/genealogy/b/BeverlyL01.yaml)
- broken: `parentId: MitchellO01` (letter `M`)
- parentDesc: `Mitchell O. Vining and Clara Clark`
- candidate(s): _none — parent entry may not exist; consider de-linking_

### CarltonB01 — Carlton Berry
- [c/CarltonB01.yaml](src/content/genealogy/c/CarltonB01.yaml)
- broken: `parentId: Augustus03` (letter `A`)
- parentDesc: `Augustus Vining and Sarah E. Williams`
- candidate(s): `Augustus01` (Augustus Vining · A), `AugustusG01` (Augustus Gilmer Vining · A), `AugustusG02` (Augustus Gallatin Vining · A)

### CharlesW04 — Charles Warren
- [c/CharlesW04.yaml](src/content/genealogy/c/CharlesW04.yaml)
- broken: `parentId: Shadrack04` (letter `S`)
- parentDesc: `Shadrack Vining and Nancy M. Clifton`
- candidate(s): `Shadrack01` (Shadrack Vining · S), `Shadrack02` (Shadrack Vining · S), `ShadrackJ01` (Shadrack Joshua Vining · S), `ShadrackJ02` (Shadrack Vining · S), `ShadrackJr01` (Shadrack Jr. Vining · S)

### CorneliusW01 — Cornelius W.
- [c/CorneliusW01.yaml](src/content/genealogy/c/CorneliusW01.yaml)
- broken: `parentId: Daniel02` (letter `D`)
- parentDesc: `Daniel Vining and Lydia? [...]`
- candidate(s): `Dan01` (Dan Vining · D), `Daniel01` (Daniel Vining · D), `Daniel03` (Daniel Vining · D), `Daniel04` (Daniel Vining · D), `Daniel05` (Daniel Vining · D), `DanielH01` (Daniel Hervey Vining · D)

### DonaldE01 — Donald Erhart
- [d/DonaldE01.yaml](src/content/genealogy/d/DonaldE01.yaml)
- broken: `parentId: William04` (letter `W`)
- parentDesc: `William Vining and Charlotte M. Higgins`
- candidate(s): `William01` (William Vining · W), `William02` (William Vining · W), `William03` (William Vining · W), `William06` (William Vining · W), `William07` (William Vining · W), `William08` (William Vining · W)

### GeorgeH04 — George H.
- [g/GeorgeH04.yaml](src/content/genealogy/g/GeorgeH04.yaml)
- broken: `parentId: unknown03` (letter `UNKNOWN`)
- parentDesc: `[?]`
- candidate(s): _none — parent entry may not exist; consider de-linking_

### HarmonR01 — Harmon R[ummell?].
- [h/HarmonR01.yaml](src/content/genealogy/h/HarmonR01.yaml)
- broken: `parentId: JOHNC01` (letter `J`)
- parentDesc: `John Chester Vining and Annie O. Wicks`
- candidate(s): `John01` (John Vining · J), `John02` (John Vining · J), `John03` (John Vining · J), `John04` (John Vining · J), `John05` (John Vining · J), `John06` (John Vining · J)

### JeffersonT01 — Jefferson T.
- [j/JeffersonT01.yaml](src/content/genealogy/j/JeffersonT01.yaml)
- broken: `parentId: GM02` (letter `G`)
- parentDesc: `G. M. Troop Vining and Lucy M. [&#8230;]`
- candidate(s): _none — parent entry may not exist; consider de-linking_

### JosephE02 — Joseph Eason
- [j/JosephE02.yaml](src/content/genealogy/j/JosephE02.yaml)
- broken: `parentId: Daniel02` (letter `D`)
- parentDesc: `Daniel Vining and Lydia? [...]`
- candidate(s): `Dan01` (Dan Vining · D), `Daniel01` (Daniel Vining · D), `Daniel03` (Daniel Vining · D), `Daniel04` (Daniel Vining · D), `Daniel05` (Daniel Vining · D), `DanielH01` (Daniel Hervey Vining · D)

### LouisD01 — Louis D.
- [l/LouisD01.yaml](src/content/genealogy/l/LouisD01.yaml)
- broken: `parentId: CharlesB03` (letter `C`)
- parentDesc: `Charles B. Vining and Jane [&#8230;]`
- candidate(s): `Charles01` (Charles Vining · C), `Charles02` (Charles Vining · C), `Charles03` (Charles Vining · C), `Charles04` (Charles Vining · C), `Charles05` (Charles Vining · C), `Charles06` (Charles Vining · C)

### PeterL01 — Peter Lafayette
- [p/PeterL01.yaml](src/content/genealogy/p/PeterL01.yaml)
- broken: `parentId: Shadrack04` (letter `S`)
- parentDesc: `Shadrack Vining and Nancy M. Clifton`
- candidate(s): `Shadrack01` (Shadrack Vining · S), `Shadrack02` (Shadrack Vining · S), `ShadrackJ01` (Shadrack Joshua Vining · S), `ShadrackJ02` (Shadrack Vining · S), `ShadrackJr01` (Shadrack Jr. Vining · S)

### Roberta01 — Roberta
- [r/RobertaVining01.yaml](src/content/genealogy/r/RobertaVining01.yaml)
- broken: `parentId: Doug01` (letter `D`)
- parentDesc: `Doug Vining and Alcena Kaye Lybyer`
- candidate(s): `DouglasE01` (Douglas Earl Vining · D), `DouglasF01` (Douglas Frederick Vining · D), `DouglasH01` (Douglas Herbert Vining · D), `DouglasM01` (Douglas Marquardt Vining · D), `DouglasN01` (Douglas Nathan Vining · D), `DouglasR01` (Douglas Robert Vining · D)

### WilliamA04 — William Aaron
- [w/WilliamA04.yaml](src/content/genealogy/w/WilliamA04.yaml)
- broken: `parentId: AaronF01` (letter `A`)
- parentDesc: `Aaron Farley Fining and Ida E. Lang`
- candidate(s): _none — parent entry may not exist; consider de-linking_

### WilliamH12 — William H.
- [w/WilliamH12.yaml](src/content/genealogy/w/WilliamH12.yaml)
- broken: `parentId: Shadrack04` (letter `S`)
- parentDesc: `Shadrack Vining and Nancy M. Clifton`
- candidate(s): `Shadrack01` (Shadrack Vining · S), `Shadrack02` (Shadrack Vining · S), `ShadrackJ01` (Shadrack Joshua Vining · S), `ShadrackJ02` (Shadrack Vining · S), `ShadrackJr01` (Shadrack Jr. Vining · S)

---

## Missing `parentLetter` — same-page anchor, but parent is on another page (1)

- JeffersonD01 ([j/JeffersonD01.yaml](src/content/genealogy/j/JeffersonD01.yaml)): `parentId: Vincent01` is on **V**, entry on **J** → add `parentLetter: V`
---

## Dangling child `entryId` — points to a non-existent entry (3)

### "Daniel Vining" in Ebenezer01
- [e/Ebenezer01.yaml](src/content/genealogy/e/Ebenezer01.yaml)
- broken: `entryId: Daniel02` (letter `D`)
- candidate(s): `Dan01` (Dan Vining · D), `Daniel01` (Daniel Vining · D), `Daniel03` (Daniel Vining · D), `Daniel04` (Daniel Vining · D), `Daniel05` (Daniel Vining · D), `DanielH01` (Daniel Hervey Vining · D)

### "Jehu Vining" in Shadrack01
- [s/Shadrack01.yaml](src/content/genealogy/s/Shadrack01.yaml)
- broken: `entryId: Jehu01` (letter `J`)
- candidate(s): `JehuS01` (Jehu S. Vining · J)

### "Aaron Farley Vining" in WilliamP01
- [w/WilliamP01.yaml](src/content/genealogy/w/WilliamP01.yaml)
- broken: `entryId: AaronF01` (letter `A`)
- candidate(s): _none — entry may not exist; consider removing the entryId_

