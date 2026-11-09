'use strict';
// Turns SVG frames into PNG pictures with a hidden browser (Edge on Windows, Chromium on Linux),
// using the DevTools protocol. Node 22+ has fetch + WebSocket built in, so nothing to install.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const BROWSER = process.env.BROWSER || (process.platform === 'win32'
  ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : 'chromium');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function pageHtml(width, height, fontCss) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}
html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:#000}
#scene,#grain,#ui{position:absolute;left:0;top:0;width:${width}px;height:${height}px}
text{font-family:'Fredoka',sans-serif}
</style></head><body><div id="scene"></div><canvas id="grain" width="${width}" height="${height}"></canvas><div id="ui"></div>
<script>
// paper grain, drawn once (2 px speckles, very light)
(function () {
  const c = document.getElementById('grain').getContext('2d');
  let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let y = 0; y < ${height}; y += 2) for (let x = 0; x < ${width}; x += 2) {
    const v = rnd();
    if (v < 0.5) { c.fillStyle = 'rgba(70,50,30,' + ((0.5 - v) * 0.09).toFixed(3) + ')'; c.fillRect(x, y, 2, 2); }
    else if (v > 0.8) { c.fillStyle = 'rgba(255,250,240,' + ((v - 0.8) * 0.18).toFixed(3) + ')'; c.fillRect(x, y, 2, 2); }
  }
})();
window.__draw = (a, b) => new Promise(done => {
  document.getElementById('scene').innerHTML = a;
  document.getElementById('ui').innerHTML = b;
  let finished = false; const end = () => { if (!finished) { finished = true; done(true); } };
  requestAnimationFrame(() => requestAnimationFrame(end)); setTimeout(end, 120);
});
Promise.all([document.fonts.load("700 40px Fredoka"), document.fonts.load("600 40px Fredoka")]).then(() => { window.__ready = true; });
</script></body></html>`;
}

// profile: each browser running at the same time needs its own profile folder
async function launch({ width = 1080, height = 1920, fontCss = '', profile = 'autoanimate-render' } = {}) {
  const dir = path.join(os.tmpdir(), profile);
  fs.mkdirSync(dir, { recursive: true });
  const portFile = path.join(dir, 'DevToolsActivePort');
  fs.rmSync(portFile, { force: true });
  const proc = spawn(BROWSER, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--mute-audio', '--no-sandbox', `--user-data-dir=${dir}`, '--remote-debugging-port=0', `--window-size=${width},${height}`, 'about:blank'],
  { stdio: 'ignore' });
  for (let i = 0; i < 300 && !fs.existsSync(portFile); i++) await sleep(50);
  if (!fs.existsSync(portFile)) { proc.kill(); throw new Error('the browser did not start'); }
  await sleep(100);
  const port = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0].trim();
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const htmlFile = path.join(dir, 'page.html');
  fs.writeFileSync(htmlFile, pageHtml(width, height, fontCss));
  await send('Page.navigate', { url: 'file:///' + htmlFile.replace(/\\/g, '/') });
  for (let i = 0; i < 200; i++) { if (await evaluate('window.__ready === true').catch(() => false)) break; await sleep(50); }

  return {
    async frame(sceneSvg, uiSvg) {
      await evaluate(`__draw(${JSON.stringify(sceneSvg)}, ${JSON.stringify(uiSvg)})`);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      return Buffer.from(shot.data, 'base64');
    },
    async close() {
      try { await send('Browser.close'); } catch (e) { /* already closed */ }
      ws.close();
      setTimeout(() => { try { proc.kill(); } catch (e) { /* gone */ } }, 500);
    },
  };
}

module.exports = { launch };
