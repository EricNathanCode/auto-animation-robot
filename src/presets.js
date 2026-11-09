'use strict';
// Auto Animate · the "preset" sheet (v2, on the default body): like a paper-cutout show's character preset.
// Top: 8 poses (front, 3/4 left, 3/4 right, back, sitting, walking ×2, sitting from the back).
// Below: every part on its own (arms, hands, feet, brows, eyelids, eyes, mouths, head + hair, body, colours).
// Also exportParts(): every part as its own SVG file, ready for other animation tools.
const fs = require('fs');
const path = require('path');
const P2 = require('./puppet2');
const { fonts } = require('./sheets');

const W = 2400, H = 1500;
const GREY = '#9A938C', SUB = '#5C5446';
const r1 = n => Math.round(n * 10) / 10;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (x, y, str, size, weight = 600, fill = GREY, extra = '') =>
  `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}"${extra}>${esc(str)}</text>`;
const label = (x, y, str) => text(x, y, str, 17, 600, GREY, ' text-anchor="middle"');
const head = (x, y, str) => text(x, y, str, 19, 700, SUB, ' letter-spacing="3"');
const at = (x, y, s, body) => `<g transform="translate(${r1(x)},${r1(y)}) scale(${s})" filter="url(#grain)">${body}</g>`;

function svgOpen(w, h) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><style>${fonts()} text{font-family:'Fredoka','Segoe UI',sans-serif;}</style>` +
    `<filter id="grain" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.55 0 0 0 -0.26" result="g"/>` +
    `<feComposite in="g" in2="SourceAlpha" operator="in" result="gi"/>` +
    `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge></filter></defs>` +
    `<rect width="${w}" height="${h}" fill="#FFFFFF"/>`;
}

// the same 8 poses as a paper-cutout show's preset
const POSES = [
  ['front', 'front', {}, {}], ['3/4 left', 'q-left', {}, {}], ['3/4 right', 'q-right', {}, {}], ['back', 'back', {}, {}],
  ['sitting', 'front', {}, { legs: 'sit' }], ['walking', 'q-left', {}, { legs: 'walk-a' }],
  ['walking', 'q-right', {}, { legs: 'walk-a' }], ['sitting (back)', 'back', {}, { legs: 'sit' }],
];
const EYE_ROW = ['open', 'lookL', 'lookR', 'lookU', 'lookD', 'half', 'closed', 'happy', 'angry', 'sad', 'shock', 'squint'];
const LIDS = ['half', 'angry', 'sad', 'closed'];
const MOUTH_SOUNDS = { X: 'rest', A: 'M B P', B: 'K S T', C: 'EH AE', D: 'AA', E: 'AO ER', F: 'OO W', G: 'F V', H: 'L', smile: 'smile', frown: 'frown', yell: 'yell', smirk: 'smirk' };
const HANDS = ['front', 'side', 'thumb up', 'open', 'back', 'fist'];

function colours(ch) {
  const ex = ch.extras || {}, out = [['skin', P2.skinOf(ch)]];
  if (ch.hair && ch.hair.style !== 'none') out.push(['hair', ch.hair.color]);
  if (ch.hat && ch.hat.style) out.push(['hat', ch.hat.color]);
  if (ch.top) out.push(['top', ch.top.color]);
  if (ch.bottom) out.push(['bottom', ch.bottom.color]);
  out.push(['shoes', (ch.shoes && ch.shoes.color) || '#2A2426']);
  if (ex.glasses) out.push(['glasses', ex.glasses.color]);
  if (ex.cape) out.push(['cape', ex.cape.color]);
  if (ex.beard && (!ch.hair || ex.beard.color !== ch.hair.color)) out.push(['beard', ex.beard.color]);
  return out.slice(0, 9);
}
// arm pieces (sleeve + mitten), drawn on their own
function armPiece(kind, ch) {
  const top = ch.top || { style: 'tee', color: '#DDE3EC' }, skin = P2.skinOf(ch), hands = ch.gloves || skin;
  const col = top.style === 'tee' ? skin : top.color;
  const paths = { down: [[0, -70], [4, -36], [0, 0]], bent: [[0, -70], [38, -38], [10, 0]], up: [[0, 0], [12, -38], [24, -72]], point: [[-50, -8], [0, -18], [52, -12]] };
  const [S, C, Hh] = paths[kind];
  return P2.tube(`M ${S[0]},${S[1]} Q ${C[0]},${C[1]} ${Hh[0]},${Hh[1]}`, col, 30) +
    (top.style === 'tee' ? P2.tube(`M ${S[0]},${S[1]} L ${(S[0] + C[0]) / 2},${(S[1] + C[1]) / 2}`, top.color, 33) : '') +
    P2.handSvg(Hh[0], Hh[1], hands, kind === 'point' ? 0 : -1);
}
// one mitten in different hand poses (the thumb is its own small paper piece)
function handPiece(n, color) {
  if (n === 'front') return P2.handSvg(0, 0, color, 1);
  if (n === 'side') return P2.paper([P2.ellipse(0, 0, 21, 17), P2.ellipse(15, -9, 7, 9, 20)], color);
  if (n === 'thumb up') return P2.paper([P2.circle(0, 0, 16), P2.ellipse(0, -18, 6.5, 10)], color);
  if (n === 'open') return P2.paper([P2.circle(0, 0, 16), P2.ellipse(17, -4, 6.5, 10, 60)], color);
  if (n === 'back') return P2.paper(P2.circle(0, 0, 16), color);
  return P2.paper(P2.circle(0, 0, 16), color) + P2.paper(P2.ellipse(2, -3, 10, 5, -18), color); // fist: thumb folded across
}
// boots: the shaft (+ fur cuff) above the flat shoe
function bootTop(sh, x0, x1) {
  if (sh.style !== 'boots') return '';
  let s = P2.paper(P2.rect(x0 - 2, -31, x1 - x0 + 4, 27), sh.color);
  if (sh.fur) s += P2.paper(Array.from({ length: 9 }, (_, i) => P2.circle(x0 + (x1 - x0) * i / 8, -31, 7.5)), sh.fur);
  return s;
}
// the body piece: top + collar (+ the cape's fur on the near shoulder in 3/4)
const bodyPiece = (v, r, top, ex) => P2.torsoSvg(v, r, top) + P2.neckSvg(v, r, top, ex) + (ex.cape && v === 'q' ? P2.capeFurQ(r, ex.cape) : '');
const headBlank = skin => P2.paper(P2.circle(0, 0, P2.HEAD.r), skin);

function presetSheet(ch, meta) {
  const r = P2.rig(ch.body), skin = P2.skinOf(ch), kid = ch.body !== 'adult';
  let s = svgOpen(W, H);
  s += text(40, 46, `${(ch.name || ch.id).toUpperCase()} · PAPER PRESET v2`, 22, 700, SUB, ' letter-spacing="3"');
  s += text(W - 40, H - 22, `Auto Animate · original character · ${meta.date}`, 16, 600, GREY, ' text-anchor="end"');
  // 1) poses
  const S = kid ? 1.24 : 1.02, GY = 600;
  POSES.forEach(([name, view, face, pose], i) => {
    const x = 165 + i * 296;
    s += at(x, GY, S, P2.drawCharacter(ch, view, Object.assign({ eyes: 'open', mouth: 'X' }, face), pose));
    s += label(x, GY + 40, name);
  });
  // 2) arms, hands, feet
  let y = 700;
  s += head(40, y, 'ARMS');
  ['down', 'bent', 'up', 'point'].forEach((k, i) => { s += at(90 + i * 125, y + 112, 1.05, armPiece(k, ch)); });
  s += head(600, y, 'HANDS');
  const hands = ch.gloves || skin;
  HANDS.forEach((n, i) => { s += at(640 + i * 92, y + 70, 1.6, handPiece(n, hands)) + label(640 + i * 92, y + 128, n); });
  s += head(1220, y, 'FEET');
  const sh = ch.shoes || { style: 'plain', color: '#2A2426' };
  s += at(1310, y + 100, 0.95, bootTop(sh, -r.legW, r.legW) + P2.shoe(sh, 0, -5, r.foot, 5.5)) + label(1310, y + 128, 'front');
  s += at(1495, y + 100, 0.95, bootTop(sh, r.qLeg[0], r.qLeg[1]) + P2.shoe(sh, r.qFoot[0], -5, r.qFoot[1], 5.5)) + label(1495, y + 128, '3/4');
  s += at(1660, y + 112, 1.2, P2.solesSvg('front', sh)) + label(1660, y + 128, 'soles (sitting)');
  s += at(1850, y + 108, 1.3, P2.shoe(sh, 0, -20, 9, 21, 35)) + label(1850, y + 128, 'kick (walking)');
  // 3) brows + eyelids
  y = 860;
  s += head(40, y, 'BROWS');
  const browCol = ch.brows || (ch.hair && ch.hair.style !== 'none' ? P2.shade(ch.hair.color, -0.25) : P2.LINE);
  P2.BROWS.forEach((b, i) => { s += at(110 + i * 140, y + 62, 1.5, P2.browsSvg('front', b, browCol)) + label(110 + i * 140, y + 70, b); });
  s += head(1300, y, 'EYELIDS');
  LIDS.forEach((l, i) => { s += at(1380 + i * 150, y + 42, 1.2, P2.lidsSvg(l, skin)) + label(1380 + i * 150, y + 110, l); });
  // 4) eyes
  y = 1020;
  s += head(40, y, 'EYES');
  EYE_ROW.forEach((e, i) => { s += at(100 + i * 135, y + 41, 1.05, P2.eyesSvg('front', e, skin)) + label(100 + i * 135, y + 118, P2.EYES[e].label); });
  s += head(1700, y, '3/4 EYE');
  ['open', 'lookL', 'half', 'angry'].forEach((e, i) => { s += at(1765 + i * 150 - 78 * 1.1, y + 39, 1.1, P2.eyesSvg('q', e, skin)) + label(1765 + i * 150, y + 118, P2.EYES[e].label); });
  // 5) mouths
  y = 1180;
  s += head(40, y, 'MOUTHS');
  P2.MOUTHS.forEach((m, i) => {
    s += at(110 + i * 118, y + 44, 2.1, P2.mouthSvg(m));
    s += text(110 + i * 118, y + 110, m.length === 1 ? m : '', 20, 700, SUB, ' text-anchor="middle"') + label(110 + i * 118, y + 130, MOUTH_SOUNDS[m]);
  });
  // 6) head + hair, body, colours (right side of the mouth row, then the last row)
  const hx = 1690;
  s += head(hx - 40, y, 'HEAD + HAIR');
  const hairOnly = v => headBlank(skin) + P2.hairSvg(v, ch.hair || {}) + ((ch.extras || {}).beard ? P2.beardSvg(v, ch.extras.beard) : '') + P2.hatSvg(v, ch.hat);
  [['blank', headBlank(skin)], ['front', hairOnly('front')], ['3/4', hairOnly('q')], ['back', hairOnly('back')]]
    .forEach(([n, body], i) => { s += at(hx + 20 + i * 170, y + 100, 0.6, body) + label(hx + 20 + i * 170, y + 214, n); });
  y = 1420;
  s += head(40, y - 10, 'BODY');
  const top = ch.top || { style: 'tee', color: '#DDE3EC' }, ex = ch.extras || {};
  ['front', 'q', 'back'].forEach((v, i) => {
    const mid = (r.T + r.B) / 2, sc = kid ? 0.6 : 0.46;
    s += at(220 + i * 170, y + 20, sc, `<g transform="translate(0,${-mid})">${bodyPiece(v, r, top, ex)}</g>`);
  });
  s += head(740, y - 10, 'COLOURS');
  colours(ch).forEach(([n, hex], i) => {
    const x = 860 + i * 84;
    s += `<g filter="url(#grain)"><rect x="${x}" y="${y - 40}" width="72" height="56" fill="${hex}"/></g>` +
      text(x + 36, y + 36, n, 14, 600, GREY, ' text-anchor="middle"') + text(x + 36, y + 54, hex.toUpperCase(), 13, 600, GREY, ' text-anchor="middle"');
  });
  return s + '</svg>';
}

// every part as its own SVG file (for other animation tools)
function exportParts(ch, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const skin = P2.skinOf(ch), r = P2.rig(ch.body), top = ch.top || { style: 'tee', color: '#DDE3EC' }, ex = ch.extras || {};
  const sh = ch.shoes || { style: 'plain', color: '#2A2426' }, hands = ch.gloves || skin;
  const browCol = ch.brows || (ch.hair && ch.hair.style !== 'none' ? P2.shade(ch.hair.color, -0.25) : P2.LINE);
  const out = [];
  const put = (name, vb, body) => {
    fs.writeFileSync(path.join(dir, `${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`);
    out.push(name);
  };
  const y0 = r.headTop - 40;
  POSES.forEach(([n, view, face, pose], i) => put(`pose-${i + 1}-${n.replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`, `-210 ${y0} 420 ${-y0 + 20}`,
    P2.drawCharacter(ch, view, Object.assign({ eyes: 'open', mouth: 'X' }, face), pose)));
  for (const e of Object.keys(P2.EYES)) put(`eyes-front-${e}`, '-70 -38 140 84', P2.eyesSvg('front', e, skin));
  for (const e of Object.keys(P2.EYES)) put(`eyes-34-${e}`, '40 -38 76 88', P2.eyesSvg('q', e, skin));
  for (const b of P2.BROWS) put(`brows-${b}`, '-50 -52 100 34', P2.browsSvg('front', b, browCol));
  for (const l of LIDS) put(`lids-${l}`, '-70 -38 140 84', P2.lidsSvg(l, skin));
  for (const m of P2.MOUTHS) put(`mouth-${m}`, '-22 -14 44 44', P2.mouthSvg(m));
  put('head-blank', '-110 -110 220 220', headBlank(skin));
  for (const v of ['front', 'q', 'back']) {
    put(`hair-${v === 'q' ? '34' : v}`, '-130 -130 260 300', P2.hairSvg(v, ch.hair || {}) + (ex.beard ? P2.beardSvg(v, ex.beard) : '') + P2.hatSvg(v, ch.hat));
    put(`body-${v === 'q' ? '34' : v}`, `-120 ${r.T - 30} 240 ${r.B - r.T + 50}`, bodyPiece(v, r, top, ex));
  }
  HANDS.forEach(n => put(`hand-${n.replace(' ', '-')}`, '-30 -32 60 62', handPiece(n, hands)));
  put('feet-front', `${-r.foot - 6} -42 ${2 * r.foot + 12} 46`, bootTop(sh, -r.legW, r.legW) + P2.shoe(sh, 0, -5, r.foot, 5.5));
  put('feet-34', `${r.qFoot[0] - r.qFoot[1] - 6} -42 ${2 * r.qFoot[1] + 12} 46`, bootTop(sh, r.qLeg[0], r.qLeg[1]) + P2.shoe(sh, r.qFoot[0], -5, r.qFoot[1], 5.5));
  put('feet-soles', '-50 -52 100 58', P2.solesSvg('front', sh));
  put('feet-kick', '-24 -44 48 50', P2.shoe(sh, 0, -20, 9, 21, 35));
  return out;
}

module.exports = { presetSheet, exportParts, W, H };
