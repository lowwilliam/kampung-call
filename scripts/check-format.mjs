import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib/project.mjs';

const files = ['package.json', 'vercel.json', 'vite.config.js', 'index.html', 'src/styles.css', 'src/main.js', 'README.md', '.github/workflows/quality.yml', 'docs/COMMERCIAL-READINESS.md'];
const failures = [];
for (const file of files) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) continue;
  const content = fs.readFileSync(target, 'utf8');
  if (!content.endsWith('\n')) failures.push(`${file}: missing final newline.`);
  if (/\r/.test(content)) failures.push(`${file}: use LF line endings.`);
  if (content.split('\n').some((line) => /[ \t]+$/.test(line))) failures.push(`${file}: trailing whitespace.`);
  if (file.endsWith('.json')) {
    try { JSON.parse(content); } catch (error) { failures.push(`${file}: invalid JSON (${error.message}).`); }
  }
}
if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL  ${failure}`));
  process.exitCode = 1;
} else console.log(`PASS  Formatting checks passed for ${files.length} project files.`);
