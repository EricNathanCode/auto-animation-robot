'use strict';
// Mouth shapes + word timings from the line's words and how loud each moment is (no extra tools).
// Shapes are the 9 lip-sync letters of the base puppet: X A B C D E F G H.

const MOUTH_FPS = 12; // mouths change 12 times a second, like hand-made cutout animation

// loudness per video frame, 0..1
function envelope(wav, fps) {
  const hop = wav.rate / fps, n = Math.ceil(wav.samples.length / hop), out = new Float32Array(n);
  let max = 1e-6;
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = Math.floor(i * hop); j < Math.min(wav.samples.length, Math.floor((i + 1) * hop)); j++) { s += wav.samples[j] ** 2; c++; }
    out[i] = Math.sqrt(s / Math.max(1, c));
    if (out[i] > max) max = out[i];
  }
  for (let i = 0; i < n; i++) out[i] /= max;
  return out;
}

// caption words, each with a weight = how long it takes to say
function splitWords(text) {
  const out = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const clean = raw.replace(/[^A-Za-z0-9'-]/g, '');
    const letters = /\d/.test(clean) ? clean.replace(/\D/g, '').length * 4.5 : clean.replace(/[^A-Za-z]/g, '').length;
    const pause = /[.!?]$/.test(raw) ? 5 : /[,;:]$/.test(raw) ? 3 : 0;
    out.push({ word: raw, clean, weight: Math.max(2, letters) + 1.2, pause });
  }
  if (out.length) out[out.length - 1].pause = 0;
  return out;
}

// spread the words over the part of the line where there is sound
function timeWords(text, env, fps) {
  let a = 0, b = env.length - 1;
  while (a < b && env[a] < 0.06) a++;
  while (b > a && env[b] < 0.06) b--;
  const t0 = a / fps, t1 = (b + 1) / fps;
  const ws = splitWords(text);
  const total = ws.reduce((s, w) => s + w.weight + w.pause, 0) || 1;
  const unit = (t1 - t0) / total;
  let t = t0;
  for (const w of ws) { w.start = t; w.end = t + w.weight * unit; t = w.end + w.pause * unit; }
  return ws;
}

const VOWEL = { a: 'D', e: 'C', i: 'B', o: 'E', u: 'F', y: 'B' };
function letterShapes(word) {
  const w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/\d/.test(w)) return ['C', 'B', 'E', 'C', 'B', 'D', 'C', 'B'];
  const out = [];
  for (let i = 0; i < w.length; i++) {
    const c = w[i], n = w[i + 1];
    if ((c === 'o' && (n === 'o' || n === 'u')) || c === 'w') { out.push('F'); if (c === 'o') i++; continue; }
    if (c === 't' && n === 'h') { out.push('H'); i++; continue; }
    if ((c === 'c' || c === 's') && n === 'h') { out.push('B'); i++; continue; }
    if ('mbp'.includes(c)) out.push('A');
    else if ('fv'.includes(c)) out.push('G');
    else if (c === 'l') out.push('H');
    else if (VOWEL[c]) out.push(VOWEL[c]);
    else if (c === 'r') out.push('E');
    else out.push('B');
  }
  return out.filter((s, i) => s !== out[i - 1]);
}

// returns shapeAt(t) for t in seconds from the start of the line
function mouthTrack(ws, env, fps, duration) {
  const step = 1 / MOUTH_FPS, n = Math.ceil(duration / step), track = [];
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) * step;
    const e = env[Math.min(env.length - 1, Math.floor(t * fps))] || 0;
    const w = ws.find(x => t >= x.start && t < x.end);
    let shape;
    if (!w) shape = e > 0.3 ? 'B' : 'A';
    else {
      const sh = letterShapes(w.clean);
      shape = sh[Math.min(sh.length - 1, Math.floor((t - w.start) / (w.end - w.start) * sh.length))] || 'B';
      if (e < 0.08) shape = 'A';
      else if (shape === 'D' && e < 0.45) shape = 'C';
      else if ((shape === 'B' || shape === 'C') && e > 0.85) shape = 'D';
    }
    track.push(shape);
  }
  return t => (t < 0 || t >= duration ? 'X' : track[Math.min(track.length - 1, Math.floor(t / step))]);
}

// caption chunks: a few short words on screen at a time (the Style Bible: 1–2 words)
function chunks(ws, maxWords = 3, maxChars = 17) {
  const out = [];
  let cur = [];
  for (const w of ws) {
    const len = cur.reduce((s, x) => s + x.word.length + 1, 0) + w.word.length;
    if (cur.length && (cur.length >= maxWords || len > maxChars)) { out.push(cur); cur = []; }
    cur.push(w);
    if (/[.!?]$/.test(w.word)) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}

module.exports = { envelope, timeWords, mouthTrack, chunks, letterShapes };
