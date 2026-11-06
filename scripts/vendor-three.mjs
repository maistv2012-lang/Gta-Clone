// Copy the exact pinned engine and only the addon dependency closure in use.
// npm ci verifies the package against package-lock.json before this command.
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'node_modules/three');
const target = join(root, 'vendor/three');
const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
if (pkg.version !== '0.170.0') throw new Error('Expected Three.js 0.170.0');
await mkdir(target, { recursive: true });
await copyFile(join(source, 'build/three.module.js'), join(target, 'three.module.js'));
await copyFile(join(source, 'LICENSE'), join(target, 'LICENSE'));
const pending = [];
for (const file of await readdir(join(root, 'js'))) {
  if (!file.endsWith('.js')) continue;
  const text = await readFile(join(root, 'js', file), 'utf8');
  for (const match of text.matchAll(/['"]three\/addons\/([^'"]+)['"]/g)) pending.push(match[1]);
}
const seen = new Set();
while (pending.length) {
  const file = pending.pop();
  if (seen.has(file)) continue;
  if (file.startsWith('..') || file.startsWith('/')) throw new Error('Invalid addon path');
  seen.add(file);
  const text = await readFile(join(source, 'examples/jsm', file), 'utf8');
  const output = join(target, 'addons', file);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, text);
  for (const [, specifier] of text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
    if (specifier === 'three') continue;
    if (!specifier.startsWith('.')) throw new Error(`Unexpected dependency: ${specifier}`);
    pending.push(relative(join(source, 'examples/jsm'), resolve(source, 'examples/jsm', dirname(file), specifier)));
  }
}
await writeFile(join(target, 'README.md'), `Three.js ${pkg.version} (r170), MIT license.\n\nVendored without modifications from the npm package pinned in package-lock.json.\nRun npm ci && npm run vendor:three to reproduce.\n\nIncluded addons:\n${[...seen].sort().map(f => '- ' + f).join('\n')}\n`);
console.log(`Three.js ${pkg.version}: engine and ${seen.size} addons copied locally`);
