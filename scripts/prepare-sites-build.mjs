import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDirectory = resolve(projectRoot, 'dist/server');
const hostingDirectory = resolve(projectRoot, 'dist/.openai');

await mkdir(serverDirectory, { recursive: true });
await mkdir(hostingDirectory, { recursive: true });
await copyFile(
  resolve(projectRoot, 'sites/worker.mjs'),
  resolve(serverDirectory, 'index.js'),
);
await copyFile(
  resolve(projectRoot, '.openai/hosting.json'),
  resolve(hostingDirectory, 'hosting.json'),
);
