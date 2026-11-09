'use strict';
// Auto Animate · the 2D "look" from the Style Bible (2026-11-09):
// mood light (day / sunset / night) with a sky tint, a glow + light rays at the light source, a warm or cool wash,
// more contrast, a vignette, soft ground shadows, and an effects kit (steam, sweat, sparkle, "!", dust, flash, shake).
// Everything is flat 2D SVG; glows and shadows use gradients (cheap), only far-layer depth blur uses a filter.
const W = 1080, H = 1920;
const r1 = n => Math.round(n * 10) / 10;

const MOODS = {
  day: {
    sky: ['#7FB4E8', '#A9D4F2', '#D7EEF8', '#F3F1DE'], skyOp: 0.45, glow: '#FFF6D6', glowR: 360, glowOp: 0.65, rays: 0.06,
    ground: '#FFE9C8', groundOp: 0.18, wash: '#FFF3E4', washOp: 0.25, vig: '#2E3550', vigOp: 0.32, grade: 'contrast(1.14) brightness(0.97) saturate(1.06)',
  },
  sunset: {
    sky: ['#4B3C8A', '#E26F7E', '#FFB06B', '#FFD58C'], skyOp: 0.85, glow: '#FFE9A8', glowR: 420, glowOp: 0.95, rays: 0.10,
    ground: '#FFB98A', groundOp: 0.35, wash: '#FFE0C2', washOp: 0.35, vig: '#3A2A55', vigOp: 0.5, grade: 'contrast(1.16) brightness(0.96) saturate(1.04)',
  },
  night: {
    sky: ['#0E1430', '#1F2F66', '#3A4E8C', '#5A6FA8'], skyOp: 0.95, glow: '#DCE6FF', glowR: 260, glowOp: 0.8, rays: 0,
    ground: '#4A5A9A', groundOp: 0.55, wash: '#9AAAD8', washOp: 0.5, vig: '#0A0E22', vigOp: 0.65, grade: 'contrast(1.15) brightness(0.9) saturate(0.95)',
  },
  // indoors in the evening: warm lamp light, no sky tint (the scene draws its own window)
  lamp: {
    sky: null, glow: '#FFD9A0', glowR: 560, glowOp: 0.6, rays: 0, ground: null, wash: '#FFE6C8', washOp: 0.35,
    vig: '#24141C', vigOp: 0.5, grade: 'contrast(1.14) brightness(0.97) saturate(1.05)', back: ['#FFE2B8', '#F2C083', '#C77F4E', '#8A4A35'],
  },
};

// gradients + filters the look needs (put once in <defs>)
function defs(moodName) {
  const m = MOODS[moodName] || MOODS.day;
  const stops = (cols, op = 1) => cols.map((c, i) => `<stop offset="${r1(i / (cols.length - 1))}" stop-color="${c}" stop-opacity="${op}"/>`).join('');
  let s = `<linearGradient id="lkSky" x1="0" y1="0" x2="0" y2="1">${stops(m.sky || ['#FFFFFF', '#FFFFFF'])}</linearGradient>`;
  s += `<radialGradient id="lkGlow"><stop offset="0" stop-color="${m.glow}" stop-opacity="${m.glowOp}"/><stop offset="0.35" stop-color="${m.glow}" stop-opacity="${r1(m.glowOp * 0.5)}"/><stop offset="1" stop-color="${m.glow}" stop-opacity="0"/></radialGradient>`;
  s += `<linearGradient id="lkRay" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFF6DA" stop-opacity="${m.rays * 2}"/><stop offset="1" stop-color="#FFF6DA" stop-opacity="0"/></linearGradient>`;
  // the vignette: soft, only in the corners (a strong one looks like a tunnel)
  s += `<radialGradient id="lkVig" cx="0.5" cy="0.46" r="0.85"><stop offset="0.6" stop-color="#FFFFFF"/><stop offset="0.85" stop-color="${m.vig}" stop-opacity="0.55"/><stop offset="1" stop-color="${m.vig}"/></radialGradient>`;
  s += `<radialGradient id="lkShadow"><stop offset="0" stop-color="#1E1630" stop-opacity="0.42"/><stop offset="0.6" stop-color="#1E1630" stop-opacity="0.22"/><stop offset="1" stop-color="#1E1630" stop-opacity="0"/></radialGradient>`;
  for (const b of [2, 4, 7, 12]) s += `<filter id="lkBlur${b}" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${b}"/></filter>`;
  // the backdrop behind insert cards: the mood's light in the middle, its shadow colour at the edges
  const sky = m.back ? [m.back[3], m.back[2], m.back[1], m.back[0]] : m.sky || ['#E8E2D6', '#E8E2D6', '#E8E2D6', '#F4EFE6'];
  s += `<radialGradient id="lkBack" cx="0.5" cy="0.42" r="0.9"><stop offset="0" stop-color="${sky[3]}"/><stop offset="0.55" stop-color="${sky[2]}"/><stop offset="1" stop-color="${sky[1]}"/></radialGradient>`;
  return s;
}
const blurId = px => (px >= 10 ? 'lkBlur12' : px >= 6 ? 'lkBlur7' : px >= 3 ? 'lkBlur4' : px >= 1 ? 'lkBlur2' : null);

// the sky tint over the far layer (multiply), the glow + rays at the light (screen)
function skyTint(moodName) {
  const m = MOODS[moodName];
  return m && m.sky ? `<rect x="-300" y="-300" width="${W + 600}" height="${H + 600}" fill="url(#lkSky)" style="mix-blend-mode:multiply" opacity="${m.skyOp}"/>` : '';
}
function lightGlow(moodName, x, y) {
  const m = MOODS[moodName];
  if (!m) return '';
  let s = `<circle cx="${x}" cy="${y}" r="${m.glowR}" fill="url(#lkGlow)" style="mix-blend-mode:screen"/>`;
  if (m.rays) {
    for (const a of [200, 214, 228, 244, 262]) { // long thin beams fanning down-left from the light
      const t0 = a * Math.PI / 180, t1 = (a + 5) * Math.PI / 180, L = 1700;
      s += `<path d="M ${x},${y} L ${r1(x + L * Math.cos(t0))},${r1(y - L * Math.sin(t0))} L ${r1(x + L * Math.cos(t1))},${r1(y - L * Math.sin(t1))} Z" fill="#FFF3D2" opacity="${m.rays}" style="mix-blend-mode:screen"/>`;
    }
  }
  return s;
}
function groundTint(moodName, yTop) {
  const m = MOODS[moodName];
  return m && m.ground ? `<rect x="-300" y="${yTop}" width="${W + 600}" height="${H + 600 - yTop}" fill="${m.ground}" style="mix-blend-mode:multiply" opacity="${m.groundOp}"/>` : '';
}
// screen-space: the light wash + the vignette (on top of everything except captions)
function overlay(moodName) {
  const m = MOODS[moodName];
  if (!m) return '';
  return `<rect width="${W}" height="${H}" fill="${m.wash}" style="mix-blend-mode:multiply" opacity="${m.washOp}"/>` +
    `<rect width="${W}" height="${H}" fill="url(#lkVig)" style="mix-blend-mode:multiply" opacity="${m.vigOp}"/>`;
}
const grade = moodName => ((MOODS[moodName] || {}).grade || 'none');
// a soft shadow on the ground under a character or a prop
const groundShadow = (x, y, rx, ry = 18) => `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="url(#lkShadow)"/>`;

// ---------- effects kit (character-local units: 0,0 = the ground under the feet; head = the head centre) ----------
const ease = u => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u));
function puff(x, y, s, op) {
  return `<g transform="translate(${r1(x)},${r1(y)}) scale(${r1(s * 100) / 100})" opacity="${r1(op * 100) / 100}">` +
    `<g fill="#B9B4B0"><circle cx="0" cy="0" r="17"/><circle cx="16" cy="-10" r="14"/><circle cx="-14" cy="-9" r="12"/></g>` +
    `<g fill="#FFFFFF"><circle cx="0" cy="-2" r="14"/><circle cx="15" cy="-12" r="11"/><circle cx="-13" cy="-11" r="9"/></g></g>`;
}
// angry: puffs of steam rise from both sides of the head, again and again
function steam(t, head) {
  let s = '';
  for (const [side, delay] of [[-1, 0], [1, 0.3]]) {
    const u = ((t + delay) % 0.6) / 0.6;
    s += puff(head.x + side * (head.r + 18 + u * 22), head.y - head.r * 0.55 - u * 70, 0.7 + u * 0.6, u < 0.75 ? 1 : (1 - u) * 4);
  }
  return s;
}
// nervous: a sweat drop slides down the side of the head (side -1/1: away from the face, so it never covers an eye)
function sweat(t, head, side = 1) {
  const u = (t % 0.9) / 0.9, x = head.x + side * head.r * 1.02, y = head.y - head.r * 0.5 + u * 46;
  return `<g transform="translate(${r1(x)},${r1(y)})" opacity="${u < 0.85 ? 1 : (1 - u) * 6.6}"><path d="M 0,-16 Q 11,2 0,10 Q -11,2 0,-16 Z" fill="#8FD3F4" stroke="#4A9CC8" stroke-width="2"/><ellipse cx="-3" cy="2" rx="2.4" ry="4" fill="#FFFFFF" opacity="0.8"/></g>`;
}
// something important: a 4-point star twinkles
function sparkle(t, x, y, size = 1) {
  const u = (t % 0.7) / 0.7, k = Math.sin(Math.PI * u) * size;
  if (k < 0.05) return '';
  return `<g transform="translate(${r1(x)},${r1(y)}) scale(${r1(k * 100) / 100}) rotate(${r1(u * 40)})"><path d="M 0,-24 Q 4,-4 24,0 Q 4,4 0,24 Q -4,4 -24,0 Q -4,-4 0,-24 Z" fill="#FFF6C8" stroke="#E8C25A" stroke-width="2"/></g>`;
}
// shock: a "!" pops up above the head (overshoots, then settles)
function bang(t, head) {
  const s = t < 0.22 ? ease(t / 0.22) * 1.25 : t < 0.34 ? 1.25 - ((t - 0.22) / 0.12) * 0.25 : 1;
  return `<g transform="translate(${r1(head.x + head.r * 0.4)},${r1(head.y - head.r - 46)}) scale(${r1(s * 100) / 100}) rotate(10)">` +
    `<path d="M -9,-44 L 9,-44 L 5,6 L -5,6 Z" fill="#D9443B" stroke="#7A1E18" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="22" r="8" fill="#D9443B" stroke="#7A1E18" stroke-width="3"/></g>`;
}
// an idea: a light bulb pops up above the head and glows
function idea(t, head) {
  const s = t < 0.22 ? ease(t / 0.22) * 1.25 : t < 0.34 ? 1.25 - ((t - 0.22) / 0.12) * 0.25 : 1, x = head.x - head.r * 0.2, y = head.y - head.r - 70;
  let g = `<circle cx="0" cy="0" r="62" fill="#FFF3A6" opacity="${r1(0.35 + 0.15 * Math.sin(t * 9))}"/>`;
  for (let i = 0; i < 8; i++) {
    const a = i * 45 + t * 25;
    g += `<path d="M 0,-52 L 0,-70" transform="rotate(${r1(a)})" stroke="#F2C230" stroke-width="7" stroke-linecap="round"/>`;
  }
  g += `<circle cx="0" cy="-4" r="30" fill="#FFE45C" stroke="#C9971E" stroke-width="3"/><path d="M -9,6 Q 0,-14 9,6" fill="none" stroke="#C9971E" stroke-width="3"/>` +
    `<rect x="-14" y="22" width="28" height="22" rx="5" fill="#9AA3AE" stroke="#5C636B" stroke-width="3"/><ellipse cx="-11" cy="-14" rx="6" ry="9" fill="#FFFFFF" opacity="0.7"/>`;
  return `<g transform="translate(${r1(x)},${r1(y)}) scale(${r1(s * 100) / 100})">${g}</g>`;
}
// something wet hits something hard: red drops fly out from the spot
function splat(t, x, y, col = '#B8263A') {
  if (t < 0 || t > 0.6) return '';
  const u = t / 0.6;
  let s = '';
  for (let i = 0; i < 12; i++) {
    const a = i * 30 + (i % 3) * 9, d = (40 + (i % 4) * 22) * ease(Math.min(1, u * 1.6)), rad = a * Math.PI / 180;
    s += `<circle cx="${r1(x + Math.cos(rad) * d)}" cy="${r1(y + Math.sin(rad) * d + u * u * 30)}" r="${r1((9 - (i % 3) * 2) * (1 - u * 0.6))}" fill="${col}" opacity="${r1((1 - u) * 100) / 100}"/>`;
  }
  return s;
}
// a landing or a stomp: dust puffs at the feet
function dust(t, x, w) {
  const u = Math.min(1, t / 0.5);
  if (u >= 1) return '';
  return [-1, 1].map(side => puff(x + side * (w * 0.6 + u * 40), -8 - u * 14, 0.5 + u * 0.7, 1 - u)).join('');
}
// the big finish: a white flash (screen space) and a camera shake
const flash = t => (t >= 0 && t < 0.45 ? `<rect width="${W}" height="${H}" fill="#FFF8EA" opacity="${r1((1 - t / 0.45) * 0.85 * 100) / 100}"/>` : '');
function shake(t, seed = 1) {
  if (t < 0 || t > 0.6) return [0, 0];
  const k = (1 - t / 0.6) * 16;
  return [Math.sin(t * 61 + seed) * k, Math.cos(t * 47 + seed * 2) * k];
}

module.exports = { MOODS, defs, blurId, skyTint, lightGlow, groundTint, overlay, grade, groundShadow, steam, sweat, sparkle, bang, idea, splat, dust, flash, shake, ease };
