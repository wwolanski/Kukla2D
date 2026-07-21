# Export Feature

Export is split into orchestration, pure planning, browser infrastructure, and UI:

```text
application/     use cases and React integration
domain/          export plans, frame specs, layout, and readiness rules
infrastructure/  encoders, file sinks, and format adapters
components/      export UI
```

Consumers import stable APIs from `@/features/export`. Other features must not import these internal directories.

## Pipeline

1. Resolve the selected animation and export area.
2. Build a validated raster or format-specific plan.
3. Capture evaluated frames through the canvas capture port.
4. Encode artifacts through the selected adapter.
5. Deliver files through the browser export sink.

PNG sequence, PNG spritesheet, GIF, and Phaser atlas are active. Live2D and Spine paths are experimental and must not be presented as supported output.

## Adding a format

- Keep planning deterministic and independent of React, DOM, and Pixi.
- Register user-visible capabilities in the variant registry.
- Put browser/file behavior behind infrastructure ports.
- Add unit tests for plans and serialization plus E2E coverage for the user path.
- Confirm the optional encoder remains outside the initial bundle.

Run `npm run check`, relevant export tests, and `npm run test:e2e` before changing a supported contract.
