#!/usr/bin/env node
/**
 * Canvas feature boundary + line limit check.
 *
 * Rules:
 *  - src/features/canvas/domain/** cannot import React/Zustand/DOM/WebGL/Worker/UI
 *  - src/features/canvas/infrastructure/** cannot import components/
 *  - src/features/canvas/components/** cannot import @/io/psd, @/io/projectFile,
 *    or infrastructure/mesh-worker
 *  - Every implementation file under src/features/canvas/** has at most 400 lines.
 *
 * Usage: node scripts/check-canvas-boundaries.mjs
 * Exits with code 1 on violations and 0 otherwise.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const BASE = join(ROOT, 'src', 'features', 'canvas');

const DOMAIN_FORBIDDEN = [
  'react',
  'zustand',
  '@/store/',
  '@/components/',
  '@/contexts/',
  '@/hooks/',
  '@/io/',
  '@/features/canvas/infrastructure/mesh-worker',
  'document',
  'window',
  'Worker',
  'Image',
];

const INFRASTRUCTURE_FORBIDDEN = [
  '@/features/canvas/components',
];

const COMPONENTS_FORBIDDEN = [
  '@/io/psd',
  '@/io/projectFile',
  '@/features/canvas/infrastructure/mesh-worker',
];

const MAX_LINES = 400;
const errors = [];

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function layerOf(rel) {
  const parts = rel.split(sep);
  const first = parts[0];
  if (['components', 'overlays', 'application', 'domain', 'infrastructure', 'config', 'testing'].includes(first)) {
    return first;
  }
  return null;
}

function checkImport(file, rel, layer) {
  const src = readFileSync(file, 'utf8');
  const importRegex = /(?:import\s+[^;]+?\sfrom\s+|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRegex.exec(src))) {
    const spec = m[1];
    if (layer === 'domain') {
      for (const tok of DOMAIN_FORBIDDEN) {
        if (spec === tok || spec.startsWith(tok)) {
          errors.push(`${rel}: domain imports "${spec}" (forbidden: ${tok})`);
          break;
        }
      }
    }
    if (layer === 'infrastructure') {
      for (const tok of INFRASTRUCTURE_FORBIDDEN) {
        if (spec === tok || spec.startsWith(tok)) {
          errors.push(`${rel}: infrastructure imports "${spec}" (forbidden: ${tok})`);
          break;
        }
      }
    }
    if (layer === 'components') {
      for (const tok of COMPONENTS_FORBIDDEN) {
        if (spec === tok || spec.startsWith(tok)) {
          errors.push(`${rel}: components imports "${spec}" (forbidden: ${tok})`);
          break;
        }
      }
    }
  }
}

function countLines(file) {
  const src = readFileSync(file, 'utf8');
  return src.split('\n').length;
}

function main() {
  // Boundary checks
  for (const file of walk(BASE)) {
    const rel = relative(ROOT, file);
    const layer = layerOf(relative(BASE, file).split(sep)[0]);
    if (!layer) continue;
    checkImport(file, rel, layer);
  }

  // Line limit checks (canvas feature paths)
  for (const file of walk(BASE)) {
    const lines = countLines(file);
    const rel = relative(ROOT, file);
    if (lines > MAX_LINES) {
      errors.push(`${rel}: ${lines} linii > limit ${MAX_LINES}`);
    }
  }

  if (errors.length) {
    console.error('Canvas boundary / line-limit errors:');
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log('check-canvas-boundaries: OK');
}

main();
