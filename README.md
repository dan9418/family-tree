# Family Tree

React and TypeScript UI powered by Vite, with an independent JavaScript family layout engine.

Run `npm install`, then `npm run dev`. Open the local URL printed by Vite.

The development page loads `family-tree.json` if present. This private file is ignored by Git and is not bundled in production builds. Without it, the page uses the fictional `family-tree.template.json`. The Open JSON input loads another file in browser memory without uploading or saving it.

Use `npm test` for the fictional layout fixtures, `npm run typecheck` for TypeScript, and `npm run build` for a production build in `dist`.

The hybrid layout expands each family once and uses compact references for repeated families. Layout algorithms remain in `family-layout.js` during the initial React migration.
