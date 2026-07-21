# Initial Bundle Budget

## Decision

Initial JavaScript must remain at or below **340 kB gzip**. Heavy optional exporters and format libraries must not enter the initial script.

`scripts/check-bundle-budget.mjs` reads Vite's generated `dist/index.html`, measures initial scripts, and rejects initial chunk names containing `onnx`, `jszip`, `live2d`, or `spine`.

## Why

Kukla2D has a large graphics runtime, but project loading, export encoders, and experimental format support are task-specific. Keeping them behind dynamic boundaries improves startup cost and makes accidental bundle regressions visible in CI.

## Validation

```bash
npm run build
node scripts/check-bundle-budget.mjs
```

Raise the limit only with measured evidence and an update to this decision.
