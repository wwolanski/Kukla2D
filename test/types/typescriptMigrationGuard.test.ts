import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const guardPath = resolve(process.cwd(), 'scripts/check-typescript-migration.mjs');
const temporaryRoots: string[] = [];

function createWorkspace(files: Record<string, string>, allowlist: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'kukla2d-typescript-migration-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(
    join(root, 'scripts/typescript-migration-allowlist.json'),
    JSON.stringify(allowlist),
  );
  for (const [path, content] of Object.entries(files)) {
    const absolutePath = join(root, path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
  return root;
}

function runGuard(root: string) {
  return spawnSync(process.execPath, [guardPath], {
    cwd: root,
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('TypeScript migration guard', () => {
  it('accepts the exact JavaScript allowlist and approved ambient declarations', () => {
    const root = createWorkspace({
      'src/legacy.js': 'export const legacy = true;\n',
      'src/current.ts': 'export const current: boolean = true;\n',
      'src/vite-env.d.ts': '/// <reference types="vite/client" />\n',
    }, ['src/legacy.js']);

    expect(() => execFileSync(process.execPath, [guardPath], { cwd: root })).not.toThrow();
  });

  it('rejects newly added production JavaScript', () => {
    const root = createWorkspace({
      'src/legacy.js': 'export const legacy = true;\n',
      'src/unlisted.js': 'export const unlisted = true;\n',
    }, ['src/legacy.js']);

    const result = runGuard(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unexpected production JavaScript');
    expect(result.stderr).toContain('src/unlisted.js');
  });

  it('rejects stale allowlist entries', () => {
    const root = createWorkspace({
      'src/current.ts': 'export const current: boolean = true;\n',
    }, ['src/already-migrated.js']);

    const result = runGuard(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Stale JavaScript allowlist entries');
  });

  it('rejects declarations that shadow local implementations', () => {
    const root = createWorkspace({
      'src/module.ts': 'export const value: number = 1;\n',
      'src/module.d.ts': 'export const value: number;\n',
    }, []);

    const result = runGuard(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Declarations shadowing local implementations');
    expect(result.stderr).toContain('src/module.d.ts');
  });
});
