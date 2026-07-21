import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Static guard for plan 17, stage 01 acceptance criterion #1:
 * "No code outside migration/fixture reads `track.nodeId`."
 *
 * v5 canonical track uses `targetId`. Any code reading `track.nodeId` /
 * `<trackVar>.nodeId` over an `animations[].tracks` collection silently
 * misses canonical tracks (duplicateNode/deleteNode/warp grid remap all
 * had this regression). This guard scans `src/` (excluding the v4->v5
 * migration boundary) for track-element `.nodeId` reads.
 */

/* eslint-disable no-undef */
const CWD = typeof process !== 'undefined' ? process.cwd() : '.';
const ROOT = join(CWD, 'src');
const ALLOW = ['src/schema/migrations/'];

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// Matches a track element variable reading `.nodeId` inside a tracks
// collection callback or direct track-typed property reads.
const TRACK_NODE_ID_READ = [
  /\.tracks\s*(?:\.\w+\s*)?\(\s*\(?(\w+)\)?\s*=>\s*\1\.nodeId\b/g,
  /\btrack\.nodeId\b/g,
  /\bt\.nodeId\b/g,
];

function collectViolations() {
  const files = walk(ROOT, []);
  const violations = [];
  for (const file of files) {
    const rel = relative(CWD, file).replace(/\\/g, '/');
    if (ALLOW.some((p) => rel.startsWith(p))) continue;
    const text = readFileSync(file, 'utf8');
    for (const re of TRACK_NODE_ID_READ) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const line = text.slice(0, m.index).split('\n').length;
        violations.push(`${rel}:${line}: ${m[0]}`);
      }
    }
  }
  return violations;
}

describe('plan17 stage01 canonical track binding guard', () => {
  it('no src/ file outside migrations reads track.nodeId', () => {
    const violations = collectViolations();
    expect(violations).toEqual([]);
  });
});