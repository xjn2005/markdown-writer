#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: markdown-writer create [directory] [--no-install] [--package-spec spec]');
  process.exit(0);
}
if (args[0] !== 'create') {
  console.error('Expected the create command. Run with --help for usage.');
  process.exit(2);
}

const targetArg = args.find((arg, index) =>
  index > 0 && !arg.startsWith('--') && args[index - 1] !== '--package-spec',
) || 'markdown-writer-demo';
const target = resolve(process.cwd(), targetArg);
if (existsSync(target)) {
  console.error(`Directory already exists: ${target}`);
  process.exit(2);
}

const packageInfo = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const specIndex = args.indexOf('--package-spec');
if (specIndex >= 0 && (!args[specIndex + 1] || args[specIndex + 1].startsWith('--'))) {
  console.error('--package-spec requires an npm package spec or tarball path.');
  process.exit(2);
}
const template = resolve(packageRoot, 'template');
mkdirSync(resolve(target, 'src'), { recursive: true });
for (const filename of ['index.html', 'tsconfig.json']) {
  copyFileSync(resolve(template, filename), resolve(target, filename));
}
for (const filename of ['main.tsx']) {
  copyFileSync(resolve(template, 'src', filename), resolve(target, 'src', filename));
}
const project = JSON.parse(readFileSync(resolve(template, 'package.json'), 'utf8'));
project.name = basename(target).toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'markdown-writer-demo';
project.version = packageInfo.version;
const releaseAssetUrl = `https://github.com/rinspacehq/rinspace-editor-markdown/releases/download/v${packageInfo.version}/rinspacehq-markdown-writer-${packageInfo.version}.tgz`;
project.dependencies[packageInfo.name] = specIndex >= 0 ? args[specIndex + 1] : releaseAssetUrl;
writeFileSync(resolve(target, 'package.json'), `${JSON.stringify(project, null, 2)}\n`);
console.log(`Created ${target}`);

if (args.includes('--no-install')) {
  console.log('Run npm install and npm run dev in the created directory.');
  process.exit(0);
}

function run(command, commandArgs) {
  return new Promise((done, fail) => {
    const child = spawn(command, commandArgs, { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', fail);
    child.on('exit', (code, signal) => done({ code, signal }));
  });
}

try {
  const install = await run('npm', ['install']);
  if (install.code !== 0) process.exit(install.code || 1);
  for (const dependency of ['@milkdown/crepe', '@milkdown/kit', packageInfo.name]) {
    const installed = resolve(target, 'node_modules', dependency, 'package.json');
    if (!existsSync(installed)) {
      throw new Error(`Missing local dependency: ${dependency}. Run npm install in ${target}.`);
    }
  }
  console.log('Milkdown and the Rinspace Markdown writer are installed in this project’s node_modules.');
  console.log('Starting the local editor. Open the URL printed by Vite. Press Ctrl+C to stop.');
  const server = await run('npm', ['run', 'dev']);
  process.exit(server.code || (server.signal ? 130 : 0));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
