'use strict';
// Makes the character sheets: node make-sheets.js            (all)
//                             node make-sheets.js benji      (just one)
// Writes sheets/<name>.svg, then turns each SVG into a PNG with Microsoft Edge (already on Windows).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { turnaroundSheet, baseSheet } = require('./src/sheets');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'sheets');
const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const d = new Date();
const meta = { version: 'v1', date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };

function toPng(svgFile, pngFile, w, h) {
  execFileSync(EDGE, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--force-device-scale-factor=1', `--user-data-dir=${path.join(os.tmpdir(), 'autoanimate-edge')}`,
    `--window-size=${w},${h}`, `--screenshot=${pngFile}`, 'file:///' + svgFile.replace(/\\/g, '/'),
  ], { stdio: 'ignore', timeout: 90000 });
}

fs.mkdirSync(OUT, { recursive: true });
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'characters', f), 'utf8'));
const jobs = [['base', 'base-puppet', baseSheet(read('base.json'), meta), 1920, 1380]];
for (const f of fs.readdirSync(path.join(ROOT, 'characters')).filter(f => f.endsWith('.json') && f !== 'base.json').sort()) {
  const ch = read(f);
  jobs.push([ch.id, `${ch.id}-turnaround`, turnaroundSheet(ch, meta), 1920, 1080]);
}
const only = process.argv.slice(2);
for (const [id, name, svg, w, h] of jobs) {
  if (only.length && !only.includes(id)) continue;
  const svgFile = path.join(OUT, `${name}.svg`), pngFile = path.join(OUT, `${name}.png`);
  fs.writeFileSync(svgFile, svg, 'utf8');
  toPng(svgFile, pngFile, w, h);
  console.log('made', path.relative(ROOT, pngFile));
}
