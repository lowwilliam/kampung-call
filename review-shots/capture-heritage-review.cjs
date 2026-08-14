const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseUrl = process.env.HERITAGE_REVIEW_URL || 'http://127.0.0.1:5198/lost-heritage.html';
const model = process.env.HERITAGE_MODEL || 'amber-mansions';
const outputRoot = process.env.HERITAGE_OUTPUT_ROOT || __dirname;
const port = Number(process.env.HERITAGE_CDP_PORT || 9227);
const views = (process.env.HERITAGE_VIEWS || 'front,three-quarter,side,top').split(',');
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function targetWebSocket() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = targets.find((target) => target.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome debug target did not start');
}

(async () => {
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--window-size=1600,1000',
    '--hide-scrollbars',
    '--use-angle=metal',
    '--disable-background-networking',
    '--disable-component-update',
    `--user-data-dir=/tmp/heritage-review-${Date.now()}`,
    'about:blank',
  ], { stdio: 'ignore' });
  const stop = () => { try { chrome.kill('SIGKILL'); } catch {} };
  process.on('exit', stop);

  const ws = new WebSocket(await targetWebSocket());
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    pending.get(message.id)(message);
    pending.delete(message.id);
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const messageId = ++id;
    pending.set(messageId, resolve);
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');

  for (const view of views) {
    const url = `${baseUrl}?model=${encodeURIComponent(model)}&view=${encodeURIComponent(view)}&capture=${Date.now()}`;
    await send('Page.navigate', { url });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const state = await send('Runtime.evaluate', {
        expression: `Boolean(window.__LOST_HERITAGE_READY__) && new URL(location.href).searchParams.get('view') === ${JSON.stringify(view)}`,
      });
      if (state.result?.result?.value === true) { ready = true; break; }
      await sleep(100);
    }
    if (!ready) throw new Error(`Heritage preview did not settle for ${view}`);
    await sleep(900);
    const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const output = path.join(outputRoot, `${model}-${view}.png`);
    fs.writeFileSync(output, Buffer.from(screenshot.result.data, 'base64'));
    console.log(`Saved ${output}`);
  }

  ws.close();
  stop();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
