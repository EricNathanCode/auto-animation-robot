'use strict';
// Flat paper-cutout backgrounds, 1080 x 1920 (9:16). Characters stand on GROUND.
// Two looks, the same drawing:  'v1' = thick ink outlines (the first test short)
//                               'v2' = the paper preset look: no outlines, a thin paper edge + a few darker paper pieces for shade
const P = require('./puppet');
const P2 = require('./puppet2');
const { line, polygon, pathEl, circle, ellipse, rect } = P;

const W = 1080, H = 1920, GROUND = 1540;

// the pens for each look (piece = a cut-out shape, tube = a thick bent strip)
function kit(style) {
  if (style === 'v2') {
    const E = 1.8; // background paper edge
    return { v2: true, ink: P2.LINE, piece: (shapes, fill) => P2.paper(shapes, fill, E), tube: (d, col, w) => P2.tube(d, col, w, E) };
  }
  return { v2: false, ink: P.INK, piece: P.piece, tube: P.tube };
}

function cloud(K, x, y, s = 1) {
  return K.piece([circle(x - 60 * s, y, 34 * s), circle(x - 15 * s, y - 22 * s, 44 * s), circle(x + 40 * s, y - 6 * s, 38 * s),
    circle(x + 80 * s, y + 8 * s, 26 * s), rect(x - 92 * s, y, 196 * s, 34 * s, 17 * s)], '#FFFFFF', 4);
}

function longship(K, x, y, s = 1) {
  const wood = '#8A5A3B', dark = '#6B4226';
  let g = K.piece(rect(-5, -172, 10, 170, 3), dark, 3.5);
  const sail = 'M -78,-160 Q 0,-172 78,-160 Q 92,-102 78,-46 Q 0,-36 -78,-46 Q -92,-102 -78,-160 Z';
  g += `<clipPath id="sailclip"><path d="${sail}"/></clipPath>`;
  g += K.piece(pathEl(sail), '#FFFFFF', 3.5);
  g += `<g clip-path="url(#sailclip)" fill="#D9443B"><rect x="-100" y="-180" width="40" height="150"/><rect x="-20" y="-180" width="40" height="150"/><rect x="60" y="-180" width="40" height="150"/></g>`;
  g += K.v2 ? `<path d="${sail}" fill="none" stroke="#B3A79C" stroke-width="2.6" stroke-linejoin="round"/>`
    : `<path d="${sail}" fill="none" stroke="${K.ink}" stroke-width="7" stroke-linejoin="round"/>`;
  g += K.tube('M -166,-40 Q -186,-72 -170,-88 Q -158,-94 -160,-80', wood, 11, 3.5);
  g += K.tube('M 166,-40 Q 188,-76 170,-98', wood, 12, 3.5);
  g += K.piece(ellipse(178, -104, 17, 10, -20), wood, 3.5) + `<circle cx="183" cy="-107" r="2.6" fill="${K.ink}"/>`;
  g += K.piece(pathEl('M -170,-46 Q -160,-10 -120,-8 L 120,-8 Q 160,-10 170,-46 Q 175,10 120,28 L -120,28 Q -175,10 -170,-46 Z'), wood);
  g += line('M -150,8 Q 0,22 150,8', 3, '#A8754F');
  const cols = ['#E2B33C', '#D9443B', '#3E6FB0'];
  for (let i = -3; i <= 3; i++) g += K.piece(circle(i * 32, -8, 13), cols[(i + 3) % 3], 3) + `<circle cx="${i * 32}" cy="-8" r="3.5" fill="#B8BFC8"/>`;
  return `<g transform="translate(${x},${y}) scale(${s})">${g}</g>`;
}

function tuft(K, x, y, s = 1, col = '#5E9A40') {
  const pts = [[-16, 0], [-12, -18], [-6, -4], [0, -24], [6, -4], [12, -18], [16, 0]].map(([a, b]) => [x + a * s, y + b * s]);
  return K.piece(polygon(pts), col, 3);
}

// the fjord in 3 depth layers (far: sky + mountains, mid: sea + ship + cliffs, near: the shore we stand on)
function fjordLayers(style = 'v1') {
  const K = kit(style);
  let s = `<rect x="-200" y="-200" width="${W + 400}" height="${H + 400}" fill="#A8DAF0"/>`;
  s += K.piece(circle(860, 820, 70), '#FFE08A', 4);
  s += cloud(K, 210, 560, 1) + cloud(K, 830, 470, 0.9) + cloud(K, 540, 780, 0.7);
  // far mountains with snow
  s += K.piece(polygon([[-60, 1200], [-60, 1010], [60, 960], [150, 1030], [260, 880], [380, 1020], [470, 960], [560, 1060], [650, 920],
    [760, 1030], [860, 900], [980, 1020], [1140, 940], [1140, 1200]]), '#8DB3D3');
  if (K.v2) { // the shady side of each big mountain: one darker paper piece
    for (const [px, py, vx, vy] of [[260, 880, 380, 1020], [650, 920, 760, 1030], [860, 900, 980, 1020]]) {
      s += K.piece(polygon([[px, py], [vx, vy], [vx - 30, 1150], [px + 10, 1150]]), '#7EA5C7');
    }
  }
  for (const [px, py] of [[260, 880], [650, 920], [860, 900]]) {
    s += K.piece(polygon([[px - 34, py + 44], [px, py], [px + 34, py + 44], [px + 16, py + 36], [px + 4, py + 50], [px - 10, py + 38], [px - 22, py + 48]]), '#FFFFFF', 3);
  }
  const far = s;
  // the sea, a longship, the cliffs of the fjord
  s = K.piece(rect(-60, 1150, W + 120, 230), '#3E7CB5');
  s += longship(K, 560, 1252, 0.85);
  for (const [wx, wy] of [[330, 1205], [700, 1215], [470, 1300], [820, 1290], [380, 1330]]) s += line(`M ${wx},${wy} q 15,-10 30,0 t 30,0`, 4, '#7FB3DE');
  s += K.piece(polygon([[-60, 1360], [-60, 1000], [70, 1050], [170, 1120], [250, 1230], [300, 1360]]), '#5B86AE');
  s += K.piece(polygon([[1140, 1360], [1140, 980], [1010, 1040], [900, 1130], [820, 1250], [790, 1360]]), '#5B86AE');
  if (K.v2) { // darker rock at the foot of the cliffs
    s += K.piece(polygon([[-60, 1360], [-60, 1235], [120, 1258], [230, 1300], [300, 1360]]), '#4F7699');
    s += K.piece(polygon([[1140, 1360], [1140, 1228], [960, 1250], [850, 1300], [790, 1360]]), '#4F7699');
  }
  const mid = s;
  // the shore
  s = K.piece(pathEl('M -60,1352 Q 120,1318 300,1340 T 640,1330 T 980,1336 T 1160,1326 L 1160,2120 L -60,2120 Z'), '#7DB65A');
  s += K.piece(pathEl('M -60,1730 Q 260,1700 540,1722 T 1160,1712 L 1160,2120 L -60,2120 Z'), '#6CA54B', 3);
  // rune stone + rocks + grass
  s += K.piece(pathEl('M 958,1524 L 966,1384 Q 990,1322 1040,1330 Q 1082,1350 1084,1402 L 1090,1524 Z'), '#A7AFB8');
  s += line('M 992,1396 L 1002,1436 L 992,1476 M 1016,1380 L 1030,1410 L 1046,1386 M 1022,1452 L 1054,1470 M 1030,1440 L 1030,1500', 5, '#C2453A');
  s += K.piece([ellipse(110, 1470, 46, 26), ellipse(52, 1500, 30, 18)], '#9AA3AE') + K.piece(ellipse(990, 1660, 40, 22), '#9AA3AE');
  for (const [tx, ty, ts] of [[220, 1600, 1], [470, 1650, 0.9], [690, 1588, 1.1], [905, 1700, 1], [140, 1770, 1.2], [610, 1810, 1], [380, 1880, 1.1], [850, 1860, 0.9]]) s += tuft(K, tx, ty, ts);
  // light: where the sun is (for glows + rays), and where the far layers end (y of the shore line)
  return { far, mid, near: s, light: { x: 860, y: 820, kind: 'sun' }, shoreY: 1322 };
}
const fjord = (style = 'v1') => { const L = fjordLayers(style); return L.far + L.mid + L.near; };

// a dining room at night (paper look): far = the city seen through a big, spotless window, near = the room,
// front = the table with a white tablecloth (drawn in front of the characters, so they look seated)
function diningLayers() {
  const K = kit('v2'), x0 = 560, x1 = 940, y0 = 500, y1 = 1110;
  let r = 7;
  const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // far: the night city
  let far = `<defs><linearGradient id="dnSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121936"/><stop offset="0.7" stop-color="#2E3A72"/><stop offset="1" stop-color="#4A4A7E"/></linearGradient></defs>`;
  far += `<rect x="-300" y="-300" width="${W + 600}" height="${H + 600}" fill="url(#dnSky)"/>`;
  for (let i = 0; i < 70; i++) far += `<circle cx="${Math.round(200 + rnd() * 1000)}" cy="${Math.round(300 + rnd() * 560)}" r="${(1.5 + rnd() * 2).toFixed(1)}" fill="#FFF6D8" opacity="${(0.5 + rnd() * 0.5).toFixed(2)}"/>`;
  far += `<circle cx="840" cy="620" r="95" fill="#F4EBD0" opacity="0.12"/>` + K.piece(circle(840, 620, 42), '#F4EBD0');
  for (const [bx, bw, top, col] of [[300, 130, 930, '#1F2950'], [420, 120, 880, '#27325E'], [540, 95, 830, '#1C2547'], [630, 140, 920, '#2A3666'],
    [770, 100, 860, '#222C55'], [870, 130, 950, '#27325E'], [1000, 120, 890, '#1F2950'], [1120, 120, 930, '#2A3666']]) {
    far += K.piece(rect(bx, top, bw, 1400 - top), col);
    for (let wy = top + 24; wy < 1300; wy += 34) for (let wx = bx + 14; wx < bx + bw - 18; wx += 26) if (rnd() < 0.42) far += `<rect x="${wx}" y="${wy}" width="12" height="16" fill="#FFD58C" opacity="0.9"/>`;
  }
  // near: the wall (with a hole for the window), wallpaper stripes, panels, the window, curtains, a picture, the lamp
  const wall = `M -300,-300 H ${W + 300} V ${H + 300} H -300 Z M ${x0},${y0} V ${y1} H ${x1} V ${y0} Z`;
  let near = `<defs><clipPath id="dnWall"><path d="${wall}" clip-rule="evenodd"/></clipPath></defs>`;
  near += `<path d="${wall}" fill="#C9875A" fill-rule="evenodd"/>`;
  near += `<g clip-path="url(#dnWall)" fill="#BB7A4E">`;
  for (let x = -280; x < W + 300; x += 72) near += `<rect x="${x}" y="-300" width="24" height="${H + 600}"/>`;
  near += `</g>` + K.piece(rect(-300, 1180, W + 600, 1200), '#6E4128') + K.piece(rect(-300, 1176, W + 600, 22), '#8A5636');
  const frame = `M ${x0 - 28},${y0 - 28} H ${x1 + 28} V ${y1 + 28} H ${x0 - 28} Z M ${x0},${y0} V ${y1} H ${x1} V ${y0} Z`;
  near += `<path d="${frame}" fill="#B5AA9C" fill-rule="evenodd" transform="translate(4,6)" opacity="0.5"/><path d="${frame}" fill="#F2ECE2" fill-rule="evenodd"/>`;
  near += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#CFE3FF" opacity="0.07"/>`; // the glass: almost invisible
  near += `<polygon points="${x0 + 50},${y0} ${x0 + 120},${y0} ${x0 + 20},${y0 + 260} ${x0},${y0 + 260} ${x0},${y0 + 150}" fill="#FFFFFF" opacity="0.2"/>`;
  near += `<polygon points="${x0 + 150},${y0} ${x0 + 175},${y0} ${x0 + 60},${y0 + 300} ${x0 + 35},${y0 + 300}" fill="#FFFFFF" opacity="0.13"/>`;
  near += K.piece(rect(x0 - 56, y1 + 22, x1 - x0 + 112, 30, 6), '#F2ECE2');
  near += K.piece(rect(x0 - 200, y0 - 104, x1 - x0 + 400, 14, 7), '#5A3A22') + K.piece([circle(x0 - 204, y0 - 97, 13), circle(x1 + 204, y0 - 97, 13)], '#5A3A22');
  for (const s of [-1, 1]) { // curtains, one on each side of the window
    const xa = s < 0 ? x0 - 40 : x1 + 40, xb = s < 0 ? x0 - 190 : x1 + 190, yb = y1 + 190;
    near += K.piece(pathEl(`M ${xa},${y0 - 92} L ${xb},${y0 - 92} L ${xb + s * -10},${yb} Q ${(xa + xb) / 2},${yb + 26} ${xa + s * 14},${yb - 8} Z`), '#7E2433');
    near += line(`M ${xa + s * 40},${y0 - 80} L ${xa + s * 36},${yb - 10} M ${xa + s * 90},${y0 - 80} L ${xa + s * 92},${yb + 4} M ${xa + s * 128},${y0 - 80} L ${xa + s * 134},${yb}`, 5, '#651B28');
  }
  near += K.piece(rect(90, 560, 240, 180, 6), '#8A5A3B') + `<rect x="110" y="580" width="200" height="140" fill="#BFD8E8"/>` +
    K.piece(pathEl('M 110,690 Q 170,640 230,680 T 310,660 L 310,720 L 110,720 Z'), '#7DB65A') + `<circle cx="270" cy="615" r="16" fill="#FFE08A"/>`;
  near += line('M 430,-300 L 430,292', 5, '#3A2A20') + K.piece(pathEl('M 352,384 L 392,290 L 468,290 L 508,384 Q 430,398 352,384 Z'), '#D9A84A') +
    `<path d="M 380,330 L 398,296" stroke="#FFF1C8" stroke-width="6" stroke-linecap="round" opacity="0.7"/><ellipse cx="430" cy="392" rx="30" ry="12" fill="#FFF4C8"/>`;
  // front: the table + candles (in front of the characters)
  let front = K.piece(rect(-300, 1286, W + 600, 1100), '#F1E8D8') + K.piece(rect(-300, 1286, W + 600, 64), '#FBF6EC');
  for (let x = -260; x < W + 300; x += 92) front += line(`M ${x},1372 Q ${x + 8},1600 ${x - 4},1920`, 5, '#E2D6C2');
  for (const cx of [636, 704]) {
    front += K.piece([rect(cx - 22, 1268, 44, 18, 6), rect(cx - 8, 1180, 16, 92)], '#C9A04E') + K.piece(rect(cx - 11, 1100, 22, 86, 4), '#FFF6E0');
    front += `<circle cx="${cx}" cy="1082" r="38" fill="#FFD25A" opacity="0.22"/>` + K.piece(pathEl(`M ${cx},1060 Q ${cx + 12},1084 ${cx},1096 Q ${cx - 12},1084 ${cx},1060 Z`), '#FFC23A');
  }
  return { far, mid: '', near, front, light: { x: 430, y: 410, kind: 'lamp', layer: 'near' }, shoreY: 1286, spots: { window: [750, 830] } };
}

// a small town street: a house with a fence, a mailbox and a tall water tower. "top" lets the camera go up into
// the sky above the picture (for characters who float), so the sky, clouds and the tower's top go up to y = -700.
function townLayers() {
  const K = kit('v2');
  // far: sky, clouds, the sun, two rows of hills
  let far = `<defs><linearGradient id="tnSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8CC8EE"/><stop offset="0.55" stop-color="#C4E6F6"/><stop offset="1" stop-color="#F6F0D8"/></linearGradient></defs>`;
  far += `<rect x="-400" y="-1600" width="${W + 800}" height="${H + 2000}" fill="url(#tnSky)"/>`;
  far += K.piece(circle(600, 900, 64), '#FFF1C4');
  for (const [x, y, s] of [[170, 300, 1.1], [860, 140, 0.9], [420, -240, 1.2], [930, -430, 1], [140, -560, 0.85], [720, 560, 0.7], [300, -900, 1]]) far += cloud(K, x, y, s);
  far += K.piece([ellipse(140, 1130, 380, 140), ellipse(700, 1100, 420, 160), ellipse(1160, 1140, 360, 130), rect(-400, 1120, W + 800, 900)], '#A9C9A2');
  far += K.piece([ellipse(-60, 1210, 360, 120), ellipse(520, 1195, 420, 130), ellipse(1060, 1220, 380, 120), rect(-400, 1200, W + 800, 900)], '#93BF83');
  // mid: a row of little houses and trees far down the street
  let mid = K.piece(rect(-500, 1300, W + 1000, 1200), '#8FBF78');
  const homes = [[-220, 150, '#D8A47F', '#8E5E4A'], [-40, 120, '#C9B49A', '#6E7E96'], [130, 170, '#A9B8C9', '#7B5B6E'], [330, 130, '#E2C28E', '#8E5E4A'],
    [520, 160, '#C9A3A0', '#5E6E86'], [720, 125, '#B9C9A8', '#8E5E4A'], [900, 165, '#D8B48F', '#6E7E96'], [1090, 135, '#A9B8C9', '#7B5B6E']];
  homes.forEach(([x, h, wall, roof], i) => {
    mid += K.piece(rect(x, 1310 - h, 140, h), wall) + K.piece(polygon([[x - 14, 1312 - h], [x + 70, 1250 - h], [x + 154, 1312 - h]]), roof);
    mid += `<rect x="${x + 28}" y="${1340 - h}" width="26" height="30" fill="#FFF4D0" opacity="0.8"/><rect x="${x + 86}" y="${1340 - h}" width="26" height="30" fill="#FFF4D0" opacity="0.8"/>`;
    if (i % 2) mid += K.piece([circle(x + 160, 1236, 40), circle(x + 186, 1262, 34), rect(x + 156, 1260, 10, 52)], '#6FA35A');
  });
  // near: lawn, the house, bushes, the fence, the mailbox, the water tower, the sidewalk and the street
  let near = K.piece(rect(-400, 1380, W + 800, 140), '#8CC56B');
  for (let x = -380; x < W + 400; x += 120) near += `<rect x="${x}" y="1380" width="60" height="140" fill="#9ACF78" opacity="0.5"/>`;
  near += K.piece([rect(420, 640, 60, 170), rect(410, 628, 80, 20, 4)], '#A8533F'); // chimney (behind the roof)
  near += K.piece(rect(20, 880, 540, 500), '#F2D7A6');
  for (let y = 908; y < 1380; y += 28) near += line(`M 22,${y} L 558,${y}`, 2, '#E3C48E');
  near += K.piece(polygon([[-24, 892], [290, 586], [604, 892]]), '#B9534A');
  for (let y = 650; y < 890; y += 44) { const dx = (y - 586) * (314 / 306); near += line(`M ${Math.round(290 - dx + 12)},${y} L ${Math.round(290 + dx - 12)},${y}`, 3, '#A3463F'); }
  near += K.piece(rect(-28, 880, 636, 18, 6), '#8E3B35');
  near += K.piece(circle(290, 790, 40), '#FFFFFF') + `<circle cx="290" cy="790" r="28" fill="#A9D6F0"/>` + line('M 262,790 L 318,790 M 290,762 L 290,818', 4, '#FFFFFF');
  const win = (x, y, w, h) => K.piece(rect(x - 30, y + 6, 26, h - 12, 3), '#5B7FB8') + K.piece(rect(x + w + 4, y + 6, 26, h - 12, 3), '#5B7FB8') +
    K.piece(rect(x - 8, y - 8, w + 16, h + 16, 4), '#FFFFFF') + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#A9D6F0"/>` +
    `<polygon points="${x + 14},${y} ${x + 50},${y} ${x},${y + 56} ${x},${y + 22}" fill="#FFFFFF" opacity="0.35"/>` + line(`M ${x + w / 2},${y} L ${x + w / 2},${y + h} M ${x},${y + h / 2} L ${x + w},${y + h / 2}`, 6, '#FFFFFF');
  near += win(100, 950, 120, 120) + win(360, 950, 120, 120) + win(100, 1180, 120, 120);
  near += K.piece(rect(352, 1140, 116, 240, 6), '#FFFFFF') + K.piece(rect(362, 1150, 96, 230, 4), '#5B7FB8') + `<circle cx="444" cy="1270" r="7" fill="#F2C14E"/>`;
  near += K.piece([circle(70, 1370, 44), circle(150, 1364, 52), circle(250, 1372, 40), circle(520, 1368, 46), circle(590, 1374, 38)], '#6FA35A');
  // the water tower ("UPTON"), its legs standing on the lawn on the right
  for (const [x0, x1] of [[820, 806], [920, 934]]) near += K.tube(`M ${x0},300 L ${x1},1400`, '#8C97A6', 14);
  near += K.tube('M 760,300 L 716,1400', '#A3AEBC', 18) + K.tube('M 980,300 L 1024,1400', '#A3AEBC', 18);
  for (const [ya, yb] of [[420, 760], [760, 1080], [1080, 1390]]) {
    const xa = 760 - (ya - 300) * 0.04, xb = 980 + (ya - 300) * 0.04, xc = 760 - (yb - 300) * 0.04, xd = 980 + (yb - 300) * 0.04;
    near += K.tube(`M ${Math.round(xa)},${ya} L ${Math.round(xd)},${yb} M ${Math.round(xb)},${ya} L ${Math.round(xc)},${yb}`, '#8C97A6', 8);
  }
  near += K.piece(polygon([[690, 26], [1050, 26], [870, -112]]), '#8FA9BC') + K.piece(circle(870, -118, 13), '#6E7A89');
  near += K.piece(rect(700, 20, 340, 290, 34), '#A8C3D6');
  for (const x of [760, 820, 920, 980]) near += line(`M ${x},34 L ${x},296`, 3, '#93AFC3');
  near += `<text x="870" y="196" text-anchor="middle" font-size="72" font-weight="700" letter-spacing="6" fill="#FFFFFF">UPTON</text>`;
  near += K.piece(rect(676, 254, 388, 8, 3), '#6E7A89');
  for (let x = 684; x <= 1056; x += 41) near += `<rect x="${x}" y="256" width="5" height="40" fill="#6E7A89"/>`;
  near += K.piece(rect(668, 292, 404, 14, 4), '#5E6977');
  // the fence (one taller post at x 150 to tie things to), then the mailbox
  let fence = '';
  for (let x = -40; x < 700; x += 46) fence += polygon([[x, 1316], [x + 15, 1298], [x + 30, 1316], [x + 30, 1440], [x, 1440]]);
  near += K.piece([rect(-60, 1340, 780, 14), rect(-60, 1400, 780, 14)], '#E4DDD0') + K.piece(fence, '#FBF7EE');
  near += K.piece([rect(140, 1262, 22, 182, 4), circle(151, 1258, 15)], '#FBF7EE');
  near += K.piece(rect(292, 1290, 16, 200), '#8A5A3B') + K.piece(pathEl('M 246,1290 L 246,1240 Q 246,1206 300,1206 Q 354,1206 354,1240 L 354,1290 Z'), '#3E6FB0');
  near += K.piece([rect(354, 1218, 10, 54), rect(354, 1218, 34, 20)], '#D9443B');
  near += K.piece(rect(-400, 1480, W + 800, 136), '#DCD3C3');
  for (let x = -320; x < W + 400; x += 160) near += line(`M ${x},1482 L ${x - 30},1612`, 3, '#C7BDAA');
  near += K.piece(rect(-400, 1612, W + 800, 22), '#BDB3A3') + K.piece(rect(-400, 1634, W + 800, 700), '#6E6A70');
  for (let x = -360; x < W + 400; x += 220) near += `<rect x="${x}" y="1784" width="120" height="14" rx="7" fill="#E9E2C8" opacity="0.85"/>`;
  return {
    far, mid, near, light: { x: 600, y: 900, kind: 'sun' }, shoreY: 1380, top: -700,
    spots: { tower: [870, 200, 1.35], ladder: [890, 960, 1.2], fence: [250, 1060, 1.45], mailbox: [300, 1260, 1.6], window: [420, 1010, 1.6], roof: [380, 830, 1.4], sky: [560, 320, 1.08] },
  };
}

const SCENES = { fjord, dining: () => { const L = diningLayers(); return L.far + L.near + L.front; }, town: () => { const L = townLayers(); return L.far + L.mid + L.near; } };
const LAYERS = { fjord: fjordLayers, dining: diningLayers, town: townLayers };

module.exports = { SCENES, LAYERS, W, H, GROUND };
