'use strict';
// Makes a short from a story script:  node make-short.js stories/viking-horns.json
// → out/<id>.mp4 (1080x1920) + out/<id>/ (voice lines, timeline, check pictures)
// The Style Bible's 2D upgrades (2026-11-09): one shot per line with a camera that never stops (push / pull / drift),
// mood light (day / sunset / night: sky tint, glow, rays, contrast, vignette), background layers that slide at different
// speeds and blur in close-ups, soft ground shadows, an effects kit (steam, sweat, sparkle, "!", dust, flash, shake),
// paper insert cards, and short captions low on the screen. Older stories (no "shot"/"mood") still work.
// Options:  --check      only the check pictures (one per line), no video: quick to test a look
//           --check --at=30.5,31.2   check pictures exactly at those seconds (to test an action)
//           --workers=3  how many hidden browsers draw at the same time (default 3; more = faster, but each needs ~0.4 GB of RAM)
//           --cpu        encode on the processor even if the graphics card's encoder (NVENC) is there
//           --design=v1  the old outline look (default: v2, the paper preset look) → out/<id>-v1.mp4
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { once } = require('events');
const { SCENES, LAYERS, W, H, GROUND } = require('./src/scenes');
const { sayAll, mixLines, FFMPEG } = require('./src/voices');
const L = require('./src/lipsync');
const LK = require('./src/look');
const PR = require('./src/props');
const { card } = PR;
const { launch } = require('./src/renderer');
const { fonts } = require('./src/sheets');

const BASE_S = 1.75;
const ROOT = __dirname;
const ARGS = process.argv.slice(2);
const opt = name => { const a = ARGS.find(x => x === `--${name}` || x.startsWith(`--${name}=`)); return a && (a.split('=')[1] || true); };
const story = JSON.parse(fs.readFileSync(path.resolve(ROOT, ARGS.find(a => !a.startsWith('--')) || 'stories/viking-helmets.json'), 'utf8'));
const DESIGN = opt('design') || story.design || 'v2';
const P = require(DESIGN === 'v1' ? './src/puppet' : './src/puppet2');
const INK = DESIGN === 'v1' ? P.INK : P.LINE;
const CHECK_ONLY = !!opt('check');
const FPS = story.fps || 24;
const MOOD = story.mood && LK.MOODS[story.mood] ? story.mood : null;
const CAP = Object.assign({ words: 3, chars: 17, y: 712, size: 88 }, story.captions || {});
const TITLE = Array.isArray(story.title) ? story.title : null; // older stories: a title card at the start
const ID = story.id + (DESIGN === 'v1' ? '-v1' : '');
const OUT = path.join(ROOT, 'out', ID);
fs.mkdirSync(path.join(OUT, 'voice'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'check'), { recursive: true });
// the check pictures are remade every run, so old ones don't mix with new ones
for (const f of fs.readdirSync(path.join(OUT, 'check'))) if (/^frame-\d+\.png$/.test(f)) fs.rmSync(path.join(OUT, 'check', f));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f1 = n => n.toFixed(1);

const chars = {};
for (const [id, c] of Object.entries(story.cast)) chars[id] = JSON.parse(fs.readFileSync(path.resolve(ROOT, c.file), 'utf8'));
const LYR = (LAYERS[story.scene || 'fjord'] || LAYERS.fjord)(DESIGN);
// how big the characters are and where their feet are (a story can make them smaller, so the room feels bigger)
const S = story.charScale || BASE_S, CG = story.charGround || GROUND, K = S / BASE_S, ZK = Math.sqrt(BASE_S / S);

// ---------- 1) voices + timing ----------
console.log('🗣️  making the voices…');
const lines = [];
// all lines in one go (Kokoro loads its model once)
const made = sayAll(story.beats.map((beat, i) => (beat.who ? { text: beat.say || beat.text, voice: story.voices[beat.who], outWav: path.join(OUT, 'voice', `${String(i).padStart(2, '0')}-${beat.who}.wav`) } : null)).filter(Boolean));
let t = story.lead ?? 0.8, made_i = 0;
story.beats.forEach((beat, i) => {
  if (!beat.who) { beat._start = t; beat._end = t + (beat.hold || 1); t = beat._end; return; }
  const wav = made[made_i++];
  const env = L.envelope(wav, FPS);
  const ws = L.timeWords(beat.text, env, FPS);
  const line = { beat, wav, ws, chunks: L.chunks(ws, CAP.words, CAP.chars), mouth: L.mouthTrack(ws, env, FPS, wav.duration), start: t, end: t + wav.duration };
  lines.push(line);
  beat._start = t; beat._end = line.end;
  t = line.end + (beat.gap ?? story.gap ?? 0.32);
});
const lastBeat = story.beats[story.beats.length - 1];
const total = lastBeat.who ? lastBeat._end + (story.tail ?? 0.8) : lastBeat._end;

// one shot per line: "wide", "medium bjorn", "close benji pull", "two benji bjorn", "insert poster" (+ push/pull/drift-left/drift-right/still)
const MOVES = ['push', 'pull', 'drift-left', 'drift-right', 'still'];
function parseShot(beat, i) {
  if (beat.shot) {
    if (typeof beat.shot !== 'string') return Object.assign({ move: 'push' }, beat.shot);
    const [type, ...rest] = beat.shot.trim().split(/\s+/);
    const move = rest.find(x => MOVES.includes(x)) || (type === 'wide' ? (i % 2 ? 'drift-left' : 'drift-right') : 'push');
    const names = rest.filter(x => !MOVES.includes(x));
    if (type === 'insert') return { type, card: names[0], move };
    if (type === 'two') return { type, on: names.slice(0, 2), move };
    return { type, on: names[0], move };
  }
  const c = beat.camera || 'wide'; // older stories: "camera": "wide" or { zoom, on }
  if (c === 'wide' || !c.on) return { type: 'wide', move: 'still' };
  return { type: 'custom', on: c.on, zoom: c.zoom || 1.4, move: 'still' };
}
// effects: "steam bjorn", "sparkle benji hat", "bang benji", "idea dale", "dust bjorn", "sweat bjorn", "flash", "shake",
// "splat 730 800" / "sparkle 760 700" (at a place in the scene), or objects with "at": seconds into the line
const fxList = beat => [].concat(beat.fx || []).map(f => {
  if (typeof f !== 'string') return f;
  const [type, a, b] = f.trim().split(/\s+/);
  if (a !== undefined && !isNaN(+a)) return { type, x: +a, y: +b };
  return { type, on: a, spot: b };
});

// who is where and doing what, beat by beat (hop + shake only last one beat)
let state = {};
for (const [id, c] of Object.entries(story.cast)) state[id] = Object.assign({}, c);
story.beats.forEach((beat, i) => {
  const next = {};
  for (const id of Object.keys(state)) {
    const keep = Object.assign({}, state[id]);
    delete keep.hop; delete keep.shake;
    next[id] = Object.assign(keep, (beat.cast || {})[id] || {});
  }
  beat._cast = next; state = next;
  beat._vs = i === 0 ? 0 : beat._start - (beat.shot ? 0.08 : 0.12); // the picture changes just before the line starts
  beat._shot = parseShot(beat, i);
  beat._fx = fxList(beat);
});
story.beats.forEach((b, i) => { b._ve = i + 1 < story.beats.length ? story.beats[i + 1]._vs : total; });
const beatAt = time => story.beats.reduce((b, x) => (time >= x._vs ? x : b), story.beats[0]);

// props: things in the scene (a steak, plates, a smear…). A line can move one: jump (new x/y), "fly" (an arc + spin)
// or "slide" (smooth), each with "at" (seconds into the line) and "dur". Numbers (x, y, rot, len, scale, opacity) blend.
let pstate = {};
for (const [id, p] of Object.entries(story.props || {})) pstate[id] = Object.assign({ rot: 0, scale: 1, layer: 'front' }, p);
story.beats.forEach(beat => {
  beat._propsFrom = pstate;
  const next = {};
  for (const id of Object.keys(pstate)) next[id] = Object.assign({}, pstate[id], (beat.props || {})[id] || {});
  beat._propsTo = next;
  pstate = {};
  for (const id of Object.keys(next)) { const c = Object.assign({}, next[id]); delete c.fly; delete c.slide; pstate[id] = c; }
});
const NUM = ['x', 'y', 'rot', 'len', 'scale', 'opacity'];
function propAt(id, beat, time) {
  const a = beat._propsFrom[id], b = beat._propsTo[id], mv = b.fly || b.slide;
  if (!mv) return b;
  const dt = time - beat._vs - (mv.at || 0), dur = mv.dur || Math.max(0.1, beat._ve - beat._vs - (mv.at || 0));
  const out = Object.assign({}, b);
  if (dt < 0) { for (const k of NUM) if (typeof a[k] === 'number') out[k] = a[k]; out.hidden = a.hidden; return out; }
  const u = Math.min(1, dt / dur), e = b.fly ? u : LK.ease(u);
  for (const k of NUM) if (typeof a[k] === 'number' && typeof b[k] === 'number') out[k] = a[k] + (b[k] - a[k]) * e;
  if (b.fly) { out.y -= (b.fly.arc || 0) * 4 * u * (1 - u); out.rot = (out.rot || 0) + (b.fly.spin || 0) * u; }
  return out;
}
function propsSvg(beat, time, layer) {
  let s = '';
  for (const id of Object.keys(beat._propsTo)) {
    const p = propAt(id, beat, time);
    if (!p.hidden && (p.layer || 'front') === layer) s += PR.propSvg(p);
  }
  return s;
}
const lineAt = time => lines.find(l => time >= l.start && time < l.end);

// ---------- 2) what each frame looks like ----------
const rigOf = id => P.rig(chars[id].body);
const sitDy = (id, st) => (DESIGN !== 'v1' && st.legs === 'sit' ? rigOf(id).legBottom - rigOf(id).B + 2 : 0);
const headY = (id, st) => CG + S * (rigOf(id).cy + sitDy(id, st));

function cameraAt(beat, time) {
  const sh = beat._shot, st = id => beat._cast[id];
  const u = LK.ease((time - beat._vs) / Math.max(0.1, beat._ve - beat._vs));
  let z = 1, fx = W / 2, fy = H / 2;
  if (sh.type === 'medium' && chars[sh.on]) { z = 1.45 * ZK; fx = st(sh.on).x; fy = headY(sh.on, st(sh.on)) + 190 * K; }
  else if (sh.type === 'close' && chars[sh.on]) { z = 1.8 * ZK; fx = st(sh.on).x; fy = headY(sh.on, st(sh.on)) + 60 * K; }
  else if (sh.type === 'two' && sh.on.every(id => chars[id])) { z = 1.12; fx = (st(sh.on[0]).x + st(sh.on[1]).x) / 2; fy = CG - 380 * K; }
  else if (sh.type === 'custom') { z = sh.zoom; fx = st(sh.on).x; fy = CG + S * rigOf(sh.on).cy - 80 * K; }
  else if (sh.type === 'spot') { // a close look at a prop (where it is when the line starts) or a place in the scene
    const p = beat._propsTo[sh.on] ? propAt(sh.on, beat, beat._vs) : null, spot = p ? [p.x, p.y] : (LYR.spots || {})[sh.on] || [W / 2, H / 2];
    z = sh.zoom || (p ? 2.3 : 1.7); fx = spot[0]; fy = spot[1];
  }
  else if (sh.move !== 'still') { z = 1.06; fy = CG - 420 * K; } // wide: room to drift, faces above the captions
  // the camera never stops (Style Bible): a slow push, pull or drift over the whole shot
  if (sh.move === 'push') z *= 1 + 0.07 * u;
  else if (sh.move === 'pull') z *= 1.07 - 0.07 * u;
  else if (sh.move === 'drift-left') fx += 30 * (1 - 2 * u);
  else if (sh.move === 'drift-right') fx -= 30 * (1 - 2 * u);
  const hw = W / 2 / z, hh = H / 2 / z;
  fx = Math.min(W - hw, Math.max(hw, fx)); fy = Math.min(H - hh, Math.max(hh, fy));
  return { z, fx, fy };
}
// a background layer at depth k (0 = far away, doesn't move; 1 = where the characters stand)
function layerTf(cam, k, dx, dy) {
  const zk = 1 + (cam.z - 1) * k, fxk = W / 2 + (cam.fx - W / 2) * k, fyk = H / 2 + (cam.fy - H / 2) * k;
  return `translate(${f1(W / 2 - zk * fxk + dx)},${f1(H / 2 - zk * fyk + dy)}) scale(${zk.toFixed(4)})`;
}

const rand = seed => { let s = seed; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };
const blinks = {};
Object.keys(chars).forEach((id, k) => {
  const r = rand(97 + k * 31), list = [];
  for (let b = 1.0 + r() * 1.4; b < total; b += 2.4 + r() * 2.2) list.push(b);
  blinks[id] = list;
});
function eyesAt(id, time, eyes) {
  if (eyes === 'happy' || eyes === 'closed') return eyes;
  for (const b of blinks[id]) {
    const d = time - b;
    if (d >= 0 && d < 3 / FPS) return d < 1 / FPS ? 'half' : d < 2 / FPS ? 'closed' : 'half';
  }
  return eyes;
}

// effects that sit on a character (its own units: 0,0 = the ground under its feet)
function fxFor(id, beat, time) {
  const r = rigOf(id), st = beat._cast[id], head = { x: 0, y: r.cy + sitDy(id, st), r: 102 };
  let s = '';
  for (const f of beat._fx) {
    if (f.on !== id) continue;
    const dt = time - beat._vs - (f.at || 0);
    if (dt < 0) continue;
    if (f.type === 'steam') s += LK.steam(dt, head);
    else if (f.type === 'sweat') s += LK.sweat(dt, head, /right/.test(st.face || '') ? -1 : 1); // the back of the head in 3/4 views
    else if (f.type === 'bang') s += LK.bang(dt, head);
    else if (f.type === 'idea') s += LK.idea(dt, head);
    else if (f.type === 'dust') s += LK.dust(dt, 0, 90);
    else if (f.type === 'sparkle') {
      const spot = f.spot === 'chest' ? [26, (r.T + r.B) / 2 + sitDy(id, st)] : f.spot === 'head' ? [56, head.y - 70] : [-46, head.y - 118];
      s += LK.sparkle(dt, spot[0], spot[1], 1.3);
    }
  }
  return s;
}
function charSvg(id, beat, time) {
  const st = beat._cast[id];
  if (st.hidden) return '';
  const line = lineAt(time);
  const speaking = !!line && line.beat.who === id;
  const mouth = speaking ? line.mouth(time - line.start) : st.chew ? (Math.floor(time * 5) % 2 ? 'C' : 'A') : (st.mouthIdle || 'X');
  const eyes = eyesAt(id, time, st.eyes || 'open');
  const brows = ((P.EYES || {})[st.eyes || 'open'] || {}).brow; // v2: the eyebrows keep the mood while the eyes blink
  const pose = { arms: st.arms || 'down', pointDir: st.pointDir || (st.x < W / 2 ? 1 : -1), headRot: speaking ? 1.8 * Math.sin(time * 7) : 0, legs: st.legs };
  let x = st.x, y = 0;
  const dt = time - beat._vs;
  if (st.hop && dt >= 0 && dt < 0.36) y = -38 * Math.sin(Math.PI * dt / 0.36);
  if (st.shake && speaking) x += Math.floor(time * 12) % 2 ? 3.5 : -3.5;
  if (st.bob) y -= Math.abs(Math.sin(time * 14)) * 7; // laughing
  const ch = st.hat !== undefined ? Object.assign({}, chars[id], { hat: st.hat }) : chars[id];
  return `<g transform="translate(${f1(x)},${f1(CG + y * K)}) scale(${S})"${MOOD ? '' : ' filter="url(#drop)"'}>` +
    P.drawCharacter(ch, st.face || 'front', { eyes, mouth, brows }, pose) + fxFor(id, beat, time) + '</g>';
}
function sceneFx(beat, time) { // effects at a place in the scene (not on a character)
  let s = '';
  for (const f of beat._fx) {
    if (f.on || f.x === undefined) continue;
    const dt = time - beat._vs - (f.at || 0);
    if (dt < 0) continue;
    if (f.type === 'splat') s += LK.splat(dt, f.x, f.y);
    else if (f.type === 'sparkle') s += LK.sparkle(dt, f.x, f.y, 1.4);
  }
  return s;
}
function screenFx(beat, time, kind) { // the big finish: a camera shake and a white flash
  let shake = [0, 0], flash = '';
  for (const f of beat._fx) {
    const dt = time - beat._vs - (f.at || 0);
    if (f.type === 'shake' || f.type === 'flash') { const s = LK.shake(dt, 3); shake = [shake[0] + s[0], shake[1] + s[1]]; }
    if (f.type === 'flash') flash += LK.flash(dt);
  }
  return kind === 'shake' ? shake : flash;
}

const DEFS = `<defs><filter id="drop" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="3" dy="4" stdDeviation="1.2" flood-color="${INK}" flood-opacity="0.28"/></filter>${MOOD ? LK.defs(MOOD) : LK.defs('day')}</defs>`;
const svg = (body, style = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"${style}>${body}</svg>`;
const GRADE = MOOD ? ` style="filter:${LK.grade(MOOD)}"` : '';
const BG_FLAT = SCENES[story.scene || 'fjord'](DESIGN);

function sceneSvg(beat, time) {
  const sh = beat._shot;
  if (sh.type === 'insert') { // a paper close-up of an object, on the mood's backdrop
    const spec = (story.cards || {})[sh.card] || { title: [sh.card || '?'] };
    const u = (time - beat._vs) / Math.max(0.1, beat._ve - beat._vs);
    return svg(DEFS + `<rect width="${W}" height="${H}" fill="url(#lkBack)"/>` + card(spec, u) + (MOOD ? LK.overlay(MOOD) : ''), GRADE);
  }
  const cam = cameraAt(beat, time), [sx, sy] = screenFx(beat, time, 'shake');
  if (!MOOD) { // the plain look: one flat background layer (like the first test shorts)
    const tr = `translate(${f1(W / 2 - cam.z * cam.fx + sx)},${f1(H / 2 - cam.z * cam.fy + sy)}) scale(${cam.z.toFixed(4)})`;
    return svg(`${DEFS}<g transform="${tr}">${BG_FLAT}${Object.keys(chars).map(id => charSvg(id, beat, time)).join('')}</g>` + screenFx(beat, time, 'flash'));
  }
  // depth: far + middle layers slide less and blur in close-ups
  const blur = sh.type === 'close' ? 7 : sh.type === 'medium' || sh.type === 'custom' ? 4 : 0;
  const wrap = (body, px) => { const id = LK.blurId(px); return id ? `<g filter="url(#${id})">${body}</g>` : body; };
  const lampInside = LYR.light.layer === 'near';
  let s = DEFS;
  s += `<g transform="${layerTf(cam, 0.3, sx * 0.3, sy * 0.3)}">${wrap(LYR.far + LK.skyTint(MOOD), blur)}${lampInside ? '' : LK.lightGlow(MOOD, LYR.light.x, LYR.light.y)}</g>`;
  if (LYR.mid) s += `<g transform="${layerTf(cam, 0.65, sx * 0.65, sy * 0.65)}">${wrap(LYR.mid, blur / 2)}</g>`;
  s += `<g transform="${layerTf(cam, 1, sx, sy)}">${LYR.near}${LK.groundTint(MOOD, LYR.shoreY)}${lampInside ? LK.lightGlow(MOOD, LYR.light.x, LYR.light.y) : ''}`;
  s += propsSvg(beat, time, 'near');
  if (!LYR.front) for (const id of Object.keys(chars)) if (!beat._cast[id].hidden) s += LK.groundShadow(beat._cast[id].x, CG - 4, S * (P.rig(chars[id].body).wb || 90) + 22);
  s += Object.keys(chars).map(id => charSvg(id, beat, time)).join('');
  s += (LYR.front || '') + propsSvg(beat, time, 'front') + sceneFx(beat, time) + '</g>';
  return svg(s + LK.overlay(MOOD) + screenFx(beat, time, 'flash'), GRADE);
}

function titleSvg(time) {
  if (!TITLE || time > story.beats[0]._end + 0.2) return '';
  const sc = 0.85 + 0.15 * Math.min(1, time / 0.18);
  const [a, b] = TITLE;
  return `<g transform="translate(540,365) rotate(-2) scale(${sc.toFixed(3)})">` +
    `<rect x="-420" y="-115" width="840" height="230" rx="24" fill="${INK}" opacity="0.22" transform="translate(8,10)"/>` +
    (DESIGN === 'v1' ? `<rect x="-420" y="-115" width="840" height="230" rx="24" fill="#FFFDF8" stroke="${INK}" stroke-width="7"/>`
      : `<rect x="-420" y="-115" width="840" height="230" rx="24" fill="#FFFDF8" stroke="#D3C7B6" stroke-width="3"/>`) +
    `<rect x="-330" y="-135" width="150" height="38" fill="#E8D6A0" opacity="0.9" transform="rotate(-6 -255 -116)"/>` +
    `<rect x="190" y="-135" width="150" height="38" fill="#E8D6A0" opacity="0.9" transform="rotate(5 265 -116)"/>` +
    `<text x="0" y="-20" text-anchor="middle" font-size="74" font-weight="700" word-spacing="8" fill="${INK}">${esc(a)}</text>` +
    `<text x="0" y="80" text-anchor="middle" font-size="96" font-weight="700" word-spacing="8" fill="#D9443B">${esc(b)}</text></g>`;
}

function captionSvg(time) {
  const line = lines.find(l => time >= l.start && time < l.end + 0.2);
  if (!line) return '';
  const rel = time - line.start;
  let ci = 0;
  line.chunks.forEach((c, k) => { if (rel >= c[0].start - 0.05) ci = k; });
  const chunk = line.chunks[ci];
  let active = chunk[0];
  for (const w of chunk) if (rel >= w.start) active = w;
  const len = chunk.reduce((s, w) => s + w.word.length + 1, -1);
  const size = Math.min(CAP.size, Math.floor(980 / (len * 0.56)));
  const pop = LK.ease((rel - (chunk[0].start - 0.05)) / 0.08), sc = 0.86 + 0.14 * pop; // each chunk pops in
  const spans = chunk.map(w => `<tspan fill="${w === active ? '#FFD23F' : '#FFFFFF'}">${esc(w.word)}</tspan>`).join(' ');
  // word-spacing: the thick outline would otherwise fill the gap between two white words
  return `<g transform="translate(540,${CAP.y}) scale(${sc.toFixed(3)})"><text x="0" y="0" text-anchor="middle" font-size="${size}" font-weight="700" word-spacing="${Math.round(size * 0.22)}" stroke="${INK}" stroke-width="${Math.round(size * 0.2)}" stroke-linejoin="round" paint-order="stroke">${spans}</text></g>`;
}

// ---------- 3) render + encode ----------
(async () => {
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({
    total, fps: FPS, lines: lines.map(l => ({ who: l.beat.who, start: +l.start.toFixed(2), end: +l.end.toFixed(2), words: l.ws.map(w => [w.word, +w.start.toFixed(2), +w.end.toFixed(2)]) })),
    shots: story.beats.map(b => ({ shot: b._shot, from: +b._vs.toFixed(2), to: +b._ve.toFixed(2) })),
  }, null, 1));
  const nFrames = Math.ceil(total * FPS);
  // check pictures: one per line, or (--check --at=30.5,31,31.2) exactly at those seconds
  const AT = typeof opt('at') === 'string' ? opt('at').split(',').map(Number).filter(n => !isNaN(n)) : null;
  const check = new Set((AT ? AT.map(s => Math.round(s * FPS)) : [Math.round(0.3 * FPS), ...story.beats.map(b => Math.round(((b._vs + b._ve) / 2) * FPS))]).filter(f => f < nFrames));
  // several hidden browsers draw at once (each frame is independent); the frames still go to FFmpeg in order
  const WORKERS = CHECK_ONLY ? 1 : Math.max(1, Math.min(6, Math.round(+(opt('workers') || story.workers || 3))));
  const rs = await Promise.all(Array.from({ length: WORKERS }, (_, k) => launch({ width: W, height: H, fontCss: fonts(), profile: k ? `autoanimate-render-${k + 1}` : 'autoanimate-render' })));
  const r = rs[0];
  const t0 = Date.now();
  if (CHECK_ONLY) {
    for (const f of [...check].sort((a, b) => a - b)) {
      const time = f / FPS, beat = beatAt(time);
      fs.writeFileSync(path.join(OUT, 'check', `frame-${String(f).padStart(4, '0')}.png`), await r.frame(sceneSvg(beat, time), svg(titleSvg(time) + captionSvg(time))));
    }
    await r.close();
    console.log(`✅ ${check.size} check pictures in ${path.relative(ROOT, path.join(OUT, 'check'))} (${((Date.now() - t0) / 1000).toFixed(0)} s, no video)`);
    return;
  }
  const audio = mixLines(lines, total, path.join(OUT, 'voice.wav'));
  const mp4 = path.join(ROOT, 'out', `${ID}.mp4`);
  // the graphics card's encoder (NVENC) if there is one: it leaves the processor free for drawing
  const nvenc = !opt('cpu') && spawnSync(FFMPEG, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.2', '-c:v', 'h264_nvenc', '-f', 'null', '-']).status === 0;
  const venc = nvenc ? ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '24', '-b:v', '0'] : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '19'];
  const ff = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-i', audio,
    '-map', '0:v', '-map', '1:a', ...venc, '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
  let prevKey = '', prevPng = null;
  for (let f0 = 0; f0 < nFrames; f0 += WORKERS) {
    const jobs = [];
    for (let k = 0; k < WORKERS && f0 + k < nFrames; k++) {
      const time = (f0 + k) / FPS, beat = beatAt(time);
      jobs.push({ f: f0 + k, a: sceneSvg(beat, time), b: svg(titleSvg(time) + captionSvg(time)) });
    }
    // a frame that looks exactly like the one before is not drawn again
    const keys = jobs.map(j => j.a + j.b);
    const drawn = await Promise.all(jobs.map((j, k) => ((k ? keys[k - 1] : prevKey) === keys[k] ? null : rs[k].frame(j.a, j.b))));
    for (let k = 0; k < jobs.length; k++) {
      const png = drawn[k] || (k ? drawn[k - 1] || prevPng : prevPng);
      drawn[k] = png;
      if (check.has(jobs[k].f)) fs.writeFileSync(path.join(OUT, 'check', `frame-${String(jobs[k].f).padStart(4, '0')}.png`), png);
      if (!ff.stdin.write(png)) await once(ff.stdin, 'drain');
      prevPng = png;
    }
    prevKey = keys[keys.length - 1];
    if (f0 % (FPS * 2) < WORKERS) process.stdout.write(`\r🎞️  frame ${f0}/${nFrames}`);
  }
  ff.stdin.end();
  await once(ff, 'close');
  await Promise.all(rs.map(x => x.close()));
  console.log(`\n✅ ${path.relative(ROOT, mp4)}: ${total.toFixed(1)} s, ${nFrames} frames at ${FPS} fps, made in ${((Date.now() - t0) / 1000).toFixed(0)} s (${WORKERS} browsers, ${nvenc ? 'graphics-card' : 'processor'} encoder)`);
})().catch(e => { console.error(e); process.exit(1); });
