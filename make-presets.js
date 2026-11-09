'use strict';
// Makes the v2 "paper preset" sheets:  node make-presets.js          (all characters)
//                                       node make-presets.js benji    (just one)
// → presets/<id>-preset.svg + .png, and presets/<id>/parts/*.svg (every part on its own)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { presetSheet, exportParts, W, H } = require('./src/presets');

const ROOT = __dirname, OUT = path.join(ROOT, 'presets');
const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const d = new Date();
const meta = { version: 'v2', date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };

function toPng(svgFile, pngFile) {
  execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--force-device-scale-factor=1', `--user-data-dir=${path.join(os.tmpdir(), 'autoanimate-edge')}`,
    `--window-size=${W},${H}`, `--screenshot=${pngFile}`, 'file:///' + svgFile.replace(/\\/g, '/')], { stdio: 'ignore', timeout: 90000 });
}

fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
for (const f of fs.readdirSync(path.join(ROOT, 'characters')).filter(f => f.endsWith('.json')).sort()) {
  const ch = JSON.parse(fs.readFileSync(path.join(ROOT, 'characters', f), 'utf8'));
  if (only.length && !only.includes(ch.id)) continue;
  const svgFile = path.join(OUT, `${ch.id}-preset.svg`), pngFile = path.join(OUT, `${ch.id}-preset.png`);
  fs.writeFileSync(svgFile, presetSheet(ch, meta), 'utf8');
  toPng(svgFile, pngFile);
  // the part files are remade every run, so renamed parts don't linger
  const partsDir = path.join(OUT, ch.id, 'parts');
  if (fs.existsSync(partsDir)) for (const p of fs.readdirSync(partsDir)) if (p.endsWith('.svg')) fs.rmSync(path.join(partsDir, p));
  const parts = exportParts(ch, partsDir);
  console.log(`made presets/${ch.id}-preset.png + ${parts.length} parts`);
}
