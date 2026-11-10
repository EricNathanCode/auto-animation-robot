'use strict';
// Auto Animate · insert cards: big paper close-ups of a key object (a shop sign, a poster, a book, a lunchbox,
// a museum label), like the object shots in the Style Bible. Flat 2D paper; the art can be a hat drawn big.
// A story lists its cards:  "cards": { "shop": { "kind": "sign", "title": ["VIKING HELMET"], "art": {...}, "lines": ["$19.99"] } }
const P2 = require('./puppet2');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ease = u => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u));
const KINDS = {
  poster: { w: 760, h: 1000, paper: '#FFF4DE', ink: '#2A211E', accent: '#D9443B' },
  sign: { w: 860, h: 800, paper: '#EBCB92', ink: '#3B2414', accent: '#9A3A1E', frame: '#8A5A3B' },
  book: { w: 740, h: 960, paper: '#3E6FB0', ink: '#FFF4DE', accent: '#FFD23F', spine: '#2C5288' },
  box: { w: 860, h: 680, paper: '#D9443B', ink: '#FFF4DE', accent: '#FFD23F', handle: '#7A2A22' },
  label: { w: 840, h: 900, paper: '#F4EFE6', ink: '#2A211E', accent: '#5B6475' },
  phone: { w: 640, h: 1120, paper: '#1E1E26', ink: '#1E1E26', accent: '#2F80ED' },
};

// ---------- scene props (in the scene's own units) ----------
// a steak: raw = pink-red with a white fat edge and marbling; cooked = brown with grill marks
function steakSvg(raw) {
  const d = 'M -60,-8 C -62,-30 -30,-38 0,-34 C 30,-40 64,-30 62,-6 C 66,16 40,30 6,28 C -30,32 -62,22 -60,-8 Z';
  if (raw) {
    return P2.paper(P2.ellipse(-2, -4, 66, 38), '#F4E2DC') + P2.paper(`<path d="${d}"/>`, '#CF3D52') +
      P2.stroke('M -36,-14 Q -18,-22 2,-12 M 8,6 Q 26,-6 44,2 M -30,12 Q -12,4 4,14', '#F28B9A', 4);
  }
  return P2.paper(`<path d="${d}"/>`, '#8A4A2B') + P2.stroke('M -34,-24 L -10,20 M -6,-28 L 18,18 M 22,-26 L 44,10', '#5A2E1A', 6);
}
const plateSvg = () => P2.paper(P2.ellipse(0, 0, 100, 24), '#FBF8F2') + `<ellipse cx="0" cy="-1" rx="78" ry="15" fill="none" stroke="#E2DACB" stroke-width="3"/>`;
// the red trail a wet steak leaves on clean glass, from the top (y0) down to where the steak is now (y1)
function smearSvg(x, y0, y1) {
  if (y1 <= y0 + 2) return '';
  // juicy, see-through and runny: a wide wet streak, a brighter middle, drips that run further down
  let s = `<rect x="${x - 40}" y="${y0 - 14}" width="80" height="${Math.round(y1 - y0 + 14)}" rx="36" fill="#E0465A" opacity="0.42"/>`;
  s += `<rect x="${x - 22}" y="${y0 - 8}" width="44" height="${Math.round(y1 - y0 + 4)}" rx="20" fill="#F2667A" opacity="0.45"/>`;
  for (const [dx, len, w] of [[-30, 0.7, 9], [6, 1.0, 11], [28, 0.5, 8]]) {
    const yd = Math.round(y1 + (y1 - y0) * 0.12 * len + 14);
    s += `<path d="M ${x + dx},${y0} L ${x + dx},${yd}" stroke="#D93A50" stroke-width="${w}" stroke-linecap="round" opacity="0.5"/><circle cx="${x + dx}" cy="${yd + 4}" r="${w * 0.75}" fill="#D93A50" opacity="0.55"/>`;
  }
  s += `<path d="M ${x - 12},${y0 + 6} L ${x - 12},${Math.round(y1 - 10)}" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.35"/>`; // a wet shine
  return s;
}
// a party balloon tied at 0,0 (a fence post, a hand); the string goes up "len" and the balloon sways
function balloonSvg(p, t = 0) {
  const len = p.len || 220, col = p.color || '#E8505B', a = Math.sin(t * 1.7 + (p.seed || 0)) * 4;
  let s = `<path d="M 0,0 Q 14,${-len * 0.3} -4,${-len * 0.6} T 0,${-len}" fill="none" stroke="#5B4A44" stroke-width="2.5"/>`;
  s += P2.paper([P2.ellipse(0, -len - 54, 44, 54), `<path d="M -9,${-len + 4} L 9,${-len + 4} L 0,${-len - 8} Z"/>`], col);
  s += `<ellipse cx="-15" cy="${-len - 72}" rx="9" ry="17" fill="#FFFFFF" opacity="0.5" transform="rotate(-20 -15 ${-len - 72})"/>`;
  return `<g transform="rotate(${a.toFixed(2)})">${s}</g>`;
}
// a small orange kitten sitting (0,0 = the ground under it), facing right (face -1 = left); the tail swishes
function kittenSvg(p, t = 0) {
  const fur = p.color || '#F2A04A', dk = '#C9772A', light = '#FFE6C8', w = Math.sin(t * 3 + (p.seed || 0)) * 10;
  let s = P2.tube(`M -26,-14 Q -66,-20 ${r1(-62 + w * 0.3)},-58 Q ${r1(-58 + w)},-90 ${r1(-40 + w)},-96`, fur, 14);
  s += P2.paper(P2.ellipse(0, -40, 40, 42), fur) + P2.paper(P2.ellipse(10, -32, 20, 26), light, 0);
  s += P2.stroke('M -34,-52 Q -26,-48 -22,-38 M -38,-34 Q -30,-30 -26,-22', dk, 4);
  s += P2.paper([P2.ellipse(-12, -5, 14, 8), P2.ellipse(20, -5, 14, 8)], light);
  s += P2.paper([P2.circle(12, -96, 34), '<path d="M -16,-112 L -18,-148 L 8,-126 Z"/>', '<path d="M 20,-127 L 42,-146 L 44,-110 Z"/>'], fur);
  s += '<path d="M -12,-118 L -13,-138 L 2,-125 Z" fill="#F7A9B8"/><path d="M 24,-125 L 38,-137 L 39,-115 Z" fill="#F7A9B8"/>';
  s += P2.stroke('M 0,-128 L 2,-117 M 12,-130 L 12,-119 M 24,-128 L 22,-117', dk, 4);
  s += '<ellipse cx="0" cy="-99" rx="5.5" ry="7.5" fill="#2A211E"/><ellipse cx="25" cy="-99" rx="5.5" ry="7.5" fill="#2A211E"/><circle cx="2" cy="-102" r="2" fill="#FFF"/><circle cx="27" cy="-102" r="2" fill="#FFF"/>';
  s += '<path d="M 9,-88 L 16,-88 L 12.5,-84 Z" fill="#E86A7A"/>' + P2.stroke('M 12.5,-84 Q 9,-78 4,-80 M 12.5,-84 Q 16,-78 21,-80', '#2A211E', 2);
  s += P2.stroke('M -6,-88 L -26,-92 M -6,-84 L -26,-82 M 31,-88 L 51,-92 M 31,-84 L 51,-82', '#FFFFFF', 2);
  return p.face === -1 ? `<g transform="scale(-1,1)">${s}</g>` : s;
}
// a firefighter's metal ladder, standing on 0,0 and going up "len"
function ladderSvg(p) {
  const len = p.len || 600, w = 74, rail = p.color || '#C9CED6';
  let s = '';
  for (let y = -34; y > -len + 12; y -= 46) s += P2.paper(P2.rect(-w / 2, y - 6, w, 12, 4), '#AEB4BE');
  s += P2.paper([P2.rect(-w / 2 - 10, -len, 14, len, 5), P2.rect(w / 2 - 4, -len, 14, len, 5)], rail);
  s += P2.paper([P2.rect(-w / 2 - 12, -10, 18, 12, 4), P2.rect(w / 2 - 6, -10, 18, 12, 4)], '#3A3F4A');
  return s;
}
const r1 = n => Math.round(n * 10) / 10;
// one prop at its place: { kind, x, y, rot, scale, raw }; t = seconds (for swaying balloons, swishing tails)
function propSvg(p, t = 0) {
  const body = p.kind === 'steak' ? steakSvg(p.raw) : p.kind === 'plate' ? plateSvg() : p.kind === 'smear' ? smearSvg(0, 0, p.len || 0)
    : p.kind === 'balloon' ? balloonSvg(p, t) : p.kind === 'kitten' ? kittenSvg(p, t) : p.kind === 'ladder' ? ladderSvg(p) : '';
  const op = p.opacity !== undefined ? ` opacity="${Math.round(p.opacity * 100) / 100}"` : '';
  return `<g transform="translate(${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}) rotate(${Math.round((p.rot || 0) * 10) / 10}) scale(${p.scale || 1})"${op}>${body}</g>`;
}
// a small paper bird with dizzy stars (it just flew into a window)
function birdSvg() {
  let s = P2.paper([P2.ellipse(0, 0, 70, 52), P2.circle(54, -40, 36)], '#5AA0D8');
  s += P2.paper(P2.ellipse(-12, 4, 42, 24, -18), '#3C78AE') + P2.paper('<path d="M 86,-44 L 122,-34 L 86,-24 Z"/>', '#F2A53A');
  s += '<circle cx="62" cy="-48" r="13" fill="#FFFFFF"/><path d="M 55,-55 L 69,-41 M 69,-55 L 55,-41" stroke="#2A211E" stroke-width="4" stroke-linecap="round"/>';
  for (const [x, y] of [[20, -110], [70, -122], [118, -100]]) s += `<path transform="translate(${x},${y})" d="M 0,-14 L 4,-4 L 14,-4 L 6,3 L 9,13 L 0,7 L -9,13 L -6,3 L -14,-4 L -4,-4 Z" fill="#FFD23F" stroke="#C9971E" stroke-width="2"/>`;
  return s;
}
// a plain red brick (card art)
function brickSvg() {
  let s = P2.paper(P2.rect(-120, -46, 240, 104, 10), '#9C4632') + P2.paper(P2.rect(-120, -58, 240, 96, 10), '#C2583F');
  for (const [x, y] of [[-80, -30], [-30, 6], [24, -24], [70, 12], [96, -36], [-100, 14]]) s += `<circle cx="${x}" cy="${y}" r="4" fill="#9C4632" opacity="0.7"/>`;
  return s + P2.stroke('M -100,-46 L 60,-46', '#E07A5F', 5);
}
// a duck night light (card art): a glowing yellow duck on a little stand
function duckLightSvg() {
  let s = '<circle cx="0" cy="-60" r="150" fill="#FFD84A" opacity="0.22"/><circle cx="0" cy="-60" r="104" fill="#FFE680" opacity="0.35"/><circle cx="0" cy="-60" r="66" fill="#FFF3B0" opacity="0.45"/>';
  s += P2.paper(P2.rect(-80, -6, 160, 30, 12), '#E8E1F2');
  s += P2.paper([P2.ellipse(-6, -52, 78, 50), P2.circle(44, -118, 40)], '#FFD84A');
  s += P2.paper(P2.ellipse(-28, -52, 36, 22, -14), '#F4C232') + P2.paper('<path d="M 80,-118 L 112,-108 L 80,-98 Z"/>', '#F28C28');
  return s + '<circle cx="56" cy="-126" r="7" fill="#2A211E"/><circle cx="58" cy="-128" r="2.2" fill="#FFF"/>';
}
const text = (y, str, size, fill, extra = '') =>
  `<text x="0" y="${y}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${fill}"${extra}>${esc(str)}</text>`;

// the card in screen space (1080 x 1920), centred, with a slow push-in (u = shot progress 0..1)
function card(spec, u = 0) {
  const k = KINDS[spec.kind] || KINDS.poster;
  const paper = spec.paper || k.paper, ink = spec.ink || k.ink, accent = spec.accent || k.accent, w = k.w, h = k.h;
  const sc = 1 + 0.07 * ease(u), rot = (spec.tilt === undefined ? -3 : spec.tilt) + 1.5 * ease(u);
  let g = `<rect x="${-w / 2 + 16}" y="${-h / 2 + 22}" width="${w}" height="${h}" rx="26" fill="#140C1C" opacity="0.38"/>`; // drop shadow
  if (spec.kind === 'phone') { // a phone with a text message: the sender on top, chat bubbles below
    g += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="80" fill="${paper}"/>` +
      `<rect x="${-w / 2 + 26}" y="${-h / 2 + 26}" width="${w - 52}" height="${h - 52}" rx="58" fill="#F4F6FA"/>` +
      `<rect x="-70" y="${-h / 2 + 40}" width="140" height="30" rx="15" fill="${paper}"/>` +
      `<rect x="${-w / 2 + 26}" y="${-h / 2 + 90}" width="${w - 52}" height="120" fill="#E9ECF2"/>` +
      `<circle cx="0" cy="${-h / 2 + 128}" r="26" fill="#D9A06F"/>` + text(-h / 2 + 190, [].concat(spec.title || [''])[0], 34, '#5B6475');
    let y = -h / 2 + 290;
    for (const b of spec.bubbles || []) {
      const lines = [].concat(b), bh = lines.length * 62 + 34;
      g += `<rect x="${-w / 2 + 60}" y="${y}" width="${w - 150}" height="${bh}" rx="34" fill="#E3E6EC"/>`;
      lines.forEach((t, i) => { g += `<text x="${-w / 2 + 96}" y="${y + 66 + i * 62}" font-size="46" font-weight="600" fill="#1E1E26">${esc(t)}</text>`; });
      y += bh + 34;
    }
    return `<g transform="translate(540,820) scale(${Math.round(sc * 1000) / 1000}) rotate(${Math.round(rot * 10) / 10})">${g}</g>`;
  }
  if (k.handle) g += P2.tube(`M -150,${-h / 2 + 8} Q -150,${-h / 2 - 90} 0,${-h / 2 - 90} Q 150,${-h / 2 - 90} 150,${-h / 2 + 8}`, k.handle, 26);
  if (k.frame) g += P2.paper(P2.rect(-w / 2 - 22, -h / 2 - 22, w + 44, h + 44, 30), k.frame);
  g += P2.paper(P2.rect(-w / 2, -h / 2, w, h, 24), paper, 2);
  if (k.spine) g += P2.paper(P2.rect(-w / 2, -h / 2, 70, h, 12), k.spine, 0) + `<rect x="${-w / 2 + 70}" y="${-h / 2}" width="5" height="${h}" fill="#1D3A66" opacity="0.5"/>`;
  if (spec.kind === 'poster' || !spec.kind) for (const [x, r] of [[-w / 2 + 70, -8], [w / 2 - 70, 6]]) g += `<rect x="${x - 70}" y="${-h / 2 - 24}" width="140" height="46" fill="#E8D6A0" opacity="0.9" transform="rotate(${r} ${x} ${-h / 2})"/>`;
  if (spec.kind === 'label' || spec.kind === 'sign') for (const x of [-w / 2 + 44, w / 2 - 44]) g += `<circle cx="${x}" cy="${-h / 2 + 44}" r="13" fill="${accent}" stroke="#2A211E" stroke-width="2"/>`;
  // title at the top, the art in the middle, small lines at the bottom
  const title = [].concat(spec.title || []), lines = [].concat(spec.lines || []), ts = spec.titleSize || 92;
  title.forEach((t, i) => { g += text(-h / 2 + 150 + i * (ts + 12), t, ts, i === title.length - 1 && title.length > 1 ? accent : ink); });
  if (spec.art) {
    const as = spec.artScale || 2.3, ay = spec.artY === undefined ? 40 : spec.artY; // the hat's middle is ~107 above its own 0
    if (spec.art.style === 'bird') g += `<g transform="translate(-30,${ay + 40}) scale(${as * 0.9})">${birdSvg()}</g>`;
    else if (spec.art.style === 'steak') g += `<g transform="translate(0,${ay}) scale(${as * 1.3})">${steakSvg(spec.art.raw)}</g>`;
    else if (spec.art.style === 'brick') g += `<g transform="translate(0,${ay}) scale(${as})">${brickSvg()}</g>`;
    else if (spec.art.style === 'duck') g += `<g transform="translate(0,${ay + 60 * as}) scale(${as})">${duckLightSvg()}</g>`;
    else g += `<g transform="translate(0,${ay + 107 * as}) scale(${as})">${P2.hatSvg('front', spec.art)}</g>`;
  }
  lines.forEach((t, i) => { g += text(h / 2 - 70 - (lines.length - 1 - i) * 78, t, 66, i === 0 ? accent : ink); });
  return `<g transform="translate(540,820) scale(${Math.round(sc * 1000) / 1000}) rotate(${Math.round(rot * 10) / 10})">${g}</g>`;
}

module.exports = { card, KINDS, propSvg, smearSvg, steakSvg, birdSvg };
