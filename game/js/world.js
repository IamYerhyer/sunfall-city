// The city of Sunfall: a pastel coastal grid built once from a seed — avenues, blocks of
// buildings with lit windows and rooftop clutter, parks, palms, lamps, the beach and the
// pier, and the named places Rico's story runs through. Also answers the physical
// questions the rest of the game asks: what surface is this, what does a circle hit,
// and can these two points see each other.

import { WORLD, ROADS_X, ROADS_Y, ROAD_W, SAND_Y, WATER_Y, PIER, BUILDING_COLORS } from './config.js';
import { range, rangeInt, pick, chance } from './random.js';

export const POIS = [
  { id: 'club', name: 'Club Azul', sub: 'Marina Voss’s nightclub', x: 1160, y: 530, door: { x: 1160, y: 622 }, color: '#3dc1d3' },
  { id: 'chop', name: 'Marlo’s Chop Shop', sub: 'Cars in, cash out', x: 2360, y: 1110, door: { x: 2360, y: 1202 }, color: '#f39c12' },
  { id: 'hideout', name: 'Harbour Hideout', sub: 'Rico’s safehouse', x: 560, y: 1690, door: { x: 560, y: 1782 }, color: '#2ecc71' },
  { id: 'pier', name: 'Sunfall Pier', sub: 'End of the boardwalk', x: 1460, y: 2338, door: { x: 1460, y: 2338 }, color: '#fd79a8' },
  { id: 'hospital', name: 'Sunfall General', sub: 'Hospital', x: 1160, y: 99, door: { x: 1160, y: 170 }, color: '#ecf0f1' },
  { id: 'station', name: 'SFPD HQ', sub: 'Sunfall Police', x: 2360, y: 530, door: { x: 2360, y: 622 }, color: '#3498db' },
];

export function poiById(id) {
  return POIS.find((p) => p.id === id);
}

// Hand-placed spots for the twelve hidden cash bags: alleys, rooftops' shadows, the
// park, the pier end — worth hunting on foot.
export const BAG_SPOTS = [
  { x: 620, y: 480 }, { x: 1180, y: 1120 }, { x: 1780, y: 560 }, { x: 2380, y: 960 },
  { x: 2920, y: 420 }, { x: 700, y: 1700 }, { x: 1460, y: 2380 }, { x: 2330, y: 1760 },
  { x: 2960, y: 1620 }, { x: 520, y: 2240 }, { x: 1080, y: 2050 }, { x: 2620, y: 2260 },
];

const BLOCK_X = [[28, 190], [330, 790], [930, 1390], [1530, 1990], [2130, 2590], [2730, 3172]];
const BLOCK_Y = [[28, 170], [310, 750], [890, 1330], [1470, 1910], [2050, 2140]];
const PARK_BLOCKS = new Set(['3,1', '5,2', '0,3']);

export function buildWorld(rng) {
  const buildings = [];
  const palms = [];
  const lamps = [];
  const parks = [];

  // Named places get their own buildings first; generic blocks grow around them.
  const poiBuildings = POIS.filter((p) => p.id !== 'pier').map((p) => {
    const b = {
      x: p.x - 74, y: p.y - 56, w: 148, h: 112,
      color: '#e8e2d4', roof: '#cfc7b4', poi: p.id, windows: [], props: [],
    };
    for (let wx = 0; wx < 5; wx += 1) {
      for (let wy = 0; wy < 3; wy += 1) {
        b.windows.push({ dx: 12 + wx * 26, dy: 12 + wy * 32, lit: chance(rng, 0.55) });
      }
    }
    b.props.push({ dx: 96, dy: 66, w: 30, h: 20, tank: true });
    return b;
  });
  buildings.push(...poiBuildings);

  for (let bx = 0; bx < BLOCK_X.length; bx += 1) {
    for (let by = 0; by < BLOCK_Y.length; by += 1) {
      const [x0, x1] = BLOCK_X[bx];
      const [y0, y1] = BLOCK_Y[by];
      if (PARK_BLOCKS.has(`${bx},${by}`)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const cols = rangeInt(rng, 1, 2);
      const rows = rangeInt(rng, 1, 2);
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const inset = range(rng, 12, 22);
          const b = {
            x: x0 + cx * cw + inset,
            y: y0 + cy * ch + inset,
            w: cw - inset * 2,
            h: ch - inset * 2,
            color: pick(rng, BUILDING_COLORS),
            roof: '',
            poi: null,
            windows: [],
            props: [],
          };
          if (b.w < 46 || b.h < 40) continue;
          b.roof = shade(b.color, -30);
          const wcols = Math.max(2, Math.floor(b.w / 26));
          const wrows = Math.max(1, Math.floor(b.h / 34));
          for (let wx = 0; wx < wcols; wx += 1) {
            for (let wy = 0; wy < wrows; wy += 1) {
              b.windows.push({ dx: 10 + wx * ((b.w - 20) / wcols), dy: 10 + wy * ((b.h - 20) / wrows), lit: chance(rng, 0.42) });
            }
          }
          const propCount = rangeInt(rng, 1, 3);
          for (let i = 0; i < propCount; i += 1) {
            b.props.push({ dx: range(rng, 12, b.w - 34), dy: range(rng, 10, b.h - 26), w: range(rng, 14, 26), h: range(rng, 10, 18), tank: chance(rng, 0.22) });
          }
          if (!poiBuildings.some((pb) => overlap(b, pb, 8))) buildings.push(b);
        }
      }
    }
  }

  // Palms line the beach and dot the parks and sidewalks.
  for (let x = 60; x < WORLD.width - 40; x += range(rng, 80, 130)) {
    palms.push({ x: x + range(rng, -14, 14), y: SAND_Y + range(rng, 14, 58), s: range(rng, 0.85, 1.25) });
  }
  for (const park of parks) {
    for (let i = 0; i < 9; i += 1) palms.push({ x: range(rng, park.x + 20, park.x + park.w - 20), y: range(rng, park.y + 20, park.y + park.h - 20), s: range(rng, 0.8, 1.2) });
  }
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      lamps.push({ x: rx - ROAD_W / 2 - 10, y: ry - ROAD_W / 2 - 10 });
      lamps.push({ x: rx + ROAD_W / 2 + 10, y: ry + ROAD_W / 2 + 10 });
    }
  }

  const sandSpecks = [];
  for (let i = 0; i < 260; i += 1) sandSpecks.push({ x: range(rng, 0, WORLD.width), y: range(rng, SAND_Y + 6, WATER_Y - 4) });

  return { buildings, palms, lamps, parks, sandSpecks };
}

function overlap(a, b, pad) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function surfaceAt(x, y) {
  if (x >= PIER.x && x <= PIER.x + PIER.w && y >= PIER.y0 && y <= PIER.y1) return 'pier';
  if (y >= WATER_Y) return 'water';
  if (y >= SAND_Y) return 'sand';
  if (isOnRoad(x, y)) return 'road';
  return 'ground';
}

/** Push a circle (pos with x/y, radius r) out of every building and the water. Mutates pos. */
export function collideCircle(world, pos, r) {
  pos.x = Math.min(WORLD.width - r, Math.max(r, pos.x));
  pos.y = Math.min(WORLD.height - r, Math.max(r, pos.y));
  for (const b of world.buildings) {
    const nx = Math.min(b.x + b.w, Math.max(b.x, pos.x));
    const ny = Math.min(b.y + b.h, Math.max(b.y, pos.y));
    const dx = pos.x - nx;
    const dy = pos.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * r;
        pos.y = ny + (dy / d) * r;
      } else {
        // Centre inside the rect: leave by the shortest side.
        const left = pos.x - b.x;
        const right = b.x + b.w - pos.x;
        const top = pos.y - b.y;
        const bottom = b.y + b.h - pos.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) pos.x = b.x - r;
        else if (m === right) pos.x = b.x + b.w + r;
        else if (m === top) pos.y = b.y - r;
        else pos.y = b.y + b.h + r;
      }
    }
  }
  const onPier = pos.x >= PIER.x - r && pos.x <= PIER.x + PIER.w + r && pos.y >= PIER.y0;
  if (pos.y > WATER_Y - r && !onPier) pos.y = WATER_Y - r;
}

/** True when the straight line between two points crosses any building. */
export function segmentBlocked(world, x1, y1, x2, y2) {
  for (const b of world.buildings) {
    if (segmentRect(x1, y1, x2, y2, b.x + 3, b.y + 3, b.w - 6, b.h - 6)) return true;
  }
  return false;
}

function segmentRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rx || x1 > rx + rw) return false;
  } else {
    let t1 = (rx - x1) / dx;
    let t2 = (rx + rw - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < ry || y1 > ry + rh) return false;
  } else {
    let t1 = (ry - y1) / dy;
    let t2 = (ry + rh - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// ---------------------------------------------------------------- drawing

export function drawWorld(ctx, world, view, t) {
  // Base ground: warm concrete with a sun tint.
  ctx.fillStyle = '#a79c86';
  ctx.fillRect(view.x, view.y, view.w, view.h);

  // Parks.
  ctx.fillStyle = '#79a86b';
  for (const park of world.parks) {
    if (!visible(park, view)) continue;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#8fb87e';
    ctx.fillRect(park.x + 14, park.y + 14, park.w - 28, park.h - 28);
    ctx.fillStyle = '#79a86b';
  }

  // Beach sand and animated water.
  ctx.fillStyle = '#eed49e';
  ctx.fillRect(0, SAND_Y, WORLD.width, WATER_Y - SAND_Y);
  ctx.fillStyle = 'rgba(190,160,100,0.5)';
  for (const s of world.sandSpecks) ctx.fillRect(s.x, s.y, 3, 2);
  const grad = ctx.createLinearGradient(0, WATER_Y, 0, WORLD.height);
  grad.addColorStop(0, '#3d9dbd');
  grad.addColorStop(1, '#1f6f96');
  ctx.fillStyle = grad;
  ctx.fillRect(0, WATER_Y, WORLD.width, WORLD.height - WATER_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= WORLD.width; x += 90) {
    const y = WATER_Y + 12 + Math.sin(t * 1.4 + x * 0.02) * 4;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 46, y);
    const y2 = WATER_Y + 52 + Math.sin(t * 1.1 + x * 0.017 + 2) * 5;
    ctx.moveTo(x + 30, y2);
    ctx.lineTo(x + 84, y2);
  }
  ctx.stroke();
  // Foam line where the sea meets the sand.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  for (let x = 0; x <= WORLD.width; x += 40) {
    const y = WATER_Y + Math.sin(t * 2 + x * 0.03) * 3;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // The pier: planks over the water.
  ctx.fillStyle = '#9a6b44';
  ctx.fillRect(PIER.x, PIER.y0, PIER.w, PIER.y1 - PIER.y0);
  ctx.strokeStyle = 'rgba(60,35,15,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = PIER.y0 + 14; y < PIER.y1; y += 18) { ctx.moveTo(PIER.x, y); ctx.lineTo(PIER.x + PIER.w, y); }
  ctx.stroke();
  ctx.fillStyle = '#6e4a2c';
  for (let y = PIER.y0 + 8; y < PIER.y1; y += 44) { ctx.fillRect(PIER.x - 5, y, 8, 10); ctx.fillRect(PIER.x + PIER.w - 3, y, 8, 10); }

  drawRoads(ctx, view, t);

  // Buildings: shadow, body, roof, lit windows, rooftop clutter.
  for (const b of world.buildings) {
    if (!visible(b, view)) continue;
    ctx.fillStyle = 'rgba(30,25,20,0.22)';
    ctx.fillRect(b.x + 12, b.y + 16, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(60,45,30,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    for (const prop of b.props) {
      ctx.fillStyle = prop.tank ? '#8a97a5' : 'rgba(90,90,90,0.35)';
      if (prop.tank) {
        ctx.beginPath();
        ctx.arc(b.x + prop.dx + 9, b.y + prop.dy + 9, 10, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(b.x + prop.dx, b.y + prop.dy, prop.w, prop.h);
      }
    }
    for (const win of b.windows) {
      ctx.fillStyle = win.lit ? 'rgba(255,214,120,0.95)' : 'rgba(70,90,110,0.5)';
      ctx.fillRect(b.x + win.dx, b.y + win.dy, 9, 7);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(b.x, b.y + b.h - 9, b.w, 9);
  }

  // Palms and lamps.
  for (const palm of world.palms) {
    if (palm.x < view.x - 60 || palm.x > view.x + view.w + 60 || palm.y < view.y - 60 || palm.y > view.y + view.h + 60) continue;
    drawPalm(ctx, palm, t);
  }
  ctx.fillStyle = '#5d6670';
  for (const lamp of world.lamps) {
    if (lamp.x < view.x - 20 || lamp.x > view.x + view.w + 20 || lamp.y < view.y - 20 || lamp.y > view.y + view.h + 20) continue;
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    ctx.fillStyle = 'rgba(255,240,180,0.85)';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d6670';
  }

  drawPoiSigns(ctx, view, t);
}

function visible(r, view) {
  return r.x < view.x + view.w && r.x + r.w > view.x && r.y < view.y + view.h && r.y + r.h > view.y;
}

function drawRoads(ctx, view, t) {
  ctx.fillStyle = '#41464e';
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
  // Edge lines.
  ctx.strokeStyle = 'rgba(240,240,230,0.65)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const rx of ROADS_X) {
    ctx.moveTo(rx - ROAD_W / 2 + 4, 0); ctx.lineTo(rx - ROAD_W / 2 + 4, WORLD.height);
    ctx.moveTo(rx + ROAD_W / 2 - 4, 0); ctx.lineTo(rx + ROAD_W / 2 - 4, WORLD.height);
  }
  for (const ry of ROADS_Y) {
    ctx.moveTo(0, ry - ROAD_W / 2 + 4); ctx.lineTo(WORLD.width, ry - ROAD_W / 2 + 4);
    ctx.moveTo(0, ry + ROAD_W / 2 - 4); ctx.lineTo(WORLD.width, ry + ROAD_W / 2 - 4);
  }
  ctx.stroke();
  // Centre dashes, broken at intersections.
  ctx.strokeStyle = '#f7d774';
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const rx of ROADS_X) { ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD.height); }
  for (const ry of ROADS_Y) { ctx.moveTo(0, ry); ctx.lineTo(WORLD.width, ry); }
  ctx.stroke();
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(245,245,240,0.75)';
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(rx - ROAD_W / 2 - 16, ry + i * 22 - 6, 12, 12);
        ctx.fillRect(rx + ROAD_W / 2 + 4, ry + i * 22 - 6, 12, 12);
        ctx.fillRect(rx + i * 22 - 6, ry - ROAD_W / 2 - 16, 12, 12);
        ctx.fillRect(rx + i * 22 - 6, ry + ROAD_W / 2 + 4, 12, 12);
      }
    }
  }
}

function drawPalm(ctx, palm, t) {
  const sway = Math.sin(t * 1.3 + palm.x * 0.05) * 3;
  ctx.strokeStyle = '#7a5a36';
  ctx.lineWidth = 5 * palm.s;
  ctx.beginPath();
  ctx.moveTo(palm.x, palm.y);
  ctx.quadraticCurveTo(palm.x + 4, palm.y - 16 * palm.s, palm.x + sway, palm.y - 30 * palm.s);
  ctx.stroke();
  ctx.strokeStyle = '#3e9e4f';
  ctx.lineWidth = 3.4 * palm.s;
  const topX = palm.x + sway;
  const topY = palm.y - 30 * palm.s;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + palm.x;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * 14 * palm.s, topY + Math.sin(a) * 8 * palm.s - 5, topX + Math.cos(a) * 24 * palm.s, topY + Math.sin(a) * 13 * palm.s + 4);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(30,25,20,0.18)';
  ctx.beginPath();
  ctx.ellipse(palm.x, palm.y + 3, 12 * palm.s, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPoiSigns(ctx, view, t) {
  for (const poi of POIS) {
    if (poi.x < view.x - 160 || poi.x > view.x + view.w + 160 || poi.y < view.y - 120 || poi.y > view.y + view.h + 60) continue;
    const w = Math.max(118, poi.name.length * 10.5);
    const x = poi.x - w / 2;
    const y = poi.y - 118;
    ctx.fillStyle = '#20242c';
    ctx.fillRect(x - 3, y - 26, w + 6, 34);
    ctx.strokeStyle = poi.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 3, y - 26, w + 6, 34);
    ctx.font = 'bold 17px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = poi.color;
    ctx.shadowBlur = 9 + Math.sin(t * 3 + poi.x) * 3;
    ctx.fillStyle = poi.color;
    ctx.fillText(poi.name.toUpperCase(), poi.x, y - 9);
    ctx.shadowBlur = 0;
    // Door marker post.
    ctx.fillStyle = poi.color;
    ctx.beginPath();
    ctx.arc(poi.door.x, poi.door.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(poi.door.x, poi.door.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A tall pillar of light at a mission target so it reads from streets away. */
export function drawBeacon(ctx, x, y, t, color) {
  const pulse = 0.55 + Math.sin(t * 4) * 0.2;
  const grad = ctx.createLinearGradient(0, y - 340, 0, y);
  grad.addColorStop(0, 'rgba(255,215,64,0)');
  grad.addColorStop(1, `rgba(255,215,64,${pulse})`);
  ctx.fillStyle = color || grad;
  if (!color) ctx.fillStyle = grad;
  ctx.fillRect(x - 13, y - 340, 26, 340);
  ctx.fillStyle = 'rgba(255,215,64,0.85)';
  ctx.beginPath();
  ctx.ellipse(x, y, 30 + Math.sin(t * 4) * 5, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,80,0,0.9)';
  ctx.beginPath();
  ctx.ellipse(x, y, 15, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
}
