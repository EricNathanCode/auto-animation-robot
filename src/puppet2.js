'use strict';
/*
 * Auto Animate · puppet v2 "paper preset", built on the DEFAULT BODY the user gave (2026-11-09).
 * Measured from that picture (same units, a kid is ~300 tall): a ROUND head (r 102, centre 197 above the ground),
 * two big oval eyes that touch and lean in at the top, tiny dot pupils near the nose, a small frown mouth low on the
 * head, a bell-shaped body with the arms inside it (a crease line + a round mitten hand with a thumb circle at each
 * bottom corner), a short leg block and flat lens-shaped feet.
 * 3/4 view = ONE eye at the front edge of the head (it pokes out past the head), the near arm hanging down the middle
 * of the body with the hand at the waist. Back view: the shoulders' edge shows over the back of the head.
 * No ink outlines: flat construction-paper pieces with a hair-thin paper edge.
 * Views: front | q-right | q-left | back.   Legs: stand | sit | walk-a | walk-b.   Arms: down | up | point | hips | wave.
 * Our OWN characters only: the wardrobe (hair, hats, clothes, colours) makes every one different.
 * Units: (0,0) = the ground under the feet, up = negative y. Head parts use head-local units (0,0 = head centre).
 * (The first v2 draft is kept in old/v2-draft1.)
 */
const { shade } = require('./puppet');

const LINE = '#2A211E', EYE_EDGE = '#7D726A', PUPIL = '#151010', M_DARK = '#3D1A1A', M_TONGUE = '#D45F6C';
const SKIN_TONES = { light: '#FDE3C8', peach: '#FBD6A9', tan: '#D9A06F', brown: '#A86E45', deep: '#6E4428' }; // peach = the default body
const HEAD = { r: 102, rx: 102, ry: 102 };
// body half-widths from the top of the torso (t 0, hidden under the head) to its bottom (t 1), measured from the default body
const BODIES = {
  kid: {
    legH: 22, torsoH: 122, legW: 67.5, foot: 80, qLeg: [-38.5, 44.5], qFoot: [2, 48],
    front: [[0, 52], [0.26, 70], [0.39, 79], [0.525, 86.5], [0.66, 92], [0.77, 94], [0.9, 95], [1, 95]],
    qb: [[0, 38], [0.33, 47], [0.46, 51], [0.59, 54], [0.69, 56], [0.82, 57], [1, 57]], // 3/4: the back edge
    qf: [[0, 36], [0.33, 47], [0.46, 52], [0.59, 57], [0.69, 60], [0.82, 63], [1, 64]], // 3/4: the front edge
  },
  adult: {
    legH: 68, torsoH: 182, legW: 62, foot: 75, qLeg: [-35, 41], qFoot: [3, 45],
    front: [[0, 56], [0.2, 69], [0.35, 77], [0.5, 83], [0.7, 88], [0.85, 90], [1, 91]],
    qb: [[0, 40], [0.3, 47], [0.6, 53], [1, 56]],
    qf: [[0, 38], [0.3, 47], [0.6, 55], [1, 61]],
  },
};
const DEFAULTS = {
  top: { style: 'tee', color: '#DDE3EC' },
  bottom: { style: 'shorts', color: '#9AA3AE' },
  shoes: { style: 'plain', color: '#2A2426' },
};

// ---------- helpers ----------
const r1 = n => Math.round(n * 10) / 10;
const P = (x, y) => `${r1(x)},${r1(y)}`;
const pts = a => a.map(p => P(p[0], p[1])).join(' ');
const polygon = a => `<polygon points="${pts(a)}"/>`;
const pathEl = d => `<path d="${d}"/>`;
const circle = (x, y, r) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}"/>`;
const rect = (x, y, w, h, rx = 0) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(rx)}"/>`;
function ellipse(x, y, rx, ry, rot = 0) {
  const t = rot ? ` transform="rotate(${r1(rot)} ${r1(x)} ${r1(y)})"` : '';
  return `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}"${t}/>`;
}
// a paper piece: flat colour + a hair-thin darker paper edge around the whole piece (no black outline)
function paper(shapes, fill, edge = 1.3) {
  const s = [].concat(shapes).join('');
  if (!edge) return `<g fill="${fill}">${s}</g>`;
  const ec = shade(fill, -0.32);
  return `<g fill="${ec}" stroke="${ec}" stroke-width="${edge * 2}" stroke-linejoin="round">${s}</g><g fill="${fill}">${s}</g>`;
}
const stroke = (d, color, w, cap = 'round') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
function tube(d, color, w, edge = 1.3) { return stroke(d, shade(color, -0.32), w + edge * 2) + stroke(d, color, w); }
const qd = (S, C, H) => `M ${P(...S)} Q ${P(...C)} ${P(...H)}`;
const arc = (cx, cy, rx, ry, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const t = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
  return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
});
function ringCircles(R, a0, a1, step, r) {
  const out = [];
  for (let a = a0; a <= a1 + 0.01; a += step) { const t = a * Math.PI / 180; out.push(circle(R * Math.cos(t), R * Math.sin(t), r)); }
  return out;
}
function clipAbove(poly, a, b) {
  const side = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const out = [], cut = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
      const t = sp / (sp - sq), x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      out.push(x); cut.push(x);
    }
  }
  return { poly: out, cut };
}
// points on an ellipse turned by rot degrees
function ellPts(cx, cy, rx, ry, rot = 0, n = 64) {
  const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
  return Array.from({ length: n }, (_, i) => {
    const t = 2 * Math.PI * i / n, x = rx * Math.cos(t), y = ry * Math.sin(t);
    return [cx + x * c - y * s, cy + x * s + y * c];
  });
}
// half-width + half-height of a turned ellipse
function extent(rx, ry, rot) {
  const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
  return [Math.sqrt(rx * rx * c * c + ry * ry * s * s), Math.sqrt(rx * rx * s * s + ry * ry * c * c)];
}
// a smooth value along [t, value] points (Catmull-Rom)
function curveAt(list, t) {
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < list.length - 2 && t > list[i + 1][0]) i++;
  const p0 = list[Math.max(0, i - 1)][1], p1 = list[i][1], p2 = list[i + 1][1], p3 = list[Math.min(list.length - 1, i + 2)][1];
  const u = (t - list[i][0]) / ((list[i + 1][0] - list[i][0]) || 1);
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}

// ---------- rig ----------
function rig(type) {
  const b = BODIES[type] || BODIES.kid;
  const legBottom = -5, B = legBottom - b.legH - 1, T = B - b.torsoH, cy = T - 47; // kid: B -28, T -150, head centre -197
  const r = Object.assign({ type, legBottom, legTop: B - 12, B, T, cy, headTop: cy - HEAD.r, hb: cy + HEAD.r }, b);
  r.wt = curveAt(b.front, 0.45); r.wb = curveAt(b.front, 1);
  return r;
}
const tOf = (r, y) => (y - r.T) / (r.B - r.T);
const hwAt = (r, y) => curveAt(r.front, tOf(r, y));      // front/back: half-width at height y
const qBackAt = (r, y) => -curveAt(r.qb, tOf(r, y));     // 3/4 facing right: the back edge (x < 0)
const qForeAt = (r, y) => curveAt(r.qf, tOf(r, y));      // 3/4 facing right: the front edge (x > 0)
const skinOf = ch => SKIN_TONES[ch.skin] || ch.skin || SKIN_TONES.peach;
const viewOf = view => (/right|left|^q$/.test(view) ? 'q' : view === 'back' ? 'back' : 'front');

// ---------- the face ----------
// eyes: [x, rx, ry, outer (-1 = its outer end is on the left), lean in degrees]. The 3/4 eye's nose side is the front.
const FACE = {
  front: { ey: 4.5, eyes: [[-29, 27.5, 32.7, -1, 27], [29, 27.5, 32.7, 1, -27]], mouth: [0, 70, 1.1, 1.1], pupil: [12.75, 2.5] },
  q: { ey: 6.5, eyes: [[78, 27.5, 32.7, -1, 27]], mouth: [55, 70, 0.75, 0.95], pupil: [19.5, -2] },
};
const EYES = {
  open: { label: 'open' }, lookL: { label: 'look left', g: [-0.75, 0] }, lookR: { label: 'look right', g: [0.75, 0] },
  lookU: { label: 'look up', g: [0, -0.7] }, lookD: { label: 'look down', g: [0, 0.6] },
  half: { label: 'blink', lid: [0.5, 0.5] }, closed: { label: 'closed', closed: true }, happy: { label: 'happy', happy: true, brow: 'up' },
  angry: { label: 'angry', lid: [0.12, 0.46], brow: 'angry', pr: 3.4 }, sad: { label: 'sad', lid: [0.44, 0.14], brow: 'sad' },
  shock: { label: 'shocked', scale: 1.1, pr: 2.8, brow: 'up' }, squint: { label: 'squint', lid: [0.36, 0.36], brow: 'flat' },
};
const BROWS = ['calm', 'angry', 'sad', 'up', 'flat', 'furious', 'worried', 'skeptic'];
const MOUTHS = ['X', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'smile', 'frown', 'yell', 'smirk'];

// one eye in 3 layers, so two touching eyes merge into one white shape (no line between them, like the default body):
// 'white' = the white with its thin edge, 'fill' = the white again without the edge, 'detail' = pupil + eyelid
function eye(cx, cy, rx, ry, outer, rot, pose, skin, pup, layer = 'all') {
  const ps = EYES[pose] || EYES.open, k = ps.scale || 1;
  rx *= k; ry *= k;
  const tr = rot ? ` transform="rotate(${rot} ${r1(cx)} ${r1(cy)})"` : '';
  const E = `cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}"${tr}`;
  const [hx, hy] = extent(rx, ry, rot);
  if (ps.happy || ps.closed) {
    if (layer !== 'all' && layer !== 'detail') return '';
    if (ps.happy) return `<g${tr}>${stroke(`M ${P(cx - rx * 0.78, cy + 6)} Q ${P(cx, cy - ry * 0.8)} ${P(cx + rx * 0.78, cy + 6)}`, LINE, 3.2)}</g>`;
    return `<ellipse ${E} fill="${skin}" stroke="${EYE_EDGE}" stroke-width="1.3"/>` +
      `<g${tr}>${stroke(`M ${P(cx - rx * 0.82, cy + ry * 0.1)} Q ${P(cx, cy + ry * 0.55)} ${P(cx + rx * 0.82, cy + ry * 0.1)}`, LINE, 2.6)}</g>`;
  }
  if (layer === 'white') return `<ellipse ${E} fill="#FFFFFF" stroke="${EYE_EDGE}" stroke-width="1.3"/>`;
  if (layer === 'fill') return `<ellipse ${E} fill="#FFFFFF"/>`;
  let s = layer === 'all' ? `<ellipse ${E} fill="#FFFFFF" stroke="${EYE_EDGE}" stroke-width="1.3"/>` : '';
  // the pupil sits near the nose side (like the default body) and moves with the gaze, always inside the eye
  const pr = ps.pr || 3.3, g = ps.g || [0, 0];
  let dx = -outer * pup[0] * (1 - Math.abs(g[0])) + g[0] * (rx - 8), dy = pup[1] + g[1] * (ry - 12);
  if (ps.lid) { // keep the pupil below the eyelid, or the eye looks blank (white)
    const top = cy - hy, ya = top + 2 * hy * (outer < 0 ? ps.lid[0] : ps.lid[1]), yb = top + 2 * hy * (outer < 0 ? ps.lid[1] : ps.lid[0]);
    const yLine = ya + (yb - ya) * ((cx + dx - (cx - hx)) / (2 * hx));
    if (cy + dy - pr < yLine + 3) dy = yLine + pr + 3 - cy;
  }
  const a = -rot * Math.PI / 180;
  let lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  const fit = (lx / (rx - pr - 3)) ** 2 + (ly / (ry - pr - 3)) ** 2;
  if (fit > 1) { lx /= Math.sqrt(fit); ly /= Math.sqrt(fit); }
  dx = lx * Math.cos(-a) - ly * Math.sin(-a); dy = lx * Math.sin(-a) + ly * Math.cos(-a);
  s += `<circle cx="${r1(cx + dx)}" cy="${r1(cy + dy)}" r="${pr}" fill="${PUPIL}"/>`;
  if (ps.lid) {
    const top = cy - hy, yo = top + 2 * hy * ps.lid[0], yi = top + 2 * hy * ps.lid[1];
    const { poly, cut } = clipAbove(ellPts(cx, cy, rx, ry, rot), [cx - hx, outer < 0 ? yo : yi], [cx + hx, outer < 0 ? yi : yo]);
    if (poly.length > 2) s += `<polygon points="${pts(poly)}" fill="${skin}" stroke="${EYE_EDGE}" stroke-width="1.3" stroke-linejoin="round"/>`;
    if (cut.length === 2) s += stroke(`M ${P(...cut[0])} L ${P(...cut[1])}`, LINE, 2.4);
  }
  return s;
}
function eyesSvg(v, pose, skin) {
  const F = FACE[v === 'q' ? 'q' : 'front'];
  return ['white', 'fill', 'detail'].map(layer => F.eyes.map(([x, rx, ry, outer, rot]) => eye(x, F.ey, rx, ry, outer, rot, pose, skin, F.pupil, layer)).join('')).join('');
}
function browsSvg(v, pose, color) {
  const F = FACE[v === 'q' ? 'q' : 'front'];
  let s = '';
  for (const [x, rx, ry, outer, rot] of F.eyes) {
    const hy = extent(rx, ry, rot)[1], half = 16, by = F.ey - hy - 7, bx = x - outer * 5;
    let yo = by + 2, yi = by - 2; // calm: the nose end a little higher, like the eyes
    if (pose === 'angry') { yo = by - 5; yi = by + 6; } else if (pose === 'furious') { yo = by - 8; yi = by + 9; }
    else if (pose === 'sad') { yo = by + 5; yi = by - 8; } else if (pose === 'worried') { yo = by + 2; yi = by - 11; }
    else if (pose === 'up') { yo = by - 8; yi = by - 10; } else if (pose === 'flat') { yo = by; yi = by; }
    else if (pose === 'skeptic') { const up = outer > 0; yo = up ? by - 9 : by + 2; yi = up ? by - 5 : by + 2; }
    s += stroke(`M ${P(bx + outer * half, yo)} Q ${P(bx, Math.min(yo, yi) - 2)} ${P(bx - outer * half, yi)}`, color, 3.2);
  }
  return s;
}
function openM(hw, depth, tongue, top = -4) {
  const d = `M ${-hw},${top} Q 0,${top - 3} ${hw},${top} Q ${hw - 1},${depth - 2} 0,${depth} Q ${-hw + 1},${depth - 2} ${-hw},${top} Z`;
  let s = `<path d="${d}" fill="${M_DARK}"/>`;
  s += `<path d="M ${-hw + 2},${top} Q 0,${top - 2.5} ${hw - 2},${top} L ${hw - 3},${top + 4} Q 0,${top + 2} ${-hw + 3},${top + 4} Z" fill="#FFFFFF"/>`;
  if (tongue) s += `<ellipse cx="${tongue[0]}" cy="${tongue[1]}" rx="${tongue[2]}" ry="${tongue[3]}" fill="${M_TONGUE}"/>`;
  return s + `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>`;
}
function mouthSvg(m) {
  switch (m) {
    case 'A': return stroke('M -11,1 Q 0,2 11,1', LINE, 3.2);
    case 'B': return `<rect x="-12" y="-4.5" width="24" height="10" rx="5" fill="#FFFFFF" stroke="${LINE}" stroke-width="2"/>` + stroke('M -9,0.5 L 9,0.5', LINE, 1.4);
    case 'C': return openM(13, 11, [0, 7, 6, 3]);
    case 'D': return openM(15, 19, [0, 12.5, 8, 4.5]);
    case 'E': return `<ellipse cx="0" cy="3" rx="8.5" ry="10" fill="${M_DARK}" stroke="${LINE}" stroke-width="2"/><ellipse cx="0" cy="8.5" rx="4.5" ry="2.4" fill="${M_TONGUE}"/>`;
    case 'F': return `<ellipse cx="0" cy="2" rx="5" ry="6" fill="${M_DARK}" stroke="${LINE}" stroke-width="2.4"/>`;
    case 'G': {
      const d = 'M -11,-4 Q 0,-6 11,-4 Q 9,5 0,6 Q -9,5 -11,-4 Z';
      return `<path d="${d}" fill="${M_DARK}"/><path d="M -9,-4 Q 0,-6 9,-4 L 8,2 Q 0,3 -8,2 Z" fill="#FFFFFF"/><path d="${d}" fill="none" stroke="${LINE}" stroke-width="2"/>` +
        stroke('M -8,7 Q 0,10 8,7', LINE, 2.4);
    }
    case 'H': return openM(13, 11, [0, 1.5, 6, 4.5]);
    case 'smile': {
      const d = 'M -15,-4 Q 0,1 15,-4 Q 13,12 0,13 Q -13,12 -15,-4 Z';
      return `<path d="${d}" fill="${M_DARK}"/><path d="M -13,-3.6 Q 0,0.8 13,-3.6 L 12,0.6 Q 0,4.4 -12,0.6 Z" fill="#FFFFFF"/>` +
        `<ellipse cx="0" cy="9.5" rx="6.5" ry="2.8" fill="${M_TONGUE}"/><path d="${d}" fill="none" stroke="${LINE}" stroke-width="2"/>`;
    }
    case 'frown': return stroke('M -12,5 Q 0,-7 12,5', LINE, 3);
    case 'yell': return openM(17, 26, [0, 17, 10, 6], -6);
    case 'smirk': return stroke('M -11,2 Q 2,4 12,-3', LINE, 3);
    default: return stroke('M -14,3 Q 0,-4 14,3', LINE, 2.6); // X = rest: the default body's small frown
  }
}
function mouthAt(v, m) {
  const [x, y, sx, sy] = FACE[v === 'q' ? 'q' : 'front'].mouth;
  return `<g transform="translate(${x},${y}) scale(${sx},${sy})">${mouthSvg(m)}</g>`;
}

// ---------- hair, hats, beards, glasses (head-local, the head is a circle r 102) ----------
function curlMarks(points, col) {
  return points.map(([x, y]) => stroke(`M ${x - 6},${y + 2} Q ${x},${y - 6} ${x + 6},${y + 2}`, col, 2.4)).join('');
}
function hairSvg(v, hair) {
  const st = hair.style, col = hair.color || '#3B2A20', hi = shade(col, 0.22);
  if (!st || st === 'none') return '';
  if (st === 'curly') {
    if (v === 'back') {
      const sh = [polygon(arc(0, 0, 106, 106, 152, 388, 40)), ...ringCircles(104, 150, 390, 13, 16)];
      for (let x = -84; x <= 84; x += 21) sh.push(circle(x, 50, 14));
      return paper(sh, col) + curlMarks([[-52, -56], [0, -70], [52, -56], [-76, -6], [-26, -18], [26, -18], [76, -6], [-44, 26], [44, 26], [0, 22]], hi);
    }
    if (v === 'q') { // 3/4: the curls cover the top and the back of the head; the hairline rises to the front
      const line = [[88, -50], [66, -58], [42, -60], [20, -56], [2, -44], [-10, -26], [-18, -4], [-26, 20], [-38, 44], [-52, 64], [-64, 78]];
      const sh = [polygon(arc(0, 0, 106, 106, 130, 330, 40).concat(line)), ...ringCircles(104, 132, 326, 13, 16)];
      for (const [x, y] of line.slice(0, -1)) sh.push(circle(x, y, 12));
      return paper(sh, col) + curlMarks([[-64, -70], [-26, -84], [14, -84], [50, -74], [-86, -30], [-82, 8], [-74, 40]], hi);
    }
    const line = [[98, -14], [90, -30], [76, -44], [54, -54], [28, -58], [0, -59], [-28, -58], [-54, -54], [-76, -44], [-90, -30], [-98, -14]];
    const sh = [polygon(arc(0, 0, 106, 106, 190, 350, 32).concat(line)), ...ringCircles(104, 188, 352, 13, 16)];
    for (const [x, y] of line) sh.push(circle(x, y, 12));
    return paper(sh, col) + curlMarks([[-64, -78], [-26, -88], [16, -88], [58, -78], [-90, -44], [90, -44], [0, -96]], hi);
  }
  if (st === 'bob') {
    const sl = shade(col, 0.16);
    if (v === 'back') return paper(polygon(arc(0, 0, 112, 112, 30, -210, 44)), col) + stroke('M 0,-104 L 0,52 M -52,-92 Q -64,-20 -60,52 M 52,-92 Q 64,-20 60,52', sl, 2.4);
    if (v === 'q') {
      const p = [...arc(0, 0, 112, 112, -22, -202, 40), [-106, 56], [-2, 56], [0, 30], [6, 4], [14, -16], [26, -32], [46, -42], [76, -46], [100, -44]];
      return paper(polygon(p), col) + stroke('M -62,-72 Q -84,-20 -86,50 M -22,-92 Q -48,-46 -52,50', sl, 2.4);
    }
    const p = [...arc(0, 0, 112, 112, 28.8, -208.8, 44), [-68, 54], [-66, 10], [-63, -22], [-60, -38], [-30, -40], [0, -40], [30, -40], [60, -38], [63, -22], [66, 10], [68, 54]];
    return paper(polygon(p), col) + stroke('M -40,-86 Q -52,-74 -58,-62 M 38,-88 Q 50,-76 56,-64 M -100,-10 Q -104,20 -102,48 M 100,-10 Q 104,20 102,48', sl, 2.4);
  }
  if (st === 'short') {
    if (v === 'back') {
      const p = arc(0, 0, 104, 104, 160, 380, 36);
      for (let i = 0; i <= 8; i++) p.push([97 - i * (194 / 8), i % 2 ? 30 : 40]);
      return paper(polygon(p), col);
    }
    if (v === 'q') return paper(polygon([...arc(0, 0, 104, 104, 135, 335, 36), [80, -50], [50, -56], [24, -50], [6, -36], [-6, -14], [-14, 12], [-24, 38], [-40, 60], [-58, 78]]), col);
    return paper(polygon([...arc(0, 0, 104, 104, 196, 344, 30), [92, -40], [60, -56], [0, -62], [-60, -56], [-92, -40]]), col);
  }
  return '';
}
function helmetSvg(v, h) {
  const steel = h.color || '#A9B4C2', band = h.band || '#B8873A', rivet = shade(band, -0.4);
  const R = 108, rim = -34, y0 = -52;
  const xAt = y => Math.sqrt(Math.max(0, R * R - y * y));
  const a = Math.asin(rim / R) * 180 / Math.PI;
  let s = paper(polygon(arc(0, 0, R, R, 180 - a, 360 + a, 40)), steel);
  s += stroke(`M ${r1(-R * 0.52)},${r1(-R * 0.7)} Q ${r1(-R * 0.28)},${r1(-R * 0.86)} -12,${r1(-R * 0.9)}`, '#FFFFFF', 4);
  s += paper(polygon([[-xAt(y0) - 3, y0], [xAt(y0) + 3, y0], [xAt(rim) + 4, rim], [-xAt(rim) - 4, rim]]), band);
  const x0 = v === 'q' ? 46 : 0, top = -Math.sqrt(R * R - x0 * x0);
  s += paper(pathEl(`M ${x0 - 8},${y0} L ${x0 - 8},${r1(top + 8)} Q ${x0},${r1(top)} ${x0 + 8},${r1(top + 8)} L ${x0 + 8},${y0} Z`), band);
  for (const x of [-66, -34, 34, 66]) {
    const xx = x + (v === 'q' ? 18 : 0);
    if (Math.abs(xx - x0) > 14 && Math.abs(xx) < xAt(y0) - 8) s += `<circle cx="${xx}" cy="${(y0 + rim) / 2}" r="3" fill="${rivet}"/>`;
  }
  // 3/4: like a paper-cutout hat, it tips back (the front rim rises above the eye)
  return v === 'q' ? `<g transform="rotate(-16)">${s}</g>` : s;
}
// a horn: a crescent along a curve, wide at the base, pointed at the tip
function hornSvg(base, ctrl, tip, w0, col) {
  const a = [], b = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14, q = 1 - u;
    const x = q * q * base[0] + 2 * u * q * ctrl[0] + u * u * tip[0], y = q * q * base[1] + 2 * u * q * ctrl[1] + u * u * tip[1];
    const dx = 2 * q * (ctrl[0] - base[0]) + 2 * u * (tip[0] - ctrl[0]), dy = 2 * q * (ctrl[1] - base[1]) + 2 * u * (tip[1] - ctrl[1]);
    const L = Math.hypot(dx, dy) || 1, w = w0 * q + 0.8;
    a.push([x - dy / L * w, y + dx / L * w]); b.push([x + dy / L * w, y - dx / L * w]);
  }
  return paper(polygon(a.concat(b.reverse())), col);
}
// a toy "Viking" helmet with horns (the myth!): plastic dome, gold band, cream horns
function hornedSvg(v, h) {
  const plastic = h.color || '#C9CFD8', band = h.band || '#E2B33C', horn = h.horn || '#F4EBD8';
  const R = 106, rim = -30, xAt = y => Math.sqrt(Math.max(0, R * R - y * y)), a = Math.asin(rim / R) * 180 / Math.PI;
  let s = v === 'q'
    ? hornSvg([-78, -62], [-150, -80], [-150, -186], 17, horn) + hornSvg([84, -60], [150, -84], [140, -190], 17, horn)
    : [-1, 1].map(k => hornSvg([k * 86, -58], [k * 168, -86], [k * 150, -188], 17, horn)).join('');
  s += paper(polygon(arc(0, 0, R, R, 180 - a, 360 + a, 40)), plastic);
  s += stroke(`M ${r1(-R * 0.5)},${r1(-R * 0.68)} Q ${r1(-R * 0.28)},${r1(-R * 0.84)} -12,${r1(-R * 0.88)}`, '#FFFFFF', 4);
  s += paper(polygon([[-xAt(-46) - 3, -46], [xAt(-46) + 3, -46], [xAt(rim) + 4, rim], [-xAt(rim) - 4, rim]]), band);
  return v === 'q' ? `<g transform="rotate(-16)">${s}</g>` : s;
}
// a soup pot worn upside down: a steel bucket with a rim and two handles
function potSvg(v, h) {
  const steel = h.color || '#8E959E', rimCol = h.band || '#B8BFC8', handle = shade(steel, -0.3), top = -122, rim = -28, w = 100;
  let s = [-1, 1].map(k => tube(`M ${k * (w - 4)},-92 Q ${k * (w + 26)},-92 ${k * (w + 26)},-75 Q ${k * (w + 26)},-58 ${k * (w - 4)},-58`, handle, 7)).join('');
  s += paper(pathEl(`M ${-w},${rim} L ${-w + 4},${top + 10} Q ${-w + 4},${top} ${-w + 16},${top} L ${w - 16},${top} Q ${w - 4},${top} ${w - 4},${top + 10} L ${w},${rim} Z`), steel);
  s += paper(rect(-w - 4, rim - 14, 2 * w + 8, 16, 6), rimCol) + paper(rect(-w + 2, top - 6, 2 * w - 4, 12, 6), rimCol);
  s += stroke(`M ${-w * 0.55},${top + 22} L ${-w * 0.55},${rim - 22}`, '#FFFFFF', 4);
  return v === 'q' ? `<g transform="rotate(-16)">${s}</g>` : s;
}
function hatSvg(v, hat) {
  if (!hat) return '';
  if (hat.style === 'helmet') return helmetSvg(v, hat);
  if (hat.style === 'horned') return hornedSvg(v, hat);
  if (hat.style === 'pot') return potSvg(v, hat);
  return '';
}
function beardSvg(v, b) {
  if (v === 'back') return '';
  if (v === 'q') {
    const p = [[-14, -36], [6, -36], [8, 0], [20, 30], [44, 44], [70, 46], [96, 40], [106, 56], [108, 84], [100, 112], [80, 132], [50, 140], [20, 136], [-6, 120], [-22, 96], [-28, 60], [-26, 20], [-22, -10]];
    const fluff = [[-22, 92], [-8, 116], [16, 132], [46, 138], [74, 130], [96, 112], [106, 86]].map(([x, y]) => circle(x, y, 14));
    return paper([polygon(p), ...fluff], b.color);
  }
  const p = [[104, -36], [86, -36], [84, 0], [78, 30], [60, 44], [30, 48], [0, 46], [-30, 48], [-60, 44], [-78, 30], [-84, 0], [-86, -36], [-104, -36], [-106, 0],
    ...arc(0, 0, 104, 140, 180, 0, 30), [106, 0]];
  const fluff = [];
  for (let a = 30; a <= 150; a += 15) { const t = a * Math.PI / 180; fluff.push(circle(100 * Math.cos(t), 134 * Math.sin(t), 14)); }
  return paper([polygon(p), ...fluff], b.color);
}
function moustacheSvg(v, b) {
  const col = shade(b.color, -0.08);
  if (v === 'q') return paper(ellipse(62, 58, 16, 7, -8), col);
  if (v === 'front') return paper([ellipse(-14, 58, 16, 7, 12), ellipse(14, 58, 16, 7, -12)], col);
  return '';
}
function glassesSvg(v, g) {
  if (v === 'back') return '';
  const col = g.color || LINE, F = FACE[v === 'q' ? 'q' : 'front'];
  let s = v === 'q' ? '' : stroke('M -61,-2 L -101,-8 M 61,-2 L 101,-8', col, 3); // no arm across the face in 3/4
  for (const [x, rx, ry, , rot] of F.eyes) {
    s += `<ellipse cx="${x}" cy="${F.ey}" rx="${rx + 4}" ry="${ry + 4}" transform="rotate(${rot} ${x} ${F.ey})" fill="#FFFFFF" fill-opacity="0.1" stroke="${col}" stroke-width="3.4"/>`;
  }
  return s;
}
// Only the eyelid paper pieces (front view), for the preset sheet
function lidsSvg(pose, skin) {
  const ps = EYES[pose] || EYES.half, F = FACE.front;
  return F.eyes.map(([x, rx, ry, outer, rot]) => {
    const cy = F.ey, tr = ` transform="rotate(${rot} ${x} ${cy})"`, [hx, hy] = extent(rx, ry, rot);
    if (ps.closed) {
      return `<ellipse cx="${x}" cy="${cy}" rx="${rx}" ry="${ry}"${tr} fill="${skin}" stroke="${EYE_EDGE}" stroke-width="1.3"/>` +
        `<g${tr}>${stroke(`M ${P(x - rx * 0.82, cy + ry * 0.1)} Q ${P(x, cy + ry * 0.55)} ${P(x + rx * 0.82, cy + ry * 0.1)}`, LINE, 2.6)}</g>`;
    }
    const top = cy - hy, yo = top + 2 * hy * ps.lid[0], yi = top + 2 * hy * ps.lid[1];
    const { poly, cut } = clipAbove(ellPts(x, cy, rx, ry, rot), [x - hx, outer < 0 ? yo : yi], [x + hx, outer < 0 ? yi : yo]);
    return `<polygon points="${pts(poly)}" fill="${skin}" stroke="${EYE_EDGE}" stroke-width="1.3" stroke-linejoin="round"/>` +
      (cut.length === 2 ? stroke(`M ${P(...cut[0])} L ${P(...cut[1])}`, LINE, 2.4) : '');
  }).join('');
}

// The head on its own (head-local). view: front | q-right | q-left | back.  parts: all | skin | hair (the back view splits it)
function headSvg(ch, view = 'front', face = {}, parts = 'all') {
  if (/left/.test(view)) return `<g transform="scale(-1,1)">${headSvg(ch, 'q-right', face, parts)}</g>`;
  const v = viewOf(view), skin = skinOf(ch), hair = ch.hair || { style: 'none' }, ex = ch.extras || {};
  const eyes = face.eyes || 'open', mouth = face.mouth || 'X';
  const browCol = ch.brows || (hair.style && hair.style !== 'none' ? shade(hair.color, -0.25) : LINE);
  let s = parts === 'hair' ? '' : paper(circle(0, 0, HEAD.r), v === 'back' ? shade(skin, -0.03) : skin);
  if (parts === 'skin') return s;
  s += hairSvg(v, hair);
  if (v !== 'back') {
    if (ex.beard) s += beardSvg(v, ex.beard);
    s += eyesSvg(v, eyes, skin);
    s += browsSvg(v, face.brows || (EYES[eyes] || {}).brow || 'calm', browCol);
    s += mouthAt(v, mouth);
    if (ex.beard) s += moustacheSvg(v, ex.beard);
    if (ex.glasses) s += glassesSvg(v, ex.glasses);
  }
  s += hatSvg(v, ch.hat);
  return s;
}

// ---------- body ----------
// the torso outline: a bell (front/back) or the narrower 3/4 shape, with round bottom corners
function torsoPts(v, r, y0 = r.T) {
  const R = v === 'q' ? 8 : 16, n = 24, out = [];
  const right = v === 'q' ? y => qForeAt(r, y) : y => hwAt(r, y);
  const left = v === 'q' ? y => qBackAt(r, y) : y => -hwAt(r, y);
  for (let i = 0; i <= n; i++) { const y = y0 + (r.B - R - y0) * i / n; out.push([right(y), y]); }
  const xr = right(r.B), xl = left(r.B);
  for (let a = 15; a <= 90; a += 15) { const t = a * Math.PI / 180; out.push([xr - R + R * Math.cos(t), r.B - R + R * Math.sin(t)]); }
  for (let a = 90; a <= 165; a += 15) { const t = a * Math.PI / 180; out.push([xl + R + R * Math.cos(t), r.B - R + R * Math.sin(t)]); }
  for (let i = n; i >= 0; i--) { const y = y0 + (r.B - R - y0) * i / n; out.push([left(y), y]); }
  return out;
}
// back view: the shoulders' edge is a low dome over the back of the head
function backTorsoPts(r) {
  const y1 = r.T + 38, x1 = hwAt(r, y1), dome = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    dome.push([-x1 + 2 * x1 * u, (1 - u) * (1 - u) * y1 + 2 * u * (1 - u) * (y1 - 42) + u * u * y1]);
  }
  return dome.concat(torsoPts('back', r, y1).slice(1, -1));
}
function patch(x, y, p) {
  const bolt = [[1.6, -7], [-4, 1], [0, 1], [-1.6, 7], [4, -1], [0, -1]].map(([a, b]) => [x + a, y + b]);
  return paper(circle(x, y, 10.5), p.color || '#2BA59A', 1) + `<polygon points="${pts(bolt)}" fill="#FFFFFF"/>`;
}
function torsoSvg(v, r, top) {
  let s = paper(polygon(v === 'back' ? backTorsoPts(r) : torsoPts(v, r)), top.color);
  const dk = shade(top.color, -0.16), hb = r.hb, B = r.B, ox = v === 'q' ? 32 : 0;
  const L = y => (v === 'q' ? qBackAt(r, y) : -hwAt(r, y)) - 1.5, R = y => (v === 'q' ? qForeAt(r, y) : hwAt(r, y)) + 1.5;
  if (top.style === 'hoodie' && v !== 'back') {
    const pw = v === 'q' ? 26 : 40;
    s += paper(pathEl(`M ${ox - pw},${B - 46} L ${ox + pw},${B - 46} L ${ox + pw + 5},${B - 12} L ${ox - pw - 5},${B - 12} Z`), dk, 1);
    if (top.patch) s += patch(ox, B - 29, top.patch);
  } else if (top.style === 'blazer') {
    if (v !== 'back') {
      s += paper(polygon([[ox - 18, hb - 20], [ox + 18, hb - 20], [ox, hb + 44]]), top.shirt || '#FFFFFF', 1);
      s += paper(polygon([[ox - 18, hb - 20], [ox - 36, hb - 20], [ox - 5, hb + 52], [ox, hb + 44]]), dk, 1);
      s += paper(polygon([[ox + 18, hb - 20], [ox + 36, hb - 20], [ox + 5, hb + 52], [ox, hb + 44]]), dk, 1);
      for (const y of [hb + 66, hb + 86]) if (y < B - 10) s += `<circle cx="${ox}" cy="${y}" r="4" fill="${shade(top.color, -0.42)}"/>`;
    } else s += stroke(`M 0,${r1(r.T + 50)} L 0,${B - 2}`, shade(top.color, -0.25), 2.4);
  } else if (top.style === 'tunic') {
    const y0 = B - 38, y1 = B - 24, belt = top.belt || '#6B4226';
    s += paper(polygon([[L(y0), y0], [R(y0), y0], [R(y1), y1], [L(y1), y1]]), belt, 1);
    if (v !== 'back') s += paper(rect(ox - 9, y0 - 3, 18, y1 - y0 + 6, 3), top.buckle || '#E2B33C', 1) + `<rect x="${ox - 4}" y="${y0 + 3}" width="8" height="${y1 - y0 - 6}" fill="${belt}"/>`;
  } else if (top.style === 'jacket' && v !== 'back') {
    s += stroke(`M ${ox},${hb} L ${ox},${B - 3}`, shade(top.color, -0.28), 2);
    for (const y of [hb + 16, hb + 36, hb + 56]) if (y < B - 8) s += `<circle cx="${ox - 7}" cy="${y}" r="3" fill="${shade(top.color, -0.5)}"/>`;
  }
  return s;
}
function neckSvg(v, r, top, ex) {
  let s = '';
  const hb = r.hb, dk = shade(top.color, -0.16), ox = v === 'q' ? -26 : 0;
  if (top.style === 'hoodie') {
    if (v === 'back') s += paper(pathEl(`M -52,${r1(r.T + 30)} Q -58,${r1(r.T + 84)} 0,${r1(r.T + 96)} Q 58,${r1(r.T + 84)} 52,${r1(r.T + 30)} Z`), dk);
    else s += paper(ellipse(ox, hb - 10, v === 'q' ? 52 : 72, 22), dk) + (v === 'front' ? stroke(`M -13,${hb + 2} L -14,${hb + 24} M 13,${hb + 2} L 14,${hb + 24}`, '#FFFFFF', 3) : '');
  } else if (top.style === 'jacket' || top.collar) {
    s += paper(ellipse(ox, hb - 4, 64, 15), top.collar || dk);
  }
  if (ex.pearls && v !== 'back') {
    const c = ex.pearls.color || '#FFF4DC', px = v === 'q' ? 30 : 0;
    for (let i = -5; i <= 5; i++) s += `<circle cx="${r1(px + i * 5.4)}" cy="${r1(hb + 6 + 14 * (1 - (i / 6) ** 2))}" r="3.8" fill="${c}" stroke="${shade(c, -0.35)}" stroke-width="1"/>`;
  }
  if (ex.cape) {
    const fur = ex.cape.fur || shade(ex.cape.color, 0.35);
    if (v === 'front') {
      const cs = [];
      for (const k of [-1, 1]) for (const [dy, dx] of [[-8, -4], [4, 2], [16, 6]]) { const y = hb + dy; cs.push(circle(k * (hwAt(r, y) + dx), y, 11)); }
      s += paper(cs, fur);
    }
    if (v === 'q') s += paper(circle(qForeAt(r, hb) + 2, hb + 4, 10), fur); // the far shoulder (the near one: capeFurQ)
  }
  return s;
}
// 3/4 view: the cape's fur collar on the near shoulder, drawn over the arm (the head hides the rest)
function capeFurQ(r, c) {
  const fur = c.fur || shade(c.color, 0.35), hb = r.hb;
  return paper([[-6, 12], [6, 12], [18, 11]].map(([dy, rr]) => circle(qBackAt(r, hb + dy) + 8, hb + dy, rr)), fur);
}
function capeSvg(v, r, c, yb = r.legBottom - 12) {
  const yA = r.hb - 4;
  const jag = (xa, xb, y, n) => Array.from({ length: n + 1 }, (_, i) => [xa + (xb - xa) * i / n, i % 2 ? y - 12 : y]);
  if (v === 'front') { const a = hwAt(r, yA) + 6, b = hwAt(r, r.B) + 22; return paper(polygon([[-a, yA], [a, yA], ...jag(b, -b, yb, 10)]), c.color); }
  if (v === 'back') {
    const a = hwAt(r, yA) + 2, b = hwAt(r, r.B) + 20;
    let s = paper(polygon([[-a, yA], [a, yA], ...jag(b, -b, yb, 10)]), c.color);
    s += stroke(`M -30,${yA + 40} Q -36,${r1((yA + yb) / 2)} -42,${yb - 20} M 30,${yA + 40} Q 36,${r1((yA + yb) / 2)} 42,${yb - 20}`, shade(c.color, -0.2), 2.4);
    const cs = [];
    for (let x = -a + 4; x <= a - 4; x += 12) cs.push(circle(x, yA + 6, 11));
    return s + paper(cs, c.fur || shade(c.color, 0.35));
  }
  const f0 = qForeAt(r, yA) - 24, f1 = qForeAt(r, r.B) - 30, b1 = qBackAt(r, r.B) - 40;
  return paper(polygon([[qBackAt(r, yA) + 10, yA], [f0, yA], [f1, yb], ...jag(f1, b1, yb, 9)]), c.color);
}

// ---------- arms + hands ----------
// a mitten hand: a round paper piece; the front view adds the thumb as a small outlined circle on the inner side
function handSvg(x, y, color, thumbSide = 0) {
  let s = paper(circle(x, y, 16), color);
  if (thumbSide) s += `<circle cx="${r1(x + thumbSide * 13)}" cy="${r1(y - 4)}" r="8" fill="${color}" stroke="${shade(color, -0.45)}" stroke-width="1.3"/>`;
  return s;
}
function mittenSvg(H, color, thumb) { // (older sheet code) a mitten with an optional thumb piece
  const sh = [circle(H[0], H[1], 16)];
  if (thumb) sh.push(ellipse(H[0] + thumb[0], H[1] + thumb[1], 6.5, 9.5, thumb[2]));
  return paper(sh, color);
}
// the arm inside the body (front/back, hanging down): a crease line + the mitten at the bottom corner
function armDown(v, r, side, top, skin, hands) {
  const hy = r.B - 19, hx = hwAt(r, r.B) - 13, y0 = r.hb + 16, y1 = hy - 9;
  const crease = y => hwAt(r, y) - 29;
  let s = '';
  if (v === 'back') { // from behind: the arm is a strip along the side of the body, the mitten below it
    const y2 = r.hb - 12, y3 = r.B - 18, a = [];
    for (let i = 0; i <= 8; i++) { const y = y2 + (y3 - y2) * i / 8; a.push([side * (hwAt(r, y) - 0.5), y]); }
    for (let i = 8; i >= 0; i--) { const y = y2 + (y3 - y2) * i / 8; a.push([side * (hwAt(r, y) - 22), y]); }
    s = paper(polygon(a), top.style === 'tee' ? skin : shade(top.color, -0.03), 0.6);
    if (top.style === 'tee') { // the short sleeve on top of the arm
      const c = [], yc = y2 + 26;
      for (let i = 0; i <= 4; i++) { const y = y2 + (yc - y2) * i / 4; c.push([side * (hwAt(r, y) - 0.5), y]); }
      for (let i = 4; i >= 0; i--) { const y = y2 + (yc - y2) * i / 4; c.push([side * (hwAt(r, y) - 22), y]); }
      s += paper(polygon(c), top.color, 0.6);
    }
    return s + paper(ellipse(side * hx, r.B - 14, 14, 12), hands);
  }
  if (top.style === 'tee') { // short sleeves: a skin arm below the sleeve
    const yh = r.hb + 26, a = [];
    for (let i = 0; i <= 8; i++) { const y = yh + (r.B - 6 - yh) * i / 8; a.push([side * (hwAt(r, y) - 0.5), y]); }
    for (let i = 8; i >= 0; i--) { const y = yh + (r.B - 6 - yh) * i / 8; a.push([side * crease(y), y]); }
    s += paper(polygon(a), skin, 0.8);
  }
  s += stroke(`M ${P(side * crease(y0), y0)} L ${P(side * crease(y1), y1)}`, LINE, 2.2);
  return s + handSvg(side * hx, hy, hands, v === 'front' ? -side : 0);
}
// 3/4: the near arm hangs down the middle of the body, the hand at the waist
function armDownQ(r, top, skin, hands) {
  const ax = 3, a0 = r.hb - 6, a1 = r.B - 20, sleeve = top.style === 'tee' ? skin : top.color;
  let s = paper(rect(ax - 19, a0, 38, a1 - a0, 19), sleeve);
  if (top.style === 'tee') s += paper(rect(ax - 20, a0, 40, 24, 12), top.color);
  return s + paper([ellipse(ax + 1.5, r.B - 15, 21, 17), ellipse(ax + 17, r.B - 24, 7, 9, 20)], hands);
}
// arms that leave the body: shoulder S, bend C, hand H
function armPath(v, r, side, kind, near) {
  const hb = r.hb, cy = r.cy, B = r.B;
  if (v === 'q') {
    if (near) {
      if (kind === 'up') return { S: [-6, hb], C: [-58, hb - 50], H: [-112, cy - 46] };
      if (kind === 'wave') return { S: [0, hb], C: [62, hb - 36], H: [126, cy - 44] };
      if (kind === 'point') return { S: [4, hb + 6], C: [56, hb + 16], H: [112, hb + 8] };
      if (kind === 'hips') return { S: [0, hb + 2], C: [-58, (hb + B) / 2], H: [-44, B - 26] };
      return null;
    }
    if (kind === 'up') return { S: [16, hb], C: [86, hb - 40], H: [128, cy - 54] };
    return null;
  }
  const yS = hb - 10, hw = hwAt(r, yS), sx = side * (hw - 20);
  if (kind === 'up' || kind === 'wave') return { S: [sx, yS], C: [side * (hw + 30), yS - 34], H: [side * 126, cy - (kind === 'wave' ? 60 : 36)] };
  if (kind === 'point') return { S: [sx, yS + 4], C: [side * (hw + 30), yS + 6], H: [side * (hw + 76), yS - 2] };
  if (kind === 'hips') return { S: [sx, yS + 6], C: [side * (hw + 46), (yS + B) / 2], H: [side * (hwAt(r, B - 34) - 6), B - 34] };
  return null;
}
// layers: 'behind' (before the body), 'front' (after the body), 'top' (after the head: raised hands stay visible)
function armsSvg(v, r, top, skin, hands, pose, layer) {
  const kind = pose.arms || 'down', sleeve = top.style === 'tee' ? skin : top.color, raised = k => k === 'up' || k === 'wave';
  const arms = v === 'q'
    ? [{ side: 1, k: kind === 'up' ? 'up' : 'down', near: false }, { side: -1, k: kind, near: true }]
    : [-1, 1].map(side => ({ side, near: false, k: (kind === 'point' || kind === 'wave') && side !== (pose.pointDir || 1) ? 'down' : kind }));
  let s = '';
  for (const a of arms) {
    if (a.k === 'down') {
      if (layer === 'front' && v !== 'q') s += armDown(v, r, a.side, top, skin, hands);
      if (layer === 'front' && v === 'q' && a.near) s += armDownQ(r, top, skin, hands);
      continue;
    }
    const p = armPath(v, r, a.side, a.k, a.near);
    if (!p) continue;
    const tubeLayer = v === 'q' && a.near ? 'front' : 'behind', handLayer = raised(a.k) ? 'top' : 'front';
    if (layer === tubeLayer) {
      s += tube(qd(p.S, p.C, p.H), sleeve, 30);
      if (top.style === 'tee') s += tube(`M ${P(...p.S)} L ${P(p.S[0] + (p.C[0] - p.S[0]) * 0.4, p.S[1] + (p.C[1] - p.S[1]) * 0.4)}`, top.color, 33);
    }
    if (layer === handLayer) s += handSvg(p.H[0], p.H[1], hands, v === 'front' ? -a.side : 0);
  }
  return s;
}

// ---------- legs + feet ----------
function legsSvg(v, r, skin, bottom, legs) {
  const st = bottom.style, legCol = st === 'pants' ? bottom.color : (bottom.legs || skin);
  const [x0, x1] = v === 'q' ? r.qLeg : [-r.legW, r.legW];
  let s = '';
  if (v === 'q' && (legs === 'walk-a' || legs === 'walk-b')) { // the lifted leg (mostly hidden by the body)
    const fx = legs === 'walk-a' ? qForeAt(r, r.B) + 4 : qBackAt(r, r.B) - 4;
    s += tube(`M ${legs === 'walk-a' ? 14 : -10},${r.legTop + 6} L ${r1(fx)},-26`, legCol, 26);
  }
  s += paper(rect(x0, r.legTop, x1 - x0, r.legBottom - r.legTop + 1), legCol);
  if (st === 'shorts') {
    const hem = r.legTop + (r.legBottom - r.legTop) * 0.62;
    s += paper(rect(x0 - 1, r.legTop, x1 - x0 + 2, hem - r.legTop), bottom.color);
  } else if (st === 'skirt') {
    const c = (x0 + x1) / 2, a = (x1 - x0) / 2 + 6, b = a + (v === 'q' ? 10 : 16), y0 = r.B - 12, yb = r.B + Math.min(34, r.legH * 0.5);
    s += paper(pathEl(`M ${r1(c - a)},${y0} L ${r1(c + a)},${y0} L ${r1(c + b)},${r1(yb - 8)} Q ${r1(c + b)},${r1(yb)} ${r1(c + b - 8)},${r1(yb)} L ${r1(c - b + 8)},${r1(yb)} Q ${r1(c - b)},${r1(yb)} ${r1(c - b)},${r1(yb - 8)} Z`), bottom.color);
  }
  return s;
}
// one shoe on its own: a flat lens (sneakers get a white sole)
function shoe(sh, x, y, rx, ry, rot = 0) {
  const col = sh.color || '#2A2426';
  if (sh.style === 'sneakers') return paper(ellipse(x, y + 2, rx + 2, ry, rot), sh.sole || '#FFFFFF') + paper(ellipse(x, y - 1, rx, ry, rot), col);
  if (sh.style === 'boots') return paper(ellipse(x, y, rx + 2, ry, rot), shade(col, -0.1));
  if (sh.style === 'flats') return paper(ellipse(x, y, rx - 6, ry * 0.8, rot), col);
  return paper(ellipse(x, y, rx, ry, rot), col);
}
function shoesSvg(v, sh, legs, r) {
  const col = sh.color || '#2A2426', [fx, frx] = v === 'q' ? r.qFoot : [0, r.foot];
  let s = '';
  if (sh.style === 'boots') { // boot shafts over the lower legs + a fur cuff
    const [x0, x1] = v === 'q' ? r.qLeg : [-r.legW, r.legW], yb = r.legBottom - 26;
    s += paper(rect(x0 - 2, yb, x1 - x0 + 4, r.legBottom - yb + 1), col);
    if (sh.fur) { const cs = []; for (let i = 0; i <= 8; i++) cs.push(circle(x0 + (x1 - x0) * i / 8, yb, 7.5)); s += paper(cs, sh.fur); }
  }
  s += shoe(sh, fx, -5, frx, 5.5);
  if (v === 'q' && (legs === 'walk-a' || legs === 'walk-b')) { // the lifted foot: its sole shows
    const a = legs === 'walk-a';
    s += shoe(Object.assign({}, sh, { style: sh.style === 'flats' ? 'plain' : sh.style }), a ? qForeAt(r, r.B) + 8 : qBackAt(r, r.B) - 8, -20, 9, 21, a ? 35 : -35);
  }
  return s;
}
// sitting: the soles of both shoes, facing us
function solesSvg(v, sh) {
  const sole = sh.style === 'sneakers' ? (sh.sole || '#EDEDED') : shade(sh.color || '#2A2426', -0.08), dx = v === 'q' ? 10 : 0;
  return paper(ellipse(dx - 23, -22, 21, 25, -10), sole) + paper(ellipse(dx + 23, -22, 21, 25, 10), sole);
}
// sitting: the lap (front: a band under the body; back: the seat)
function lapSvg(v, r, bottom) {
  const w = hwAt(r, r.B);
  if (v === 'back') return paper(rect(-w + 2, r.B - 10, 2 * w - 4, 22, 10), bottom.color);
  if (v === 'q') return paper(rect(r.qLeg[0], r.B - 8, r.qLeg[1] - r.qLeg[0] + 30, 16, 8), bottom.color);
  return paper(rect(-w + 8, r.B - 8, 2 * w - 16, 16, 8), bottom.color);
}

// Draw one character. view: front | q-right | q-left | back (left/right = 3/4)
// face: { eyes, mouth, brows }   pose: { arms, pointDir, legs: stand|sit|walk-a|walk-b, headRot, headDy }
function drawCharacter(ch, view = 'front', face = {}, pose = {}) {
  if (/left/.test(view)) {
    const p = Object.assign({}, pose, { headRot: -(pose.headRot || 0), pointDir: -(pose.pointDir || 1) });
    return `<g transform="scale(-1,1)">${drawCharacter(ch, 'q-right', face, p)}</g>`;
  }
  const v = viewOf(view), r = rig(ch.body), skin = skinOf(ch);
  const top = ch.top || DEFAULTS.top, bottom = ch.bottom || DEFAULTS.bottom, shoes = ch.shoes || DEFAULTS.shoes;
  const ex = ch.extras || {}, hands = ch.gloves || skin, legs = pose.legs || 'stand', sit = legs === 'sit';
  const rot = pose.headRot ? ` rotate(${r1(pose.headRot)} 0 ${HEAD.r})` : '';
  const headAt = parts => `<g transform="translate(0,${r1(r.cy + (pose.headDy || 0))})${rot}">${headSvg(ch, v === 'q' ? 'q-right' : v, face, parts)}</g>`;
  let s = '';
  if (ex.cape && v !== 'back') s += capeSvg(v, r, ex.cape);
  if (!sit) s += legsSvg(v, r, skin, bottom, legs) + shoesSvg(v, shoes, legs, r);
  s += `<g transform="translate(0,${sit ? r.legBottom - r.B + 2 : 0})">`;
  s += armsSvg(v, r, top, skin, hands, pose, 'behind');
  if (sit) s += lapSvg(v, r, bottom);
  if (v === 'back') { // the shoulders show over the back of the head; long hair hangs over them
    s += headAt('skin') + torsoSvg(v, r, top) + neckSvg(v, r, top, ex);
    if (ex.cape) s += capeSvg(v, r, ex.cape, sit ? r.B - 2 : undefined); // sitting: the cape ends on the ground
    s += headAt('hair') + armsSvg(v, r, top, skin, hands, pose, 'front');
  } else {
    s += torsoSvg(v, r, top) + neckSvg(v, r, top, ex) + armsSvg(v, r, top, skin, hands, pose, 'front');
    if (ex.cape && v === 'q') s += capeFurQ(r, ex.cape);
    s += headAt('all');
  }
  s += armsSvg(v, r, top, skin, hands, pose, 'top');
  s += '</g>';
  if (sit && v !== 'back') s += solesSvg(v, shoes);
  return s;
}

module.exports = {
  HEAD, FACE, EYES, BROWS, MOUTHS, BODIES, SKIN_TONES, rig, skinOf, shade,
  drawCharacter, headSvg, eyesSvg, browsSvg, lidsSvg, mouthSvg, hairSvg, hatSvg, beardSvg, moustacheSvg, glassesSvg,
  handSvg, mittenSvg, shoe, solesSvg, torsoSvg, neckSvg, capeFurQ, tube, paper, ellipse, circle, rect, stroke, LINE,
};
