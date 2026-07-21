import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(process.cwd());

describe('typescript migration — final state', () => {
  it('tsconfig include covers only TypeScript source files, not raw JSX', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const config = JSON.parse(readFileSync(tsconfigPath, 'utf-8')) as {
      compilerOptions?: Record<string, unknown>;
      include?: string[];
    };
    const include = config.include ?? [];
    expect(include).not.toContain('src');
    expect(include).toEqual(expect.arrayContaining([
      'src/**/*.ts',
      'src/**/*.tsx',
      'src/**/*.d.ts',
      'packages/**/*.ts',
      'packages/**/*.tsx',
      'packages/**/*.d.ts',
    ]));
  });

  it('strict typecheck covers every production TypeScript file with no JSX leakage', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const config = JSON.parse(readFileSync(tsconfigPath, 'utf-8')) as {
      include?: string[];
    };
    const include = config.include ?? [];
    const jsxPatterns = include.filter(p => p.includes('jsx'));
    expect(jsxPatterns).toHaveLength(0);
  });

  it('documented legacy Live2D boundary exists', () => {
    expect(existsSync(resolve(rootDir, 'src/io/live2d'))).toBe(true);
  });
});
