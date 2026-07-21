import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(testDir, '../fixtures/boundaries');
const checker = resolve(testDir, '../../scripts/check-boundaries.mjs');

function runFixture(name) {
  try {
    return {
      status: 0,
      output: execFileSync(process.execPath, [checker], {
        env: { ...process.env, BOUNDARY_ROOT: resolve(rootDir, name) },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    };
  } catch (error) {
    return {
      status: error.status,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}`,
    };
  }
}

describe('check-boundaries feature internal imports', () => {
  it('fails cross-feature internal import with source, specifier, owner and public API', () => {
    const result = runFixture('cross-feature-fail');
    expect(result.status).toBe(1);
    expect(result.output).toContain('src/features/layers/components/Layer.jsx');
    expect(result.output).toContain('@/features/canvas/domain/picking');
    expect(result.output).toContain('feature canvas');
    expect(result.output).toContain('@/features/canvas');
  });

  it('fails internal import from outside a feature', () => {
    const result = runFixture('outside-feature-fail');
    expect(result.status).toBe(1);
    expect(result.output).toContain('src/store/editorStore.js');
    expect(result.output).toContain('@/features/canvas/domain/picking');
    expect(result.output).toContain('@/features/canvas');
  });

  it('allows same-feature internals and public feature barrels', () => {
    expect(runFixture('same-feature-pass').status).toBe(0);
    expect(runFixture('public-barrel-pass').status).toBe(0);
  });

  it('allows exact component import inside a literal app React.lazy loader', () => {
    expect(runFixture('app-modal-lazy-pass').status).toBe(0);
  });
});

describe('check-boundaries domain purity', () => {
  it('fails domain file that imports forbidden packages like react', () => {
    const result = runFixture('domain-purity-fail');
    expect(result.status).toBe(1);
    expect(result.output).toContain('react');
    expect(result.output).toContain('domain imports forbidden');
  });

  it('fails domain file that imports XState', () => {
    const result = runFixture('domain-purity-fail');
    expect(result.status).toBe(1);
    expect(result.output).toContain('xstate');
    expect(result.output).toContain('domain imports forbidden');
  });

  it('fails domain file that uses forbidden DOM globals', () => {
    const result = runFixture('domain-purity-fail');
    expect(result.status).toBe(1);
    expect(result.output).toContain('document');
    expect(result.output).toContain('domain uses forbidden global');
  });

  it('passes pure domain files with no forbidden imports or globals', () => {
    expect(runFixture('domain-purity-pass').status).toBe(0);
  });
});
