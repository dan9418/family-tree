# Family Tree

A personal, file-based family tree editor and viewer built with React, TypeScript,
Vite, and Dagre. GEDCOM X JSON is the canonical document format. There is no
database, account system, cloud sync, or upload service.

## Run locally

The tested environment uses Node.js 22.17 and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The server binds to `127.0.0.1`. To request
another port, use `npm run dev -- --port 5174`.

| URL | Data and viewer |
| --- | --- |
| `/` or `/?editor` | GEDCOM X editor and unified tree; loads local `family-tree.gedcomx.json`, or fictional data if absent |
| `/?demo` | Fictional GEDCOM X data; does not request either private family file |
| `/?legacy` | Older JSON viewer; loads `family-tree.json`, falling back to `family-tree.template.json` |

## Edit and save

- Click a person or partnership block to open the edit dialog.
- Edit a person's primary name and birth/death dates. Year-only values and date
  text are accepted; dates are not restricted to complete calendar dates.
- Add marriage/divorce events or use an entry's pencil button to edit its date.
  Repeated marriages remain separate, ordered events.
- Apply changes to update the tree immediately. Undo reverses applied changes in
  the current session. Closing or switching away from an edited event warns about
  unapplied changes.
- Clearing a date preserves the recorded event and its other metadata; it does
  not delete the birth, death, marriage, or divorce assertion.
- **Save copy downloads a new file. It does not overwrite the server's local
  file.** Reopen the download to verify it. A download request cannot confirm a
  successful disk write, so the unsaved indicator remains until a file is opened.
- To load the edited document automatically next time, replace the local
  `family-tree.gedcomx.json` with the verified saved copy yourself. Keep backups.

The viewer supports search, zoom, fit, center-selected, and fullscreen. Hovering
or keyboard-focusing a person or partnership highlights its immediate family
connections and dims unrelated lines. This is not a recursive ancestry search.

Person labels show available birth/death years, with `?` for a missing endpoint.
A missing death date does not establish that someone is living. Partnership
blocks show compact event years; full event details remain in the dialog.

## Privacy and local files

These paths are ignored by Git:

- `family-tree.json`: original private legacy data.
- `family-tree.gedcomx.json`: private canonical document loaded by the editor.
- `test-results/` and `playwright-report/`: generated test artifacts, which can
  include screenshots or downloaded documents.

`family-tree.template.json` is tracked and must contain fictional data only.
Use fictional fixtures for committed tests, screenshots, examples, and bug reports.
Never place real family information in commit messages or tracked documentation.

File inputs read documents into browser memory without uploading them. Private
root data files are not bundled by `npm run build`. However, the development
server can serve them locally: **Git ignore rules are not access control or
encryption.** Do not expose the development server, copy private files into
`public/` or `dist/`, or deploy the entire working directory to public hosting.
Private hosting/storage and access control for family sharing remain a separate
deployment decision.

Earlier local history was scrubbed before the initial push. Preserve that boundary:
do not restore or push old backups containing personal data. Check staged paths
before every commit involving data files.

## Canonical data and preservation rules

GEDCOM X was chosen as an existing interchange foundation rather than extending
a custom family JSON schema. The app is deliberately a small editable subset,
not a complete genealogy management system or GEDCOM X validator.

- People and relationships have stable local IDs; references use `#id`. Names
  are labels, not identifiers, so duplicate names remain separate people.
- The viewer draws `Couple` and `ParentChild` relationships. Other relationship
  types and extension properties are retained when saved but are not visualized.
- Marriage/divorce history is independent of parentage. A partnership never
  creates a parent-child assertion or establishes biological parentage.
- Unknown parentage remains absent; an unknown parent is not fabricated.
- Renaming preserves alternate names but removes stale parsed `parts` from the
  edited primary name form.
- Changing a date preserves fact metadata but removes its old formal date to
  avoid retaining a contradictory normalized value. Unchanged dates are kept.
- Multiple birth/death facts are preserved; editing a conflicting date is blocked
  instead of arbitrarily overwriting one assertion. Event-date editing targets
  the selected marriage/divorce entry, not every event of that type.

The parser checks document structure, unique local IDs, references, names, and
fact/date shapes. It does not validate all GEDCOM X semantics, date expressions,
chronology, source references, or contradictory genealogical claims. Adoption
and other parentage qualifiers can be retained as data, but do not yet receive
distinct editing controls or connector styling.

### One-time legacy conversion

```sh
node --experimental-strip-types convert-legacy.mjs
```

This reads `family-tree.json`, creates `family-tree.gedcomx.json`, and refuses to
overwrite an existing destination. It preserves the source, transfers names,
birth/death values and notes, omits `?` placeholders, and converts explicit
partnership/parent assertions without inventing marriage or biological facts.
It is a migration helper, not ongoing synchronization between the two formats.

## Layout architecture

| File | Responsibility |
| --- | --- |
| `src/GedcomxEditor.tsx` | Document state, dialog drafts, undo, open/download, private-file startup |
| `src/gedcomx.ts` | Supported-subset validation and immutable document edits |
| `src/gedcomxGraph.ts` | GEDCOM X to visualization graph adapter |
| `src/relationships.ts` | Shared graph types and legacy JSON adapter |
| `src/unifiedLayout.ts` | Parent groups, Dagre ranking, geometry, routing, display-stroke merging |
| `src/UnifiedTree.tsx` | Rendering, navigation, fullscreen, hover/focus tracing |
| `src/years.ts` | Compact year-label formatting |
| `family-layout.js`, `src/main.tsx` | Legacy layout/viewer, not the default GEDCOM X experience |

React organizes rendering and editing; it does not solve graph layout itself.
Earlier hybrid mini-subtrees made family groupings understandable but introduced
repeated appearances. The current default uses a unified graph with horizontal
partnership components and downward ancestry ranking.

Routing invariants:

1. Build explicit parent groups from each child's exact recorded parent set
   before drawing lines. Group identity does not depend on assertion order.
2. Children branch from a partnership block only when exactly one recorded
   partnership matches that parent set. Multiple candidate records are not guessed.
3. Single-parent and unmatched/ambiguous parent sets use person-origin connectors
   joined by a shared parent-group line, without inventing a partnership.
4. Preserve semantic parent-child edges separately from rendered strokes. Merge
   overlapping strokes only within the same parent group, never by coordinates alone.
5. Allocate horizontal lanes using occupied spans and clearance, not a repeating
   fixed set of lanes. Expand vertical rank spacing for busy ancestry tiers.
6. Retain long routes across generations and detour obstructed ancestry segments
   around cards using a visibility grid and Dagre's shortest-path utility.
7. If ancestry and same-row partnership constraints conflict, use the conservative
   directed-graph fallback instead of dropping people or relationships. That
   fallback does not promise the normal horizontal partnership presentation.

Known limits: complex pedigrees can still have crossings; the layout is not a
crossing-free guarantee. Multiple partnerships can make a row very wide. Fit-all
can therefore make names tiny; zoom and path highlighting help inspection. Different
parentage types are not yet separate routing groups. Obstacle routing is more
expensive than simple sibling routing and should be profiled before scaling to
large genealogical datasets.

## Verification

```sh
npm test
npm run typecheck
npm run build
npx playwright test
```

The browser suite requires installed Google Chrome and starts its own Vite server
on `127.0.0.1:5180`; keep that port available. All committed browser fixtures use
fictional data. Screenshots and round-trip downloads go to ignored test outputs.

Unit coverage includes legacy relationships, stable IDs, document round trips,
metadata preservation, repeated marriages, date edits, explicit parent groups,
family-aware merging, wide lane allocation, half-siblings, unknown parents,
ambiguous partnerships, multi-generation routing, and card-intersection checks.
Browser coverage includes open/edit/save/reopen, undo, draft protection, dialogs,
mobile layout, fullscreen, shared sibling connectors, and hover/keyboard tracing.

When changing routing, check semantic edge preservation as well as screenshots:
a tidy drawing can still encode incorrect ancestry. Add fictional regressions for
any real-data issue rather than committing the original family document.

## Repository and follow-up work

`main` is the default integration branch. The React/Vite and GEDCOM X migration
has been merged; `master` was removed after verifying it contained no unique
commits. Use `codex/`-prefixed feature branches for future substantial work.

Potential next steps, not implemented promises:

- Event deletion with confirmation and undo.
- Creating/removing people and editing parent-child relationships in the app.
- Distinct adoption/other parentage displays and richer source/notes editing.
- Large-tree routing/performance fixtures and more crossing diagnostics.
- Private sharing and backup workflows without requiring a database unless that
  actually simplifies the personal-use application.
