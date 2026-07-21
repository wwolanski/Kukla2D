# Test Fixtures

This directory contains test fixtures for Kukla2D interoperability tests.
Current project fixtures use `.kk2d`; legacy `.stretch` samples stay only for backwards-compatibility coverage.

## Manifest

The `manifest.json` file catalogs all fixtures with their licensing and usage metadata.

## Adding Fixtures

1. Create or obtain a fixture file (`.kk2d`, legacy `.stretch`, `.psd`, `.png`, `.json`, etc.)
2. Add a corresponding entry to `manifest.json` with all required fields
3. Place the fixture file in the appropriate subdirectory
4. Run `npm run test` to verify fixture loads correctly

## Rules

- **No proprietary binaries in CI:** Commercial project files from Spine, DragonBones, or Cubism may NOT be committed to the repository without explicit license confirmation in ADR 0001 D3.
- **Own fixtures preferred:** Create minimal test fixtures from scratch rather than copying from commercial tools.
- **License field required:** Every fixture entry MUST have a non-empty `license` field. Entries with empty license are not valid.
- **CI gating:** Fixtures with `allowedInCi: false` are excluded from CI runs but may be used locally for manual testing.

## Directory Structure

```
test/fixtures/
├── README.md          # This file
├── manifest.json      # Fixture catalog
├── kk2d_legacy/       # legacy .stretch project fixtures
├── psd/               # PSD import fixtures
├── png/               # PNG import fixtures
├── spine/             # Spine format fixtures (if D3 allows)
├── dragonbones/       # DragonBones format fixtures (if D3 allows)
└── reference/         # Golden reference outputs
```

## Fixture Entry Schema

```json
{
  "id": "unique-fixture-id",
  "filename": "path/to/file.ext",
  "license": "CC0-1.0 | MIT | proprietary-license-id | BLOCKED",
  "source": "description of how fixture was created or obtained",
  "expectedFeatures": ["FEATURE_ID_1", "FEATURE_ID_2"],
  "allowedInCi": true,
  "notes": "optional additional information"
}
```

## Status

All fixtures are currently **BLOCKED** pending ADR 0001 D3 resolution (legal fixtures and runtime SDK licenses). Minimal self-created fixtures will be added as stages progress.
