import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const preview = spawn(npm, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '5199'], {
  cwd: root,
  stdio: 'ignore',
});
const stop = (child) => { if (child && !child.killed) child.kill('SIGTERM'); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const executableNames = process.platform === 'win32'
    ? ['chrome.exe']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  const pathCandidates = (process.env.PATH || '')
    .split(path.delimiter)
    .flatMap((directory) => executableNames.map((name) => path.join(directory, name)));
  const candidates = [
    process.env.CHROME_PATH,
    path.join('/Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
    ...pathCandidates,
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:5199/');
      if (response.ok) { ready = true; break; }
    } catch {}
    await sleep(250);
  }
  if (!ready) throw new Error('Vite preview did not become ready on port 5199');
  const chrome = findChrome();
  if (!chrome) throw new Error('Google Chrome is required for the headless visibility check');
  await new Promise((resolve, reject) => {
    const check = spawn(process.execPath, [path.join(root, 'review-shots', 'shoot-cdp.cjs')], {
      cwd: root,
      env: {...process.env, CHROME_PATH: chrome, GAME_URL: 'http://127.0.0.1:5199/', VERIFY_ONLY: '1'},
      stdio: 'inherit',
    });
    check.on('error', reject);
    check.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Visibility check exited ${code ?? signal}`)));
  });
  console.log('PASS  Headless asset visibility and footprint audits passed.');
} finally {
  stop(preview);
}
