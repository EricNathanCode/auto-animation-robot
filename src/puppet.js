'use strict';
/*
 * Auto Animate · base puppet + wardrobe, drawn as SVG.
 *
 * Every character = the SAME base puppet (body, head, eyes, mouths) + a wardrobe
 * (hair, hat, top, bottom, shoes, extras) that the script asks for.
 *
 * Views: front | back | right (side view, facing right) | left (= right, mirrored).
 * Units: (0,0) is the ground under the feet; "up" is negative y.
 * Head parts use head-local units: (0,0) is the centre of the head.
 */

const INK = '#1E1B2E';          // outline colour
const OUT = 5;                   // outline thickness outside every paper piece
const HEAD = { rx: 98, ry: 84 };
const EYE = { x: 31, y: -9, rx: 27, ry: 33 };
const SIDE_EYE = { x: 50, y: -9, rx: 21, ry: 33 };
const MOUTH = { y: 33, sideX: 68 };

const SKIN_TONES = { light: '#F8D9BE', peach: '#F2C29A', tan: '#D9A06F', brown: '#A86E45', deep: '#6E4428' };
const COL = { mouth: '#5A1E2A', tongue: '#E26D7E', teeth: '#FFFFFF', blush: '#E8607E' };

const BODIES = {
  kid:   { legH: 38, torsoH: 118, wt: 58, wb: 80, sideWt: 44, sideWb: 60 },
  adult: { legH: 92, torsoH: 150, wt: 60, wb: 78, sideWt: 44, sideWb: 58 },
};

const DEFAULTS = {
  top: { style: 'tee', color: '#DDE3EC' },
  bottom: { style: 'shorts', color: '#9AA3AE' },
  shoes: { style: 'sneakers', color: '#7B8494' },
};

// Eye poses. lid = [outer, inner] = how far the eyelid comes down (0 top .. 1 bottom).
const EYE_POSES = {
  open:   { label: 'open', px: 0, py: 4 },
  lookL:  { label: 'look left', px: -11, py: 3 },
  lookR:  { label: 'look right', px: 11, py: 3 },
  half:   { label: 'blink (half)', px: 0, py: 7, lid: [0.5, 0.5] },
  closed: { label: 'closed', closed: true },
  happy:  { label: 'happy', happy: true, brow: 'up' },
  angry:  { label: 'angry', px: 0, py: 6, pr: 6.5, lid: [0.14, 0.46], brow: 'angry' },
  sad:    { label: 'sad', px: 0, py: 8, lid: [0.42, 0.14], brow: 'sad' },
  shock:  { label: 'shocked', px: 0, py: 1, pr: 4.5, scale: 1.12, brow: 'up' },
};

// The 9 standard lip-sync mouth shapes (the same letters free lip-sync tools use).
const MOUTH_SHAPES = {
  X: 'rest', A: 'M B P', B: 'K S T EE', C: 'EH AE', D: 'AA', E: 'AO ER', F: 'OO W', G: 'F V', H: 'L',
};

// ---------- small helpers ----------
const r1 = n => Math.round(n * 10) / 10;
const P = (x, y) => `${r1(x)},${r1(y)}`;
const polyPts = pts => pts.map(p => P(p[0], p[1])).join(' ');
const polygon = pts => `<polygon points="${polyPts(pts)}"/>`;
const pathEl = d => `<path d="${d}"/>`;
const circle = (cx, cy, r) => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}"/>`;
const rect = (x, y, w, h, rx = 0) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(rx)}"/>`;
function ellipse(cx, cy, rx, ry, rot = 0) {
  const t = rot ? ` transform="rotate(${rot} ${r1(cx)} ${r1(cy)})"` : '';
  return `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}"${t}/>`;
}
function arcPts(rx, ry, cx, cy, a0, a1, n = 28) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}
function ringCircles(rx, ry, a0, a1, step, r) {
  const out = [];
  const dir = a1 >= a0 ? 1 : -1;
  for (let a = a0; dir > 0 ? a <= a1 + 0.01 : a >= a1 - 0.01; a += step * dir) {
    const t = a * Math.PI / 180;
    out.push(circle(rx * Math.cos(t), ry * Math.sin(t), r));
  }
  return out;
}
// A paper piece: all its shapes share ONE outline around the outside.
function piece(shapes, fill, out = OUT) {
  const s = [].concat(shapes).join('');
  return `<g fill="${INK}" stroke="${INK}" stroke-width="${out * 2}" stroke-linejoin="round">${s}</g><g fill="${fill}">${s}</g>`;
}
// A thick outlined stroke (arms, brows, glasses frames).
function tube(d, color, width, out = OUT) {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width + out * 2}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function line(d, w = 3.5, color = INK, cap = 'round') {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
}
function shade(hex, amt) { // amt < 0 darker, > 0 lighter
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
const quadAt = (S, C, H, t) => {
  const u = 1 - t;
  return [u * u * S[0] + 2 * u * t * C[0] + t * t * H[0], u * u * S[1] + 2 * u * t * C[1] + t * t * H[1]];
};
// keep the part of a polygon that is above the line a→b (screen coordinates)
function clipAbove(poly, a, b) {
  const side = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

// ---------- the base puppet ----------
function rig(type) {
  const b = BODIES[type] || BODIES.kid;
  const legBottom = -12;
  const legTop = legBottom - b.legH - 2;
  const B = legTop + 4;          // bottom of the torso
  const T = B - b.torsoH;        // top of the torso
  const cy = T - 45;             // centre of the head
  return Object.assign({ type, legTop, legBottom, B, T, cy, headTop: cy - HEAD.ry, hb: cy + HEAD.ry, armW: 26 }, b);
}
const skinOf = ch => SKIN_TONES[ch.skin] || ch.skin || SKIN_TONES.peach;

function torsoD(v, r) {
  const wt = v === 'side' ? r.sideWt : r.wt, wb = v === 'side' ? r.sideWb : r.wb, T = r.T, B = r.B;
  return `M ${-wt + 14},${T} L ${wt - 14},${T} Q ${wt},${T} ${wt + 1},${T + 14} L ${wb},${B - 16} Q ${wb},${B} ${wb - 16},${B} ` +
    `L ${-wb + 16},${B} Q ${-wb},${B} ${-wb},${B - 16} L ${-wt - 1},${T + 14} Q ${-wt},${T} ${-wt + 14},${T} Z`;
}
function edgeX(v, r, y) {
  const wt = v === 'side' ? r.sideWt : r.wt, wb = v === 'side' ? r.sideWb : r.wb;
  return wt + (wb - wt) * (y - r.T) / (r.B - r.T);
}

function legs(v, r, skin, bottom) {
  const top = r.legTop, bot = r.legBottom + 2;
  const rects = v === 'side' ? [rect(-17, top, 34, bot - top, 8)] : [rect(-44, top, 36, bot - top, 8), rect(8, top, 36, bot - top, 8)];
  let s = piece(rects, bottom.style === 'pants' ? bottom.color : (bottom.legs || skin));
  const st = bottom.style;
  if (st === 'shorts' || st === 'pants') {
    const hem = st === 'pants' ? r.legBottom - 4 : top + r.legH * 0.55;
    const y0 = top - 10;
    if (v === 'side') s += piece(rect(-21, y0, 42, hem - y0, 6), bottom.color);
    else s += piece(polygon([[-48, y0], [48, y0], [48, hem], [7, hem], [2, top + 12], [-2, top + 12], [-7, hem], [-48, hem]]), bottom.color);
  } else if (st === 'skirt') {
    const y0 = top - 12, y1 = top + r.legH * 0.5;
    const w0 = v === 'side' ? 46 : 62, w1 = v === 'side' ? 58 : 76;
    s += piece(pathEl(`M ${-w0},${y0} L ${w0},${y0} L ${w1},${y1 - 8} Q ${w1},${y1} ${w1 - 8},${y1} L ${-w1 + 8},${y1} Q ${-w1},${y1} ${-w1},${y1 - 8} Z`), bottom.color);
  }
  return s;
}

function shoesSvg(v, sh) {
  const feet = v === 'side' ? [0] : [-30, 30];
  const fwd = v === 'side' ? 14 : 0;
  let s = '';
  for (const fx of feet) {
    if (sh.style === 'boots') {
      const cuffY = -62, x0 = v === 'side' ? -20 : fx - 21, w = v === 'side' ? 40 : 42;
      s += piece([rect(x0, cuffY, w, 50, 8), ellipse(fx + fwd, -13, v === 'side' ? 33 : 27, 12)], sh.color);
      if (sh.fur) {
        const cs = [];
        for (let i = 0; i <= 4; i++) cs.push(circle(x0 + i * (w / 4), cuffY, 8.5));
        s += piece(cs, sh.fur, 3);
      }
    } else if (sh.style === 'flats') {
      s += piece(ellipse(fx + fwd, -10, v === 'side' ? 30 : 25, 10), sh.color);
    } else { // sneakers
      s += piece(ellipse(fx + fwd, -7, v === 'side' ? 36 : 31, 8.5), sh.sole || '#FFFFFF');
      s += piece(ellipse(fx + fwd - (v === 'side' ? 3 : 0), -15, v === 'side' ? 31 : 27, 13), sh.color);
      if (v === 'front') s += line(`M ${fx - 7},-21 L ${fx + 7},-21 M ${fx - 6},-15 L ${fx + 6},-15`, 2.5, '#FFFFFF');
      if (v === 'side') s += line(`M 18,-22 L 26,-17 M 10,-24 L 18,-19`, 2.5, '#FFFFFF');
    }
  }
  return s;
}

// Arm poses: down | up | point | hips. Side view = the near arm (the character faces right).
function armPath(v, r, side, kind = 'down') {
  if (v === 'side') {
    const S = [2, r.T + 24];
    if (kind === 'point') return { S, C: [52, r.T + 30], H: [100, r.T - 10] };
    if (kind === 'up') return { S, C: [72, r.T - 30], H: [62, r.T - 150] };
    if (kind === 'hips') return { S, C: [46, (S[1] + r.B) / 2], H: [r.sideWb - 8, r.B - 44] };
    const H = [14, r.B - 30];
    return { S, C: [16, (S[1] + H[1]) / 2], H };
  }
  const S = [side * (r.wt - 8), r.T + 24];
  if (kind === 'point') return { S, C: [side * (r.wb + 30), r.T + 34], H: [side * (r.wb + 92), r.T + 26] };
  if (kind === 'up') return { S, C: [side * (r.wt + 58), r.T - 4], H: [side * (r.wt + 62), r.T - 112] };
  if (kind === 'hips') {
    const H = [side * (edgeX('front', r, r.B - 46) + 6), r.B - 46];
    return { S, C: [side * (r.wb + 46), (S[1] + H[1]) / 2 - 8], H };
  }
  const H = [side * (r.wb + 12), r.B - 34];
  return { S, C: [(S[0] + H[0]) / 2 + side * 10, (S[1] + H[1]) / 2], H };
}
function mitten(v, H, side, color) {
  const shapes = [circle(H[0], H[1], 15)];
  if (v === 'front') shapes.push(ellipse(H[0] - side * 12, H[1] - 6, 6.5, 9.5, -side * 30));
  if (v === 'side') shapes.push(ellipse(H[0] + 12, H[1] - 6, 6.5, 9.5, 30));
  return piece(shapes, color);
}
function arms(v, r, top, skin, hands, pose = {}) {
  const list = v === 'side' ? [1] : [-1, 1];
  const long = top.style !== 'tee';
  const kind = pose.arms || 'down';
  let s = '';
  for (const side of list) {
    // 'point' in the front view: only the arm on the pointDir side points, the other hangs down
    const k = kind === 'point' && v !== 'side' && side !== (pose.pointDir || 1) ? 'down' : kind;
    const { S, C, H } = armPath(v, r, side, k);
    const d = `M ${P(...S)} Q ${P(...C)} ${P(...H)}`;
    if (long) {
      s += tube(d, top.color, r.armW);
      const c0 = quadAt(S, C, H, 0.8), c1 = quadAt(S, C, H, 0.93);
      const cuff = top.style === 'blazer' ? (top.shirt || '#FFFFFF') : shade(top.color, -0.15);
      s += line(`M ${P(...c0)} L ${P(...c1)}`, r.armW, cuff, 'butt');
    } else {
      s += tube(d, skin, r.armW - 4);
      s += tube(`M ${P(...S)} L ${P(...quadAt(S, C, H, 0.4))}`, top.color, r.armW + 2);
    }
    s += mitten(v, H, side, hands);
  }
  return s;
}

function patch(x, y, p) {
  const bolt = [[2, -9], [-5, 1], [0, 1], [-2, 9], [5, -1], [0, -1]].map(([a, b]) => [x + a, y + b]);
  return piece(circle(x, y, 12.5), p.color || '#2BA59A', 2.5) +
    `<polygon points="${polyPts(bolt)}" fill="#FFFFFF" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

function torso(v, r, top) {
  let s = piece(pathEl(torsoD(v, r)), top.color);
  const dk = shade(top.color, -0.14), hb = r.hb, B = r.B;
  if (top.style === 'hoodie') {
    if (v === 'front') {
      s += piece(pathEl(`M -40,${B - 50} L 40,${B - 50} Q 47,${B - 50} 47,${B - 43} L 51,${B - 16} L -51,${B - 16} L -47,${B - 43} Q -47,${B - 50} -40,${B - 50} Z`), dk, 2.5);
      if (top.patch) s += patch(0, B - 33, top.patch);
    } else if (v === 'side') {
      s += piece(pathEl(`M 4,${B - 50} L 36,${B - 50} Q 44,${B - 50} 46,${B - 42} L 52,${B - 16} L 4,${B - 16} Z`), dk, 2.5);
    }
  } else if (top.style === 'blazer') {
    const btn = shade(top.color, -0.35);
    if (v === 'front') {
      s += piece(polygon([[-24, hb - 30], [24, hb - 30], [0, hb + 46]]), top.shirt || '#FFFFFF', 2.5);
      s += piece(polygon([[-24, hb - 30], [-44, hb - 30], [-6, hb + 54], [0, hb + 46]]), dk, 2.5);
      s += piece(polygon([[24, hb - 30], [44, hb - 30], [6, hb + 54], [0, hb + 46]]), dk, 2.5);
      for (const y of [hb + 68, hb + 88]) if (y < B - 10) s += piece(circle(0, y, 4.5), btn, 2);
    } else if (v === 'back') {
      s += line(`M 0,${hb + 4} L 0,${B - 2}`, 3, shade(top.color, -0.3));
    } else {
      s += line(`M ${r.sideWt - 4},${hb + 2} Q ${r.sideWt + 2},${(hb + B) / 2} ${r.sideWb - 10},${B - 4}`, 3, shade(top.color, -0.3));
      s += piece(circle(r.sideWt + 4, hb + 70, 4.5), btn, 2);
    }
  } else if (top.style === 'tunic') {
    const y0 = B - 44, y1 = B - 28, belt = top.belt || '#6B4226';
    const x0 = edgeX(v, r, y0) + 2, x1 = edgeX(v, r, y1) + 2;
    s += piece(polygon([[-x0, y0], [x0, y0], [x1, y1], [-x1, y1]]), belt, 3);
    if (v === 'front') {
      s += piece(rect(-11, y0 - 3, 22, y1 - y0 + 6, 3), top.buckle || '#E2B33C', 2.5);
      s += `<rect x="-5" y="${y0 + 3}" width="10" height="${y1 - y0 - 6}" fill="${belt}"/>`;
    }
    s += line(`M ${-edgeX(v, r, B - 9) + 3},${B - 9} L ${edgeX(v, r, B - 9) - 3},${B - 9}`, 3, dk);
  }
  return s;
}

function cape(v, r, c) {
  const yb = r.legTop + r.legH * 0.5, T = r.T;
  const jag = (xa, xb, y, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) out.push([xa + (xb - xa) * i / n, i % 2 ? y - 14 : y]);
    return out;
  };
  if (v === 'front') {
    const w0 = r.wt + 10, w1 = r.wb + 18;
    return piece(polygon([[-w0, T + 8], [w0, T + 8], ...jag(w1, -w1, yb, 10)]), c.color);
  }
  if (v === 'back') {
    const w0 = r.wt + 6, w1 = r.wb + 18;
    let s = piece(polygon([[-w0, T + 4], [w0, T + 4], ...jag(w1, -w1, yb, 10)]), c.color);
    s += line(`M -30,${T + 50} Q -36,${(T + yb) / 2} -44,${yb - 20} M 30,${T + 50} Q 36,${(T + yb) / 2} 44,${yb - 20}`, 3, shade(c.color, -0.25));
    const cs = [];
    for (let x = -w0 + 4; x <= w0 - 4; x += 13) cs.push(circle(x, T + 30, 12));
    return s + piece(cs, c.fur || shade(c.color, 0.35), 3);
  }
  const w1 = r.sideWb + 22;
  return piece(polygon([[-r.sideWt + 2, T + 8], [10, T + 8], [6, yb - 4], ...jag(6, -w1, yb, 6)]), c.color);
}

function neck(v, r, top, ex) {
  let s = '';
  const hb = r.hb, dk = shade(top.color, -0.14);
  if (top.style === 'hoodie') {
    if (v === 'front') {
      s += piece(ellipse(0, hb - 8, 76, 30), dk);
      s += tube(`M -16,${hb + 14} L -17,${hb + 38}`, '#FFFFFF', 3.5, 1.6) + tube(`M 16,${hb + 14} L 17,${hb + 38}`, '#FFFFFF', 3.5, 1.6);
    } else if (v === 'back') {
      s += piece(pathEl(`M -50,${hb - 30} Q -58,${hb + 30} 0,${hb + 44} Q 58,${hb + 30} 50,${hb - 30} Z`), dk);
      s += line(`M 0,${hb + 4} L 0,${hb + 40}`, 2.6, shade(top.color, -0.3));
    } else {
      s += piece(ellipse(-48, hb - 6, 40, 28), dk);
      s += tube(`M 34,${hb + 12} L 36,${hb + 36}`, '#FFFFFF', 3.5, 1.6);
    }
  }
  if (ex.pearls) {
    const col = ex.pearls.color || '#FFF4DC';
    const pts = [];
    if (v === 'front') for (let i = -6; i <= 6; i++) { const x = i * 5.4; pts.push([x, hb + 14 - 24 * (x / 32) ** 2]); }
    if (v === 'side') for (let i = 0; i < 4; i++) pts.push([24 + i * 7.5, hb + 6 - i * 3]);
    for (const [x, y] of pts) s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="4.3" fill="${col}" stroke="${INK}" stroke-width="1.8"/>`;
  }
  if (ex.cape) {
    const fur = ex.cape.fur || shade(ex.cape.color, 0.35);
    if (v === 'front') s += piece([circle(-86, r.T + 40, 12), circle(-74, r.T + 33, 12), circle(74, r.T + 33, 12), circle(86, r.T + 40, 12)], fur, 3);
    if (v === 'side') s += piece([circle(-28, r.T + 24, 11), circle(-40, r.T + 30, 12), circle(-50, r.T + 41, 11)], fur, 3);
  }
  return s;
}

// ---------- the head (head-local units) ----------
function ears(v, skin, mode) {
  if (v === 'side') return mode === 'on' ? piece(ellipse(-12, 4, 12, 16), skin, 4) + line('M -15,-5 Q -5,3 -13,12', 2.5) : '';
  return mode === 'behind' ? piece([ellipse(-95, 4, 12, 16), ellipse(95, 4, 12, 16)], skin) : '';
}
function cheeks(v) {
  if (v === 'front') return `<g fill="${COL.blush}" opacity="0.38"><ellipse cx="-62" cy="23" rx="13" ry="8.5"/><ellipse cx="62" cy="23" rx="13" ry="8.5"/></g>`;
  if (v === 'side') return `<ellipse cx="34" cy="27" rx="11" ry="8" fill="${COL.blush}" opacity="0.38"/>`;
  return '';
}
function drawEye(cx, cy, rx, ry, pose, skin, outerSign, bias = 0) {
  const ps = EYE_POSES[pose] || EYE_POSES.open;
  const k = ps.scale || 1;
  rx *= k; ry *= k;
  if (ps.happy) return line(`M ${P(cx - rx * 0.78, cy + 8)} Q ${P(cx, cy - ry * 0.75)} ${P(cx + rx * 0.78, cy + 8)}`, 6);
  if (ps.closed) {
    return `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${skin}" stroke="${INK}" stroke-width="4"/>` +
      line(`M ${P(cx - rx * 0.8, cy + ry * 0.22)} Q ${P(cx, cy + ry * 0.62)} ${P(cx + rx * 0.8, cy + ry * 0.22)}`, 4.5);
  }
  let s = `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>`;
  const pr = ps.pr || 7.5;
  const maxOff = rx - pr - 3;
  const off = Math.max(-maxOff, Math.min(maxOff, ((ps.px || 0) + bias) * k));
  const px = cx + off, py = cy + (ps.py || 0);
  s += `<circle cx="${r1(px)}" cy="${r1(py)}" r="${pr}" fill="${INK}"/>`;
  s += `<circle cx="${r1(px + pr * 0.36)}" cy="${r1(py - pr * 0.4)}" r="${r1(pr * 0.36)}" fill="#FFFFFF"/>`;
  if (ps.lid) {
    const yOuter = cy - ry + 2 * ry * ps.lid[0], yInner = cy - ry + 2 * ry * ps.lid[1];
    const yL = outerSign < 0 ? yOuter : yInner, yR = outerSign < 0 ? yInner : yOuter;
    const lid = clipAbove(arcPts(rx, ry, cx, cy, 0, 360, 60).slice(0, 60), [cx - rx, yL], [cx + rx, yR]);
    if (lid.length > 2) s += `<polygon points="${polyPts(lid)}" fill="${skin}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  return s;
}
function eyesSvg(v, pose, skin) {
  if (v === 'side') return drawEye(SIDE_EYE.x, SIDE_EYE.y, SIDE_EYE.rx, SIDE_EYE.ry, pose, skin, -1, 7);
  return drawEye(-EYE.x, EYE.y, EYE.rx, EYE.ry, pose, skin, -1) + drawEye(EYE.x, EYE.y, EYE.rx, EYE.ry, pose, skin, 1);
}
function brows(v, pose, color) {
  const list = v === 'side' ? [[SIDE_EYE.x, -1, 12]] : [[-EYE.x, -1, 15], [EYE.x, 1, 15]];
  let s = '';
  for (const [ex, sg, half] of list) {
    let yo = -52, yi = -52;
    if (pose === 'angry') { yo = -58; yi = -45; } else if (pose === 'sad') { yo = -47; yi = -59; } else if (pose === 'up') { yo = -60; yi = -61; }
    const xo = ex + sg * half, xi = ex - sg * half;
    const ym = Math.min(yo, yi) - (pose === 'angry' || pose === 'sad' ? 2 : 5);
    s += tube(`M ${P(xo, yo)} Q ${P(ex, ym)} ${P(xi, yi)}`, color, 6, 2.5);
  }
  return s;
}
function mouthOpen(hw, depth, tongue) {
  const d = `M ${-hw},-6 Q 0,-10 ${hw},-6 Q ${hw - 1},${depth - 2} 0,${depth} Q ${-hw + 1},${depth - 2} ${-hw},-6 Z`;
  let s = `<path d="${d}" fill="${COL.mouth}"/>`;
  s += `<path d="M ${-hw + 2},-6 Q 0,-9.5 ${hw - 2},-6 L ${hw - 4},-0.5 Q 0,-3 ${-hw + 4},-0.5 Z" fill="${COL.teeth}"/>`;
  if (tongue) s += `<ellipse cx="${tongue[0]}" cy="${tongue[1]}" rx="${tongue[2]}" ry="${tongue[3]}" fill="${COL.tongue}"/>`;
  return s + `<path d="${d}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
}
function mouthShape(m) {
  switch (m) {
    case 'A': return line('M -14,0 Q 0,2.5 14,0', 5.5);
    case 'B': return `<rect x="-16" y="-6.5" width="32" height="13" rx="6.5" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>` + line('M -12,0 L 12,0', 2);
    case 'C': return mouthOpen(17, 15, [0, 10, 8, 4]);
    case 'D': return mouthOpen(19, 25, [0, 17, 11, 6]);
    case 'E': return `<ellipse cx="0" cy="3" rx="11.5" ry="13" fill="${COL.mouth}" stroke="${INK}" stroke-width="4"/><ellipse cx="0" cy="10.5" rx="6" ry="3" fill="${COL.tongue}"/>`;
    case 'F': return `<ellipse cx="0" cy="2" rx="7" ry="8.5" fill="${COL.mouth}" stroke="${INK}" stroke-width="5"/>`;
    case 'G': {
      const d = 'M -14,-5 Q 0,-8 14,-5 Q 12,6 0,7 Q -12,6 -14,-5 Z';
      return `<path d="${d}" fill="${COL.mouth}"/><path d="M -12,-5 Q 0,-7.5 12,-5 L 11,2.5 Q 0,4 -11,2.5 Z" fill="#FFFFFF"/>` +
        `<path d="${d}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` + line('M -11,8 Q 0,12 11,8', 3.5);
    }
    case 'H': return mouthOpen(17, 15, [0, 2, 8, 6]);
    case 'smile': {
      const d = 'M -20,-5 Q 0,1 20,-5 Q 18,16 0,18 Q -18,16 -20,-5 Z';
      return `<path d="${d}" fill="${COL.mouth}"/><path d="M -18,-4.5 Q 0,0.5 18,-4.5 L 16.5,1 Q 0,5.5 -16.5,1 Z" fill="#FFFFFF"/>` +
        `<ellipse cx="0" cy="13" rx="9" ry="3.6" fill="${COL.tongue}"/><path d="${d}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    }
    case 'frown': return line('M -14,5 Q 0,-5 14,5', 4.5);
    default: return line('M -15,-3 Q 0,8 15,-3', 4.5); // X = rest
  }
}
function mouthAt(v, m, low = false) {
  const y = MOUTH.y + (low ? 7 : 0);   // a little lower under a moustache, so it stays visible
  if (v === 'side') return `<g transform="translate(${MOUTH.sideX},${y}) scale(0.72,1)">${mouthShape(m)}</g>`;
  return `<g transform="translate(0,${y})">${mouthShape(m)}</g>`;
}
function glasses(v, g) {
  const col = g.color || INK;
  const frame = (cx, rx) => `<ellipse cx="${cx}" cy="${EYE.y}" rx="${rx}" ry="38" fill="#FFFFFF" fill-opacity="0.12" stroke="${INK}" stroke-width="9"/>` +
    `<ellipse cx="${cx}" cy="${EYE.y}" rx="${rx}" ry="38" fill="none" stroke="${col}" stroke-width="5"/>`;
  if (v === 'front') return tube('M -61,-14 L -94,-18 M 61,-14 L 94,-18', col, 4, 2) + frame(-EYE.x, 31) + frame(EYE.x, 31);
  if (v === 'side') return tube('M 26,-14 L -4,-8', col, 4, 2) + frame(SIDE_EYE.x, 25);
  return '';
}
function beard(v, b) {
  if (v === 'front') {
    const pts = [[101, -44], [84, -44], [80, 0], [66, 28], [40, 32], [0, 30], [-40, 32], [-66, 28], [-80, 0], [-84, -44], [-101, -44], [-102, 0],
      ...arcPts(100, 116, 0, 0, 180, 0, 30), [102, 0]];
    const fluff = [];
    for (let a = 35; a <= 145; a += 14) { const t = a * Math.PI / 180; fluff.push(circle(98 * Math.cos(t), 110 * Math.sin(t), 13)); }
    return piece([polygon(pts), ...fluff], b.color);
  }
  if (v === 'side') {
    // jaw beard from under the ear to a chin that sticks out forward, with a thin sideburn in front of the ear
    const pts = [[-40, 30], [-2, 22], [0, -20], [10, -40], [17, -38], [20, 0], [30, 27], [52, 32], [74, 34], [90, 30], [104, 44],
      [100, 80], [78, 108], [40, 120], [0, 108], [-34, 84], [-52, 60]];
    return piece([polygon(pts), circle(96, 86, 13), circle(76, 106, 13), circle(50, 116, 13), circle(22, 114, 13), circle(-6, 102, 12), circle(-30, 82, 12)], b.color);
  }
  return '';
}
function moustache(v, b) {
  const col = shade(b.color, -0.08);
  if (v === 'front') return piece([ellipse(-14, 27, 15, 7, 12), ellipse(14, 27, 15, 7, -12)], col, 3.5);
  if (v === 'side') return piece(ellipse(74, 26, 15, 7, -10), col, 3.5);
  return '';
}
function curls(points, col) {
  return points.map(([x, y]) => line(`M ${x - 6},${y + 2} Q ${x},${y - 6} ${x + 6},${y + 2}`, 2.6, col)).join('');
}
function hairCurly(v, col) {
  const hi = shade(col, 0.22);
  if (v === 'front') {
    const inner = [[90, -27], [80, -45], [56, -61], [28, -68], [0, -70], [-28, -68], [-56, -61], [-80, -45], [-90, -27]];
    const sh = [polygon(arcPts(100, 86, 0, 0, 188, 352, 32).concat(inner)), ...ringCircles(101, 87, 190, 350, 13, 15)];
    for (const [x, y] of [[-88, -30], [-72, -48], [-50, -61], [-25, -68], [0, -70], [25, -68], [50, -61], [72, -48], [88, -30]]) sh.push(circle(x, y, 11));
    return piece(sh, col) + curls([[-62, -74], [-26, -82], [16, -82], [56, -74], [-88, -40], [88, -40], [0, -90]], hi);
  }
  if (v === 'side') {
    const inner = [[-52, 56], [-42, 26], [-36, -6], [-26, -24], [0, -42], [30, -60], [58, -67], [80, -56]];
    const sh = [polygon(arcPts(100, 86, 0, 0, -36, -220, 34).concat(inner)), ...ringCircles(101, 87, -40, -216, 13, 15)];
    for (const [x, y] of [[-62, 58], [-48, 42], [40, -68], [62, -67], [82, -55]]) sh.push(circle(x, y, 11));
    return piece(sh, col) + curls([[-60, -60], [-20, -82], [20, -80], [-84, -20], [-70, 20], [50, -78], [-50, 40]], hi);
  }
  const sh = [polygon(arcPts(100, 86, 0, 0, 149, 391, 40)), ...ringCircles(101, 87, 145, 395, 13, 15)];
  for (let x = -72; x <= 72; x += 24) sh.push(circle(x, 47, 12));
  return piece(sh, col) + curls([[-50, -50], [0, -64], [50, -50], [-70, 0], [-24, -10], [24, -10], [70, 0], [-40, 30], [40, 30], [0, 24]], hi);
}
function hairBob(v, col) {
  const st = shade(col, 0.16);
  if (v === 'front') {
    const pts = [[106, 50], ...arcPts(110, 94, 0, 0, 17, -197, 40), [-106, 50], [-76, 50], [-82, 10], [-75, -30], [-64, -55], [-30, -59], [0, -60], [30, -59], [64, -55], [75, -30], [82, 10], [76, 50]];
    return piece(polygon(pts), col) + line('M -40,-80 Q -52,-70 -58,-58 M 38,-82 Q 50,-72 56,-60 M -96,-10 Q -100,20 -98,44 M 96,-10 Q 100,20 98,44', 2.6, st);
  }
  if (v === 'side') {
    // covers the back of the head and the ear; front edge curves from the jaw up to the bangs
    const pts = [...arcPts(110, 94, 0, 0, -50, -200, 36), [-106, 50], [-16, 53], [-6, 47], [-3, 28], [2, 0], [9, -24], [20, -43], [32, -55],
      [66, -59], [77, -57], [75, -66]];
    return piece(polygon(pts), col) + line('M -60,-62 Q -80,-20 -84,42 M -22,-80 Q -46,-40 -50,44', 2.6, st);
  }
  return piece(polygon([...arcPts(110, 94, 0, 0, 17, -197, 40), [-106, 50], [106, 50]]), col) +
    line('M 0,-90 L 0,46 M -50,-78 Q -62,-20 -58,46 M 50,-78 Q 62,-20 58,46', 2.6, st);
}
function hairShort(v, col) {
  if (v === 'front') return piece(polygon([...arcPts(101, 87, 0, 0, 190, 350, 30), [90, -30], [62, -58], [0, -63], [-62, -58], [-90, -30]]), col);
  if (v === 'side') return piece(polygon([...arcPts(101, 87, 0, 0, -40, -215, 32), [-70, 66], [-46, 52], [-36, 10], [-28, -20], [10, -42], [40, -60], [77, -56]]), col);
  const pts = arcPts(101, 87, 0, 0, 152, 388, 36);
  for (let i = 0; i <= 8; i++) pts.push([89 - i * (178 / 8), i % 2 ? 34 : 44]);
  return piece(polygon(pts), col);
}
function hairSvg(v, hair) {
  const col = hair.color || '#3B2A20';
  if (hair.style === 'curly') return hairCurly(v, col);
  if (hair.style === 'bob') return hairBob(v, col);
  if (hair.style === 'short') return hairShort(v, col);
  return '';
}
function helmet(v, h) {
  const steel = h.color || '#A9B4C2', band = h.band || '#B8873A', rivet = shade(band, -0.4);
  const RX = 104, RY = 104, CY = 6, RIM = -56;
  const t = Math.asin((RIM - CY) / RY) * 180 / Math.PI;
  const xAt = y => RX * Math.sqrt(Math.max(0, 1 - ((y - CY) / RY) ** 2));
  let s = piece(polygon(arcPts(RX, RY, 0, CY, -180 - t, t, 40)), steel);
  s += line(`M ${-RX * 0.5},${CY - RY * 0.72} Q ${-RX * 0.28},${CY - RY * 0.86} -14,${CY - RY * 0.9}`, 5, '#FFFFFF');
  const y0 = -71, y1 = RIM + 1;
  s += piece(polygon([[-xAt(y0) - 3, y0], [xAt(y0) + 3, y0], [xAt(y1) + 4, y1], [-xAt(y1) - 4, y1]]), band, 3.5);
  const rivets = [];
  if (v !== 'side') {
    s += piece(pathEl(`M -8,${y0} L -8,-92 Q 0,-100 8,-92 L 8,${y0} Z`), band, 3.5);
    for (const x of [-56, -30, 30, 56]) rivets.push([x, (y0 + y1) / 2]);
    rivets.push([0, -82]);
  } else {
    const ridge = arcPts(RX - 9, RY - 9, 0, CY, -150, -30, 24);
    s += tube('M ' + ridge.map(p => P(p[0], p[1])).join(' L '), band, 11, 3);
    for (const x of [-60, -30, 0, 30, 60]) rivets.push([x, (y0 + y1) / 2]);
  }
  return s + rivets.map(([x, y]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="3" fill="${rivet}"/>`).join('');
}
function hatSvg(v, hat) {
  if (hat && hat.style === 'helmet') return helmet(v, hat);
  return '';
}

function headSvg(ch, view = 'front', face = {}) {
  const v = view === 'right' || view === 'left' || view === 'side' ? 'side' : view;
  const skin = skinOf(ch);
  const hair = ch.hair || { style: 'none' };
  const ex = ch.extras || {};
  const eyes = face.eyes || 'open', mouth = face.mouth || 'X';
  const browCol = ch.brows || (hair.style && hair.style !== 'none' ? hair.color : '#5B4636');
  let s = ears(v, skin, 'behind');
  s += piece(ellipse(0, 0, HEAD.rx, HEAD.ry), skin);
  if (v === 'side') s += ears(v, skin, 'on');
  if (v !== 'back') {
    if (!ex.beard) s += cheeks(v);
    s += eyesSvg(v, eyes, skin);
    if (ex.glasses) s += glasses(v, ex.glasses);
    s += brows(v, (EYE_POSES[eyes] || {}).brow, browCol);
    if (ex.beard) s += beard(v, ex.beard);
    s += mouthAt(v, mouth, !!ex.beard);
    if (ex.beard) s += moustache(v, ex.beard);
  }
  s += hairSvg(v, hair);
  s += hatSvg(v, ch.hat);
  return s;
}

// Draw one character. view: front | back | left | right. face: { eyes, mouth }
// pose: { arms: down|up|point|hips, pointDir: -1|1 (front view), headRot (degrees), headDy }
function drawCharacter(ch, view = 'front', face = {}, pose = {}) {
  if (view === 'left') {
    const p = Object.assign({}, pose, { headRot: -(pose.headRot || 0) });
    return `<g transform="scale(-1,1)">${drawCharacter(ch, 'right', face, p)}</g>`;
  }
  const v = view === 'right' || view === 'side' ? 'side' : view;
  const r = rig(ch.body);
  const skin = skinOf(ch);
  const top = ch.top || DEFAULTS.top, bottom = ch.bottom || DEFAULTS.bottom, shoes = ch.shoes || DEFAULTS.shoes;
  const ex = ch.extras || {};
  const hands = ch.gloves || skin;
  let s = '';
  if (ex.cape && v !== 'back') s += cape(v, r, ex.cape);
  s += legs(v, r, skin, bottom);
  s += shoesSvg(v, shoes);
  if (v !== 'side') s += arms(v, r, top, skin, hands, pose);
  s += torso(v, r, top);
  if (ex.cape && v === 'back') s += cape(v, r, ex.cape);
  s += neck(v, r, top, ex);
  if (v === 'side') s += arms(v, r, top, skin, hands, pose);
  const rot = pose.headRot ? ` rotate(${r1(pose.headRot)} 0 ${HEAD.ry})` : '';
  s += `<g transform="translate(0,${r1(r.cy + (pose.headDy || 0))})${rot}">${headSvg(ch, v, face)}</g>`;
  return s;
}

module.exports = {
  INK, HEAD, EYE, SKIN_TONES, BODIES, EYE_POSES, MOUTH_SHAPES,
  rig, skinOf, shade, drawCharacter, headSvg, mouthShape,
  // drawing helpers, shared with the scenes
  piece, tube, line, polygon, pathEl, circle, ellipse, rect, arcPts, r1,
};
