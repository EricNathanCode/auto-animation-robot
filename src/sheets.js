'use strict';
// Auto Animate · character sheets (SVG): a turnaround sheet per character + the base puppet sheet.
const fs = require('fs');
const path = require('path');
const P = require('./puppet');

const FONT_DIR = process.env.FONT_DIR || path.join(__dirname, '..', '..', 'tools', 'fonts');
const C = { bg: '#F4EEE1', card: '#FFFDF8', muted: '#8C8170', guide: '#CFC2AA', ink: P.INK, sub: '#5C5446', tape: '#E8D6A0' };
const r1 = n => Math.round(n * 10) / 10;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (x, y, str, size, weight = 600, fill = C.ink, extra = '') =>
  `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}"${extra}>${esc(str)}</text>`;

let fontCss = null;
function fonts() {
  if (fontCss !== null) return fontCss;
  const f = (file, w) => {
    const p = path.join(FONT_DIR, file);
    return fs.existsSync(p) ? `@font-face{font-family:'Fredoka';font-weight:${w};src:url(data:font/ttf;base64,${fs.readFileSync(p).toString('base64')}) format('truetype');}` : '';
  };
  fontCss = f('Fredoka-SemiBold.ttf', 600) + f('Fredoka-Bold.ttf', 700);
  return fontCss;
}

function svgOpen(W, H) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><style>${fonts()} text{font-family:'Fredoka','Segoe UI',sans-serif;}</style>` +
    // paper grain + a soft drop shadow, like a cut-out lying on the table
    `<filter id="paper" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.7 0 0 0 -0.33" result="g"/>` +
    `<feComposite in="g" in2="SourceAlpha" operator="in" result="gi"/>` +
    `<feMerge result="m"><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge>` +
    `<feDropShadow in="m" dx="3" dy="4" stdDeviation="1.4" flood-color="${C.ink}" flood-opacity="0.25"/></filter>` +
    `<filter id="grain" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="4" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.35  0 0 0 0 0.25  0.4 0 0 0 -0.17"/></filter>` +
    `</defs><rect width="${W}" height="${H}" fill="${C.bg}"/><rect width="${W}" height="${H}" filter="url(#grain)"/>`;
}

function pill(x, y, label, size = 22) {
  const w = label.length * size * 0.78 + 40;
  return `<rect x="${r1(x - w / 2)}" y="${y - size - 8}" width="${r1(w)}" height="${size + 20}" rx="${(size + 20) / 2}" fill="${C.card}" stroke="${C.ink}" stroke-width="3"/>` +
    text(x, y, label, size, 700, C.ink, ' text-anchor="middle" letter-spacing="3"');
}
const tape = (x, y, rot) => `<rect x="${x}" y="${y}" width="120" height="30" fill="${C.tape}" opacity="0.85" transform="rotate(${rot} ${x + 60} ${y + 15})"/>`;

function swatches(ch) {
  const out = [['Skin', P.skinOf(ch)]];
  const ex = ch.extras || {};
  if (ch.hair && ch.hair.style !== 'none') out.push(['Hair', ch.hair.color]);
  if (ch.hat && ch.hat.style && ch.hat.style !== 'none') out.push(['Hat', ch.hat.color]);
  if (ch.top) out.push(['Top', ch.top.color]);
  if (ch.bottom) out.push(['Bottom', ch.bottom.color]);
  if (ch.shoes) out.push(['Shoes', ch.shoes.color]);
  if (ex.glasses) out.push(['Glasses', ex.glasses.color]);
  if (ex.cape) out.push(['Cape', ex.cape.color]);
  if (ex.pearls) out.push(['Pearls', ex.pearls.color]);
  if (ch.top && ch.top.patch) out.push(['Patch', ch.top.patch.color]);
  return out.slice(0, 8);
}

function card(ch, meta, x, y, w, h) {
  const cx = x + w / 2, cy = y + h / 2;
  let s = `<g transform="rotate(-1.2 ${cx} ${cy})">`;
  s += `<rect x="${x + 6}" y="${y + 8}" width="${w}" height="${h}" rx="18" fill="${C.ink}" opacity="0.16"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${C.card}" stroke="${C.ink}" stroke-width="4"/>`;
  s += tape(x + 36, y - 12, -7) + tape(x + w - 156, y - 12, 6);
  const L = x + 34, R = x + w - 30;
  const fit = (str, size, maxW) => Math.min(size, Math.floor(maxW / (String(str).length * 0.54)));
  let ty = y + 72;
  s += text(L, ty, 'CHARACTER', 18, 600, C.muted, ' letter-spacing="3"'); ty += 62;
  s += text(L, ty, ch.name, fit(ch.name, 58, R - L), 700); ty += 38;
  s += text(L, ty, ch.role || '', fit(ch.role || '', 22, R - L), 600, C.sub); ty += 26;
  s += `<line x1="${L}" x2="${x + w - 34}" y1="${ty}" y2="${ty}" stroke="${C.guide}" stroke-width="2"/>`; ty += 42;
  for (const [k, val] of [['Body', `${ch.body} puppet v1`], ['Voice', ch.voice || '-'], ['Good for', ch.goodFor || '-'], ['Version', ch.version || meta.version], ['Date', meta.date]]) {
    s += text(L, ty, k, 18, 600, C.muted) + text(L + 108, ty, val, fit(val, 22, R - L - 108), 600); ty += 36;
  }
  ty += 20;
  s += text(L, ty, 'WARDROBE', 18, 600, C.muted, ' letter-spacing="3"'); ty += 36;
  for (const item of ch.wardrobe || []) {
    s += `<circle cx="${L + 6}" cy="${ty - 7}" r="4" fill="${C.ink}"/>` + text(L + 20, ty, item, fit(item, 20, R - L - 20), 600); ty += 31;
  }
  ty += 20;
  s += text(L, ty, 'COLOURS', 18, 600, C.muted, ' letter-spacing="3"'); ty += 40;
  swatches(ch).forEach(([name, hex], i) => {
    const sx = L + 18 + (i % 2) * 178, sy = ty + Math.floor(i / 2) * 54;
    s += `<circle cx="${sx}" cy="${sy}" r="17" fill="${hex}" stroke="${C.ink}" stroke-width="3"/>`;
    s += text(sx + 28, sy - 3, name, 16, 600, C.muted) + text(sx + 28, sy + 16, hex.toUpperCase(), 16, 600);
  });
  s += text(L, y + h - 30, 'Original character · drawn in code', 16, 600, C.muted);
  return s + '</g>';
}

const EXPRESSIONS = [
  ['happy', { eyes: 'happy', mouth: 'smile' }], ['talking', { eyes: 'open', mouth: 'D' }], ['angry', { eyes: 'angry', mouth: 'frown' }],
  ['sad', { eyes: 'sad', mouth: 'frown' }], ['shocked', { eyes: 'shock', mouth: 'E' }],
];

// One character from the front, back, left and right + their face in 5 moods + a label card.
function turnaroundSheet(ch, meta) {
  const W = 1920, H = 1080, S = 1.4, GY = 950;
  const xs = [285, 615, 945, 1275];
  const r = P.rig(ch.body);
  const gy = y => r1(GY + S * y);
  let s = svgOpen(W, H);
  s += text(60, 76, 'AUTO ANIMATE · CHARACTER TURNAROUND', 22, 600, C.muted, ' letter-spacing="4"');
  s += text(60, 146, ch.name, 70, 700);
  s += text(60, 258, 'EXPRESSIONS', 18, 600, C.muted, ' letter-spacing="3"');
  EXPRESSIONS.forEach(([label, face], i) => {
    const x = 560 + i * 200;
    s += `<g transform="translate(${x},250) scale(0.62)" filter="url(#paper)">${P.headSvg(ch, 'front', face)}</g>`;
    s += text(x, 362, label, 18, 600, C.sub, ' text-anchor="middle"');
  });
  for (const [y, label] of [[0, 'ground'], [r.cy + P.EYE.y, 'eye line'], [r.headTop, 'head top']]) {
    s += `<line x1="40" x2="1440" y1="${gy(y)}" y2="${gy(y)}" stroke="${C.guide}" stroke-width="2" stroke-dasharray="10 9"/>`;
    s += text(40, gy(y) - 8, label, 16, 600, C.guide);
  }
  ['front', 'back', 'left', 'right'].forEach((v, i) => {
    s += `<g transform="translate(${xs[i]},${GY}) scale(${S})" filter="url(#paper)">${P.drawCharacter(ch, v)}</g>`;
    s += pill(xs[i], 1036, v.toUpperCase());
  });
  s += card(ch, meta, 1478, 54, 404, 972);
  return s + '</svg>';
}

const EYE_ORDER = ['open', 'lookL', 'lookR', 'half', 'closed', 'happy', 'angry', 'sad', 'shock'];
const EYE_MOUTH = { happy: 'smile', angry: 'frown', sad: 'frown', shock: 'E' };
const MOUTH_ORDER = ['X', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// The reusable base puppet: kid + adult body, and the eye + mouth sets.
function baseSheet(base, meta) {
  const W = 1920, H = 1380;
  let s = svgOpen(W, H);
  s += text(60, 76, 'AUTO ANIMATE · BASE PUPPET', 22, 600, C.muted, ' letter-spacing="4"');
  s += text(60, 146, 'One puppet, every character', 64, 700);
  s += text(60, 188, `Same body, head, eyes and mouths every time. Only the clothes, hair and colours change.   ${meta.version} · ${meta.date}`, 21, 600, C.sub);
  // skin tones
  s += text(1880, 70, 'SKIN TONES', 18, 600, C.muted, ' text-anchor="end" letter-spacing="3"');
  Object.entries(P.SKIN_TONES).forEach(([k, hex], i) => {
    const x = 1600 + i * 66;
    s += `<circle cx="${x}" cy="112" r="20" fill="${hex}" stroke="${C.ink}" stroke-width="3"/>` + text(x, 154, k, 15, 600, C.muted, ' text-anchor="middle"');
  });
  // bodies
  const S = 1.2, GY = 790;
  const kid = Object.assign({}, base, { body: 'kid' }), adult = Object.assign({}, base, { body: 'adult' });
  s += `<line x1="40" x2="1880" y1="${GY}" y2="${GY}" stroke="${C.guide}" stroke-width="2" stroke-dasharray="10 9"/>`;
  s += `<line x1="1215" x2="1215" y1="290" y2="${GY + 60}" stroke="${C.guide}" stroke-width="2" stroke-dasharray="10 9"/>`;
  s += text(620, r1(GY + S * P.rig('kid').headTop - 34), 'KID BODY', 24, 700, C.ink, ' text-anchor="middle" letter-spacing="3"');
  s += text(1545, r1(GY + S * P.rig('adult').headTop - 34), 'ADULT BODY · same head', 24, 700, C.ink, ' text-anchor="middle" letter-spacing="3"');
  for (const [ch, v, x, label] of [[kid, 'front', 200, 'FRONT'], [kid, 'back', 480, 'BACK'], [kid, 'left', 760, 'LEFT'], [kid, 'right', 1040, 'RIGHT'], [adult, 'front', 1400, 'FRONT'], [adult, 'right', 1690, 'RIGHT']]) {
    s += `<g transform="translate(${x},${GY}) scale(${S})" filter="url(#paper)">${P.drawCharacter(ch, v)}</g>`;
    s += pill(x, GY + 62, label, 20);
  }
  // eyes
  const EY = 1010, ES = 0.86;
  s += text(60, 902, 'EYES', 24, 700, C.ink, ' letter-spacing="3"') + text(150, 902, '9 poses: blink, look around, moods (the eyebrows move too)', 19, 600, C.muted);
  EYE_ORDER.forEach((pose, i) => {
    const x = 150 + i * 202;
    s += `<g transform="translate(${x},${EY}) scale(${ES})" filter="url(#paper)">${P.headSvg(base, 'front', { eyes: pose, mouth: EYE_MOUTH[pose] || 'X' })}</g>`;
    s += text(x, r1(EY + ES * 84 + 36), P.EYE_POSES[pose].label, 19, 600, C.sub, ' text-anchor="middle"');
  });
  // mouths
  const MY = 1236;
  s += text(60, 1162, 'MOUTHS', 24, 700, C.ink, ' letter-spacing="3"') + text(190, 1162, 'the 9 lip-sync shapes: the voice robot picks one for each sound', 19, 600, C.muted);
  MOUTH_ORDER.forEach((m, i) => {
    const x = 150 + i * 202;
    s += `<g filter="url(#paper)"><circle cx="${x}" cy="${MY}" r="54" fill="${P.skinOf(base)}" stroke="${C.ink}" stroke-width="4"/>` +
      `<g transform="translate(${x},${MY - 6}) scale(2)">${P.mouthShape(m)}</g></g>`;
    s += text(x, MY + 88, m, 26, 700, C.ink, ' text-anchor="middle"') + text(x, MY + 114, P.MOUTH_SHAPES[m], 17, 600, C.muted, ' text-anchor="middle"');
  });
  return s + '</svg>';
}

module.exports = { turnaroundSheet, baseSheet, fonts };
