// The SFPD and the wanted system. Crimes add heat; heat is stars. Cruisers spawn at the
// city edges and hunt: they steer for where the player is heading, brake to block, and
// ram. On foot, an officer who corners Rico fills the bust meter. Lose every pair of
// eyes for a while and the heat cools a star at a time.

import { WANTED, WORLD } from './config.js';
import { createCar, driveCar, carSpeed } from './vehicles.js';
import { segmentBlocked } from './world.js';
import { poiById } from './world.js';

export function createWanted() {
  return { heat: 0, stars: 0, unseenT: 0, seenNow: false, bust: 0, flashT: 0, checkT: 0 };
}

export function addHeat(G, amount) {
  const w = G.wanted;
  const before = w.stars;
  w.heat = Math.min(WANTED.maxStars, w.heat + amount);
  w.stars = Math.min(WANTED.maxStars, Math.ceil(w.heat - 0.0001));
  if (w.stars > before) {
    w.flashT = 1.6;
    G.toast(`Wanted level ${w.stars}`, 'bad');
  }
}

export function clearHeat(G) {
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.wanted.bust = 0;
}

function spawnPoint(G) {
  // Cruisers roll in from avenue ends, away from the player's immediate view.
  const edges = [
    { x: 260, y: 40 }, { x: 1460, y: 40 }, { x: 2660, y: 40 },
    { x: 40, y: 820 }, { x: WORLD.width - 40, y: 820 },
    { x: 860, y: WORLD.height - 60 }, { x: 2060, y: WORLD.height - 60 },
  ];
  let best = edges[0];
  let bestD = -1;
  for (const e of edges) {
    const d = Math.hypot(e.x - G.player.x, e.y - G.player.y);
    if (d > 620 && d > bestD) { bestD = d; best = e; }
  }
  return best;
}

export function updatePolice(G, dt) {
  const w = G.wanted;
  const player = G.player;
  const focus = player.car || player;

  // Awareness: any cruiser with line of sight counts as eyes on the player.
  w.checkT -= dt;
  if (w.checkT <= 0) {
    w.checkT = 0.22;
    let seen = false;
    for (const car of G.cars) {
      if (car.driver !== 'police' || car.dead) continue;
      const d = Math.hypot(car.x - focus.x, car.y - focus.y);
      if (d < WANTED.sightRange && !segmentBlocked(G.world, car.x, car.y, focus.x, focus.y)) { seen = true; break; }
    }
    w.seenNow = seen;
  }
  if (w.seenNow) w.unseenT = 0; else w.unseenT += dt;
  if (w.flashT > 0) w.flashT -= dt;

  // Cooling off.
  if (w.stars > 0 && w.unseenT > WANTED.decayDelay) {
    w.heat = Math.max(0, w.heat - WANTED.decayRate * dt);
    w.stars = Math.min(WANTED.maxStars, Math.ceil(w.heat - 0.0001));
    if (w.heat <= 0) clearHeat(G);
  }

  // Desired strength on the street.
  const want = w.stars === 0 ? 0 : Math.min(7, 1 + w.stars);
  let active = 0;
  for (const car of G.cars) if (car.driver === 'police' && !car.dead) active += 1;
  G.spawnCd = (G.spawnCd || 0) - dt;
  if (active < want && G.spawnCd <= 0) {
    G.spawnCd = 1.4;
    const p = spawnPoint(G);
    const car = createCar(p.x, p.y, Math.atan2(focus.y - p.y, focus.x - p.x), 'police', '#f4f6f8', G.rng);
    car.driver = 'police';
    G.cars.push(car);
    active += 1;
  }

  // Pursuit driving.
  for (const car of G.cars) {
    if (car.driver !== 'police') continue;
    if (car.dead) {
      driveCar(car, { throttle: 0, steer: 0, handbrake: false }, dt, 1);
      continue;
    }
    // Aim at where the player will be shortly.
    const lead = 0.45;
    const tx = focus.x + (focus.vx || 0) * lead;
    const ty = focus.y + (focus.vy || 0) * lead;
    const dist = Math.hypot(focus.x - car.x, focus.y - car.y);
    const desired = Math.atan2(ty - car.y, tx - car.x);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.4));
    let throttle = 1;
    if (Math.abs(diff) > 2.2) throttle = -0.7; // turned around: back up and swing
    if (!player.car && dist < 92) throttle = 0.18; // on foot: creep in to make the bust
    if (dist < 40 && player.car) throttle = 0.55;
    const surface = G.surfaceAt(car.x, car.y);
    driveCar(car, { throttle, steer, handbrake: Math.abs(diff) > 1.15 && carSpeed(car) > 260 }, dt, surface === 'sand' ? 0.55 : 1);
    if (w.stars >= 4 && dist < 300) {
      car.honkAt -= dt;
      if (car.honkAt <= 0) { car.honkAt = 1.3; /* siren handled in main via audio */ }
    }
  }

  // Bust pressure on foot: close cruisers + a slow player fill the meter.
  if (!player.car && w.stars > 0 && player.health > 0) {
    let pressure = false;
    for (const car of G.cars) {
      if (car.driver !== 'police' || car.dead) continue;
      if (Math.hypot(car.x - player.x, car.y - player.y) < WANTED.bustRange) { pressure = true; break; }
    }
    const pSpeed = Math.hypot(player.vx, player.vy);
    if (pressure && pSpeed < 120) w.bust = Math.min(1, w.bust + dt / WANTED.bustFill);
    else w.bust = Math.max(0, w.bust - dt * 0.7);
    if (w.bust >= 1) G.busted();
  } else {
    w.bust = Math.max(0, w.bust - dt * 1.4);
  }

  // Retire distant cruisers when the heat is off.
  if (w.stars === 0) {
    for (let i = G.cars.length - 1; i >= 0; i -= 1) {
      const car = G.cars[i];
      if (car.driver === 'police' && Math.hypot(car.x - player.x, car.y - player.y) > 900) G.cars.splice(i, 1);
    }
  }
}

/** Heat added when the player's car rams a cruiser (see config HEAT.carRam). */
export const HEAT_RAM = 0.6;

export function respawnPoint(kind) {
  return kind === 'wasted' ? poiById('hospital').door : poiById('station').door;
}
