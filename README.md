# Family Tree

## Fictional GEDCOM X editor

Open `/?editor` on the Vite server for the isolated editor. It starts with fictional people and never fetches the private family file. Open accepts GEDCOM X JSON with local person/relationship IDs and references; this is a supported-subset check, not a complete GEDCOM X standards validator.

Edit a person's primary full name, select an existing couple, and append marriage/divorce facts. The unified tree updates after applying edits, adding events, undoing, or opening a file. Click a person in the tree to select them in the editor. Nodes use stable GEDCOM X IDs, so duplicate names remain separate people. Parent-child assertions are drawn independently of partnership history; the viewer does not infer parentage from marriage. Unrecognized relationship types remain in the saved document but are not drawn.

Save copy downloads a document; reopen that download to confirm the saved contents. Other fields are retained, except parsed name parts on the primary name form when its full name is replaced. Undo reverses applied changes. Download initiation cannot confirm disk persistence, so the unsaved indicator remains until a file is reopened.

Run `npx playwright test` for the fictional browser round trip (requires installed Google Chrome). `npm test` also verifies a disk save/reopen, stable IDs, repeated marriages, and extension preservation. No real-data migration is performed.

React and TypeScript UI powered by Vite, with an independent JavaScript family layout engine.

Run `npm install`, then `npm run dev`. Open the local URL printed by Vite.

The development page loads `family-tree.json` if present. This private file is ignored by Git and is not bundled in production builds. Without it, the page uses the fictional `family-tree.template.json`. The Open JSON input loads another file in browser memory without uploading or saving it.

Use `npm test` for the fictional layout fixtures, `npm run typecheck` for TypeScript, and `npm run build` for a production build in `dist`.

The hybrid layout expands each family once and uses compact references for repeated families. Layout algorithms remain in `family-layout.js` during the initial React migration.
