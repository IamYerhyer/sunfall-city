// Traffic: the cars that make Sunfall feel lived in. Parked cars line the curbs waiting
// to be borrowed; moving cars follow right-hand lanes, choose turns at intersections,
// brake for whatever is ahead, and panic when the shooting starts. A driver whose car
// is taken bails out and runs (that part lives in pedestrians.js).

import { ROADS_X, ROADS_Y, ROAD_W, LANE_OFF, WORLD } from './config.js';
import { createCar, carSpeed } from './vehicles.js';
import { pick, range, chance } from './random.js';

const DIRS = [
  { x: 1, y: 0 },   // east
  { x: 0, y: 1 },   // south
  { x: -1, y: 0 },  // west
  { x: 0, y: -1 },  // north
];

const KINDS = ['sedan', 'sedan', 'sedan', 'sport', 'pickup', 'luxury'];

export function lanePoint(dirIndex, along, cross) {
  // `cross` is the centre line of the cross road; the lane sits LANE_OFF to the right.
  if (dirIndex === 0) return { x: along, y: cross + LANE_OFF };
  if (dirIndex === 2) return { x: along, y: cross - LANE_OFF };
  if (dirIndex === 1) return { x: cross - LANE_OFF, y: along };
  return { x: cross + LANE_OFF, y: along };
}

function nearestCross(list, v) {
  let best = list[0];
  for (const c of list) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return best;
}

export function spawnTrafficCar(G, rng, anywhere) {
  const horizontal = chance(rng, 0.5);
  const dirIndex = horizontal ? (chance(rng, 0.5) ? 0 : 2) : (chance(rng, 0.5) ? 1 : 3);
  const cross = horizontal ? pick(rng, ROADS_Y) : pick(rng, ROADS_X);
  const along = anywhere ? range(rng, 80, WORLD.width - 80) : range(rng, 60, 300);
  const p = lanePoint(dirIndex, along, cross);
  const car = createCar(p.x, p.y, Math.atan2(DIRS[dirIndex].y, DIRS[dirIndex].x), pick(rng, KINDS), null, rng);
  car.driver = 'traffic';
  car.traffic = {
    dir: dirIndex,
    cross,
    speed: range(rng, 190, 275),
    decidedAt: null,
    panic: 0,
  };
  return car;
}

export function initTraffic(G, rng) {
  // Parked cars along curbs, nose to the kerb.
  const parkedSpots = [];
  for (const ry of ROADS_Y) {
    for (let x = 120; x < WORLD.width - 120; x += 118) {
      if (ROADS_X.some((rx) => Math.abs(x - rx) < ROAD_W)) continue;
      parkedSpots.push({ x: x + range(rng, -8, 8), y: ry - ROAD_W / 2 - 26, angle: 0 });
      parkedSpots.push({ x: x + range(rng, -8, 8), y: ry + ROAD_W / 2 + 26, angle: Math.PI });
    }
  }
  for (let i = 0; i < 26 && parkedSpots.length; i += 1) {
    const spot = parkedSpots.splice(Math.floor(rng() * parkedSpots.length), 1)[0];
    const car = createCar(spot.x, spot.y, spot.angle, pick(rng, KINDS), null, rng);
    car.driver = null;
    G.cars.push(car);
  }
  for (let i = 0; i < 17; i += 1) G.cars.push(spawnTrafficCar(G, rng, true));
}

/** The nearest intersection centre to a point, or null when far from all of them. */
function nearIntersection(x, y) {
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      if (Math.abs(x - rx) < 66 && Math.abs(y - ry) < 66) return { x: rx, y: ry };
    }
  }
  return null;
}

export function updateTraffic(G, dt) {
  const rng = G.rng;
  let moving = 0;
  for (const car of G.cars) {
    if (car.driver !== 'traffic' || !car.traffic) continue;
    moving += 1;
    const tr = car.traffic;
    if (tr.panic > 0) tr.panic -= dt;

    // Where the lane wants us to be.
    const along = tr.dir === 0 || tr.dir === 2 ? car.x : car.y;
    const lane = lanePoint(tr.dir, along, tr.cross);
    const d = DIRS[tr.dir];

    // Decide turns once per intersection.
    const inter = nearIntersection(car.x, car.y);
    if (inter && tr.decidedAt !== `${inter.x},${inter.y}`) {
      tr.decidedAt = `${inter.x},${inter.y}`;
      const roll = rng();
      if (roll < 0.34) {
        // Turn left or right: the cross road becomes the new along-road.
        const left = roll < 0.17;
        const nd = (tr.dir + (left ? 3 : 1)) % 4;
        tr.cross = tr.dir === 0 || tr.dir === 2 ? inter.x : inter.y;
        tr.dir = nd;
      }
    }
    if (!inter) tr.decidedAt = tr.decidedAt; // keep memory until we leave

    // Obstacle scan ahead.
    let blocked = false;
    const aheadX = car.x + d.x * 62;
    const aheadY = car.y + d.y * 62;
    for (const other of G.cars) {
      if (other === car) continue;
      const dx = other.x - aheadX;
      const dy = other.y - aheadY;
      if (dx * dx + dy * dy < 40 * 40) { blocked = true; break; }
    }
    if (!blocked) {
      const px = G.player.x - aheadX;
      const py = G.player.y - aheadY;
      if (!G.player.car && px * px + py * py < 34 * 34) blocked = true;
      for (const ped of G.peds) {
        if (ped.down) continue;
        const ex = ped.x - aheadX;
        const ey = ped.y - aheadY;
        if (ex * ex + ey * ey < 34 * 34) { blocked = true; break; }
      }
    }

    const panicBoost = tr.panic > 0 ? 1.5 : 1;
    const targetSpeed = blocked ? 0 : tr.speed * panicBoost;
    const cur = carSpeed(car);
    const accel = targetSpeed > cur ? 240 : 620;
    const newSpeed = cur + Math.sign(targetSpeed - cur) * Math.min(Math.abs(targetSpeed - cur), accel * dt);

    // Steer toward the lane line while travelling in the current direction.
    const steerTarget = Math.atan2(d.y, d.x);
    let diff = steerTarget - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += diff * Math.min(1, 5 * dt);
    // Lateral drift toward the lane centre.
    const latErr = tr.dir === 0 || tr.dir === 2 ? lane.y - car.y : lane.x - car.x;
    const latFix = Math.max(-46, Math.min(46, latErr)) * dt;
    if (tr.dir === 0 || tr.dir === 2) car.y += latFix; else car.x += latFix;

    car.vx = Math.cos(car.angle) * newSpeed;
    car.vy = Math.sin(car.angle) * newSpeed;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.steerVis = diff;

    // Recycle cars that leave the city or jam for good.
    if (car.x < -80 || car.x > WORLD.width + 80 || car.y < -80 || car.y > WORLD.height + 80) {
      Object.assign(car, spawnTrafficCar(G, rng, false));
    }
    if (newSpeed < 4 && !blocked) tr.stuckT = (tr.stuckT || 0) + dt; else tr.stuckT = 0;
    if (tr.stuckT > 7) Object.assign(car, spawnTrafficCar(G, rng, false));
  }
  // Keep the streets full.
  if (moving < 15 && chance(rng, 0.02)) G.cars.push(spawnTrafficCar(G, rng, false));
}

export function nearestCrossRoad(value, horizontal) {
  return nearestCross(horizontal ? ROADS_Y : ROADS_X, value);
}
