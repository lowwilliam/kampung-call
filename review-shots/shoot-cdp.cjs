// Temporary review tool: screenshot the game via raw Chrome DevTools Protocol.
// Uses fetch plus a Node-version-compatible WebSocket client against Chrome's
// remote debugging port. (puppeteer-core in the singapost install is corrupted.)
const fs = require("fs");
const { spawn } = require("child_process");
const WebSocketClient = globalThis.WebSocket || require("ws");

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const GAME_URL = process.env.GAME_URL || "http://localhost:5199/";
const VERIFY_ONLY = process.env.VERIFY_ONLY === "1";
const PORT = 9223;
const OUT = __dirname + "/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => { fs.appendFileSync(OUT + "shoot.log", m + "\n"); };

async function getTargetWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("Chrome debug target never appeared");
}

(async () => {
  const graphicsArgs = process.platform === "darwin"
    ? ["--use-angle=metal"]
    : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage", "--no-sandbox"];
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`,
    "--window-size=1440,900", "--mute-audio", ...graphicsArgs,
    "--user-data-dir=/tmp/kc-chrome-profile-" + Date.now(),
    "about:blank",
  ], { stdio: "ignore" });
  process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch {} });

  const ws = new WebSocketClient(await getTargetWs());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  log("cdp connected");

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evaluate = (expr) => send("Runtime.evaluate", { expression: expr, awaitPromise: false });
  const shot = async (name) => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(OUT + name, Buffer.from(r.result.data, "base64"));
    log("saved " + name);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: GAME_URL });
  log("navigated");
  if (VERIFY_ONLY) {
    const auditExpression = "JSON.stringify({assets:window.__assetLoadAudit||null,footprints:window.__buildingFootprintAudit||null,visibility:window.__visibilityAudit||null,config:window.__visibilityConfigAudit||null,buildings:window.__buildingSpacingAudit||null,route:window.__routeClearanceAudit||null,npcHomes:window.__npcPlacementAudit||null,npcLive:window.__npcSeparationAudit||null,vendor:window.__vendorAssetAudit||null})";
    let value;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const state = await evaluate(auditExpression);
      value = state.result && state.result.result && state.result.result.value;
      const current = JSON.parse(value || "{}");
      const assetsSettled = current.assets
        && current.assets.loaded + current.assets.failed + current.assets.fallbackActive >= current.assets.requested;
      if (assetsSettled && current.footprints && current.visibility && current.config && current.buildings
        && current.route && current.npcHomes && current.npcLive && current.vendor) break;
      await sleep(500);
    }
    log("VERIFY " + value);
    const parsed = JSON.parse(value || "{}");
    const clean = parsed.assets && parsed.assets.failed === 0 && parsed.footprints && parsed.footprints.failures?.length === 0
      && parsed.visibility?.pass === true && parsed.config?.pass === true
      && parsed.buildings?.crowded?.length === 0 && parsed.route?.blocked?.length === 0
      && parsed.npcHomes?.npcSpawnConflicts?.length === 0 && parsed.npcHomes?.npcPlaceMismatches?.length === 0
      && parsed.npcHomes?.npcHomeConflicts?.length === 0 && parsed.npcLive?.conflicts?.length === 0
      && parsed.vendor?.unplaced?.length === 0;
    if (!clean) throw new Error(`Visibility verification failed: ${value}`);
    ws.close();
    chrome.kill("SIGKILL");
    log("VERIFY PASS");
    process.exit(0);
  }
  await sleep(14000); // GLB load + title world settle
  await shot("cur_title.png");

  await evaluate("document.getElementById('begin') && document.getElementById('begin').click()");
  await sleep(5000); // camera swoop into gameplay
  await shot("cur_spawn.png");

  const key = async (type, code, keyVal, vk) => send("Input.dispatchKeyEvent", {
    type, code, key: keyVal, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
  });
  const hold = async (code, keyVal, vk, ms) => {
    await key("rawKeyDown", code, keyVal, vk);
    await sleep(ms);
    await key("keyUp", code, keyVal, vk);
  };
  await hold("KeyW", "w", 87, 3500);
  await sleep(800);
  await shot("cur_walk.png");

  await hold("KeyD", "d", 68, 900);
  await hold("KeyW", "w", 87, 3500);
  await sleep(800);
  await shot("cur_walk2.png");

  // keep walking toward the call target; dialogue should auto-open in range
  await hold("KeyW", "w", 87, 4000);
  await sleep(1200);
  await shot("cur_near.png");

  const st = await evaluate("JSON.stringify({route:window.__routeClearanceAudit||null,npc:window.__npcPlacementAudit||null,terrain:window.__terrainAudit||null,callWalk:window.__callWalkAudit||null,spacing:window.__buildingSpacingAudit||null,water:window.__buildingWaterAudit||null})");
  log("STATE " + JSON.stringify(st.result && st.result.result && st.result.result.value));

  ws.close();
  chrome.kill("SIGKILL");
  log("DONE");
  process.exit(0);
})().catch((e) => { log("ERROR " + e.message); console.error(e); process.exit(1); });
