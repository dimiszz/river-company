# River Company

The user has authorized publishing the source code to GitHub in `dimiszz/river-company`.
The playable game remains LOCAL ONLY. Do not deploy it, enable GitHub Pages, or publish a hosted version unless the user explicitly requests website hosting.
Start the local preview with `npm run dev`.
An earlier private Sites deployment exists; it does not authorize additional hosting or deployment. Local hosting metadata under `.openai/` is not part of the maintained source.

## Source and checks
Maintain the TypeScript source under `src/`, the root `index.html`, and `vite.config.ts`. `dist/` is generated output. Preserve strict TypeScript checks. Run `npm run typecheck`, `npm test`, and `npm run build` for gameplay or architecture changes. Keep input handling singular so pointer/touch/keyboard events do not double-count boosts. Keep the upgrade shop mounted in both valley and interior views.

## Browser validation preference
Do not run Playwright validation after every code change. The user prefers faster iteration. Use it only when explicitly requested or when a specific browser behavior cannot be verified adequately through code review or targeted checks.
