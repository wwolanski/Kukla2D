import { readFileSync } from 'fs';
import { resolve, basename } from 'path';
import { gzipSync } from 'zlib';

const distDir = resolve(process.cwd(), 'dist');
const BUDGET_JS_GZIP_KB = 340;
const FORBIDDEN_INITIAL_KEYWORDS = ['onnx', 'jszip', 'live2d', 'spine'];

const htmlContent = readFileSync(resolve(distDir, 'index.html'), 'utf-8');

const initialJsFiles = [];
for (const match of htmlContent.matchAll(/src="([^"]+\.js)"/g)) {
  initialJsFiles.push(resolve(distDir, match[1].replace(/^\//, '')));
}

const modulepreloadFiles = [];
for (const match of htmlContent.matchAll(/rel="modulepreload"[^>]*href="([^"]+\.js)"/g)) {
  modulepreloadFiles.push(resolve(distDir, match[1].replace(/^\//, '')));
}

function gzipSize(filePath) {
  try {
    return gzipSync(readFileSync(filePath)).length;
  } catch {
    return null;
  }
}

function formatKb(bytes) {
  return (bytes / 1024).toFixed(1);
}

let totalInitialGzip = 0;
const initialEntries = [];
for (const file of initialJsFiles) {
  const gz = gzipSize(file);
  if (gz === null) {
    console.error(`Could not read: ${file}`);
    continue;
  }
  totalInitialGzip += gz;
  initialEntries.push({ name: basename(file), gzip: gz });
}

let hasForbiddenInitial = false;
for (const { name } of initialEntries) {
  const lower = name.toLowerCase();
  for (const forbidden of FORBIDDEN_INITIAL_KEYWORDS) {
    if (lower.includes(forbidden)) {
      hasForbiddenInitial = true;
      console.error(`BUDGET VIOLATION: Initial chunk "${name}" contains forbidden keyword "${forbidden}"`);
    }
  }
}

let exitCode = 0;

if (totalInitialGzip > BUDGET_JS_GZIP_KB * 1024) {
  console.error(`BUDGET VIOLATION: Initial JS gzip ${formatKb(totalInitialGzip)} kB > ${BUDGET_JS_GZIP_KB} kB`);
  exitCode = 1;
}

if (hasForbiddenInitial) {
  exitCode = 1;
}

const verdict = exitCode === 0 ? 'BUDGET OK' : 'BUDGET FAIL';
console.log(`\n=== Bundle Diagnostics ===`);
console.log(`\n${verdict}: Initial JS gzip ${formatKb(totalInitialGzip)} kB (budget: ${BUDGET_JS_GZIP_KB} kB)\n`);

console.log(`Initial script files (${initialEntries.length}):`);
for (const { name, gzip } of initialEntries) {
  console.log(`  ${formatKb(gzip).padStart(7)} kB gzip  ${name}`);
}

console.log(`\nModulepreload files (${modulepreloadFiles.length}):`);
for (const file of modulepreloadFiles) {
  const gz = gzipSize(file);
  const label = gz !== null ? `${formatKb(gz)} kB gzip` : 'unreadable';
  console.log(`  ${label.padStart(14)}  ${basename(file)}`);
}

process.exit(exitCode);
