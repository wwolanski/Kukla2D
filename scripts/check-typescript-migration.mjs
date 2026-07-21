import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.env.TYPESCRIPT_MIGRATION_ROOT ?? process.cwd());
const sourceRoots = ['src', 'packages'];
const allowlistPath = join(root, 'scripts/typescript-migration-allowlist.json');
const allowedDeclarations = new Set([
  'src/features/export/infrastructure/gifenc.d.ts',
  'src/vite-env.d.ts',
]);
const allowedDeclarationPrefixes = [
  'src/io/live2d/',
];
const excludedJavaScriptPrefixes = [
  'src/features/canvas/testing/',
  'src/io/live2d/',
];

function normalize(path) {
  return path.replaceAll('\\', '/');
}

function collectFiles(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(path, files);
    else files.push(normalize(relative(root, path)));
  }
  return files;
}

function readAllowlist() {
  if (!existsSync(allowlistPath)) return [];
  const value = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  if (!Array.isArray(value) || value.some(path => typeof path !== 'string')) {
    throw new TypeError('TypeScript migration allowlist must be a JSON string array');
  }
  return [...value].sort();
}

function countLines(path) {
  const text = readFileSync(join(root, path), 'utf8');
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

function reportList(title, paths) {
  if (paths.length === 0) return;
  console.error(`${title}:`);
  for (const path of paths) console.error(`  - ${path}`);
}

const files = sourceRoots.flatMap(directory => collectFiles(join(root, directory))).sort();
const allowedJavaScript = readAllowlist();
const allowedJavaScriptSet = new Set(allowedJavaScript);
const productionJavaScript = files.filter(path => path.endsWith('.js')
  && !excludedJavaScriptPrefixes.some(prefix => path.startsWith(prefix)));
const unexpectedJavaScript = productionJavaScript.filter(path => !allowedJavaScriptSet.has(path));
const staleAllowlist = allowedJavaScript.filter(path => !productionJavaScript.includes(path));

const implementationFiles = files.filter(path => /\.(?:js|ts|tsx)$/.test(path)
  && !path.endsWith('.d.ts')
  && !excludedJavaScriptPrefixes.some(prefix => path.startsWith(prefix)));
const extensionsByBase = new Map();
for (const path of implementationFiles) {
  const base = path.replace(/\.(?:jsx?|tsx?)$/, '');
  if (!extensionsByBase.has(base)) extensionsByBase.set(base, []);
  extensionsByBase.get(base).push(path);
}
const siblingDuplicates = [...extensionsByBase.values()]
  .filter(paths => paths.length > 1)
  .flat()
  .sort();

const declarations = files.filter(path => path.endsWith('.d.ts'));
const unexpectedDeclarations = declarations.filter(path =>
  !allowedDeclarations.has(path)
  && !allowedDeclarationPrefixes.some(prefix => path.startsWith(prefix)));
const shadowDeclarations = declarations.filter(path => {
  if (allowedDeclarationPrefixes.some(prefix => path.startsWith(prefix))) return false;
  const base = path.slice(0, -'.d.ts'.length);
  return files.includes(`${base}.js`) || files.includes(`${base}.ts`);
});

const failures = [
  unexpectedJavaScript,
  staleAllowlist,
  siblingDuplicates,
  unexpectedDeclarations,
  shadowDeclarations,
];

reportList('Unexpected production JavaScript', unexpectedJavaScript);
reportList('Stale JavaScript allowlist entries', staleAllowlist);
reportList('JavaScript/TypeScript sibling duplicates', siblingDuplicates);
reportList('Unapproved declaration files', unexpectedDeclarations);
reportList('Declarations shadowing local implementations', shadowDeclarations);

const typeScript = implementationFiles.filter(path => /\.tsx?$/.test(path));
const javaScript = implementationFiles.filter(path => path.endsWith('.js'));
const fileTotal = typeScript.length + javaScript.length;
const typeScriptLines = typeScript.reduce((total, path) => total + countLines(path), 0);
const javaScriptLines = javaScript.reduce((total, path) => total + countLines(path), 0);
const lineTotal = typeScriptLines + javaScriptLines;
const fileRatio = fileTotal === 0 ? 100 : (typeScript.length / fileTotal) * 100;
const lineRatio = lineTotal === 0 ? 100 : (typeScriptLines / lineTotal) * 100;

console.log(
  `TypeScript production: ${typeScript.length}/${fileTotal} implementation files (${fileRatio.toFixed(1)}%), `
  + `${typeScriptLines}/${lineTotal} implementation LOC (${lineRatio.toFixed(1)}%)`,
);

if (!unexpectedJavaScript.length && !shadowDeclarations.length) {
  console.log('Migration complete — no in-scope production JavaScript remains');
}

if (failures.some(paths => paths.length > 0)) process.exit(1);
