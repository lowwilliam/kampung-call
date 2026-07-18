// Temporary QA tool: render an icon contact sheet from the live game page
// via raw CDP (window.__icons debug hook), and read window.__markerKind.
const fs = require("fs");
const { spawn } = require("child_process");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const GAME_URL = process.env.GAME_URL || "http://localhost:5199/";
const PORT = 9224;
const OUT = __dirname + "/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTargetWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await res.json()).find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("no chrome target");
}

(async () => {
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`,
    "--window-size=1200,800", "--mute-audio",
    "--user-data-dir=/tmp/kc-icons-" + Date.now(), "about:blank",
  ], { stdio: "ignore" });
  process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch {} });

  const ws = new WebSocket(await getTargetWs());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const mid = ++id; pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJs = async (expr) => (await send("Runtime.evaluate", {
    expression: expr, awaitPromise: true, returnByValue: true,
  })).result?.result?.value;

  await send("Page.enable");
  await send("Page.navigate", { url: GAME_URL });
  await sleep(9000); // wait for module to run

  // start the game so updateChit() sets the marker
  await evalJs("document.getElementById('begin') && document.getElementById('begin').click()");
  await sleep(3000);

  const markerKind = await evalJs("window.__markerKind || null");
  const chitHtml = await evalJs("document.getElementById('chitItem').innerHTML");
  console.log("marker kind:", markerKind, "| chit:", chitHtml);

  const dataUrl = await evalJs(`(() => {
    const kinds = window.__icons.kinds;
    const cell = 110, cols = 5, rows = Math.ceil(kinds.length / cols);
    const cv = document.createElement('canvas');
    cv.width = cols * cell; cv.height = rows * (cell + 22);
    const c = cv.getContext('2d');
    c.fillStyle = '#f4efe2'; c.fillRect(0, 0, cv.width, cv.height);
    kinds.forEach((k, i) => {
      const x = (i % cols) * cell + cell / 2, y = Math.floor(i / cols) * (cell + 22) + cell / 2;
      window.__icons.drawIcon(c, k, x, y, 38);
      c.fillStyle = '#27302f'; c.font = '13px sans-serif';
      c.textAlign = 'center'; c.fillText(k, x, y + cell / 2 + 14);
    });
    return cv.toDataURL('image/png');
  })()`);
  if (dataUrl) {
    fs.writeFileSync(OUT + "icon-sheet.png", Buffer.from(dataUrl.split(",")[1], "base64"));
    console.log("saved icon-sheet.png");
  } else console.log("FAILED to render sheet");

  ws.close(); chrome.kill("SIGKILL");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
