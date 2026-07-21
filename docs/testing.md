# Testing and Quality Gates

`npm run check` is the required local gate. It stops on the first failure and runs:

1. TypeScript compilation and graph coverage.
2. TypeScript migration guard.
3. ESLint with zero warnings.
4. Feature, package, and canvas boundary checks.
5. Knip dead-code and dependency analysis.
6. Vitest unit and integration tests.
7. Production build and initial JavaScript bundle budget.

Use focused commands while developing:

| Command | Purpose |
| --- | --- |
| `npm run lint` | Lint source, tests, scripts, and configuration. |
| `npm run typecheck` | Check the root TypeScript project. |
| `npm run test:unit` | Run Vitest once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:coverage` | Enforce configured coverage thresholds. |
| `npm run check:boundaries` | Enforce package and feature dependency direction. |
| `npm run check:canvas-boundaries` | Enforce canvas structure and file-size limits. |
| `npm run check:deadcode` | Run strict Knip dead-code and dependency analysis. |
| `npm run test:e2e` | Build and test the production app in Chromium. |

GitHub Actions separates the full gate, coverage, and E2E suites so failures remain easy to diagnose. Playwright uploads its HTML report only when E2E fails.
