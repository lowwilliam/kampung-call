const fs = require('fs');
const { spawn } = require('child_process');

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const reviewUrl = process.env.REVIEW_URL || 'http://127.0.0.1:5198/review-shots/asset-review.html';
const output = process.env.REVIEW_OUTPUT || `${__dirname}/assets-review.png`;
const port = 9224;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function targetWebSocket() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
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
    '--window-size=1800,1000',
    '--hide-scrollbars',
    '--use-angle=metal',
    `--user-data-dir=/tmp/kampung-asset-review-${Date.now()}`,
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
  await send('Page.navigate', { url: reviewUrl });
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const ready = await send('Runtime.evaluate', { expression: "document.documentElement.dataset.reviewReady === 'true'" });
    if (ready.result?.result?.value === true) break;
    if (attempt === 239) throw new Error('Asset review page did not finish rendering');
    await sleep(250);
  }
  const metrics = await send('Page.getLayoutMetrics');
  const content = metrics.result.cssContentSize;
  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: content.width, height: content.height, scale: 1 },
  });
  fs.writeFileSync(output, Buffer.from(screenshot.result.data, 'base64'));
  console.log(`Saved ${output} (${Math.round(content.width)} × ${Math.round(content.height)})`);
  ws.close();
  stop();
})().catch((error) => { console.error(error); process.exitCode = 1; });
