# Family Tree

## Fictional GEDCOM X editor

The default page (also `/?editor`) loads the ignored local `family-tree.gedcomx.json`, falling back to fictional people when it is absent. Use `/?demo` to explicitly load fictional data without requesting private files. The original viewer remains at `/?legacy`. Open accepts GEDCOM X JSON with local person/relationship IDs and references; this is a supported-subset check, not a complete GEDCOM X standards validator.

Run `node --experimental-strip-types convert-legacy.mjs` to create a private GEDCOM X copy of `family-tree.json`. It refuses to overwrite an existing destination. Unknown `?` placeholders are omitted, parentage types are left unspecified, and partnerships do not imply marriage. The original file is preserved. Save copy downloads updates; it does not overwrite the local server file automatically.

Edit a person's primary full name, select an existing couple, and append marriage/divorce facts. The unified tree updates after applying edits, adding events, undoing, or opening a file. Click a person in the tree to select them in the editor. Nodes use stable GEDCOM X IDs, so duplicate names remain separate people. Parent-child assertions are drawn independently of partnership history; the viewer does not infer parentage from marriage. Unrecognized relationship types remain in the saved document but are not drawn.

Save copy downloads a document; reopen that download to confirm the saved contents. Other fields are retained, except parsed name parts on the primary name form when its full name is replaced. Undo reverses applied changes. Download initiation cannot confirm disk persistence, so the unsaved indicator remains until a file is reopened.

Run `npx playwright test` for the fictional browser round trip (requires installed Google Chrome). `npm test` also verifies a disk save/reopen, stable IDs, repeated marriages, and extension preservation. No real-data migration is performed.

React and TypeScript UI powered by Vite, with an independent JavaScript family layout engine.

Run `npm install`, then `npm run dev`. Open the local URL printed by Vite.

The legacy development page loads `family-tree.json` if present, otherwise the fictional `family-tree.template.json`. Both private data files are ignored by Git and are not bundled in production builds. File inputs load documents into browser memory without uploading them.

Use `npm test` for the fictional layout fixtures, `npm run typecheck` for TypeScript, and `npm run build` for a production build in `dist`.

The hybrid layout expands each family once and uses compact references for repeated families. Layout algorithms remain in `family-layout.js` during the initial React migration.
