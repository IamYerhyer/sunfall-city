// Pedestrians: Sunfall's strollers. They wander between waypoints on the pavements and
// in the parks, chat in pairs, and run screaming (silently — this is a canvas) when a
// car mounts the kerb or the shooting starts. Drivers whose cars are stolen bail out
// through spawnBailedDriver and run for it.

import { WORLD, PED_COLORS, SKIN_TONES } from './config.js';
import { pick, range } from './random.js';
import { collideCircle } from './world.js';

let nextPedId = 1;

export function createPed(x, y, rng, opts) {
  const o = opts || {};
  return {
    id: nextPedId++,
    x, y,
    vx: 0, vy: 0,
    tx: x, ty: y,
    speed: range(rng, 52, 86),
    color: o.color || pick(rng, PED_COLORS),
    skin: pick(rng, SKIN_TONES),
    phase: range(rng, 0, Math.PI * 2),
    fleeT: 0,
    fleeX: 0, fleeY: 0,
    down: false,
    downT: 0,
    thug: !!o.thug,
    hp: o.thug ? 60 : 20,
    shootCd: range(rng, 0.6, 1.4),
    waitT: 0,
  };
}

export function initPeds(G, rng) {
  for (let i = 0; i < 46; i += 1) {
    // Strollers gather near the avenues and the beach, not inside buildings: retry
    // until the spot is off-road-pavement or sand that a circle can stand on.
    let x = range(rng, 60, WORLD.width - 60);
    let y = range(rng, 60, 2180);
    const ped = createPed(x, y, rng);
    const probe = { x: ped.x, y: ped.y };
    collideCircle(G.world, probe, 14);
    ped.x = probe.x;
    ped.y = probe.y;
    chooseTarget(G, ped);
    G.peds.push(ped);
  }
}

function chooseTarget(G, ped) {
  const rng = G.rng;
  for (let tries = 0; tries < 8; tries += 1) {
    const x = Math.min(WORLD.width - 30, Math.max(30, ped.x + range(rng, -420, 420)));
    const y = Math.min(2240, Math.max(30, ped.y + range(rng, -420, 420)));
    const probe = { x, y };
    collideCircle(G.world, probe, 14);
    if (Math.hypot(probe.x - x, probe.y - y) < 4) {
      ped.tx = x;
      ped.ty = y;
      return;
    }
  }
  ped.tx = ped.x;
  ped.ty = ped.y;
}

/** Something frightening happened at (x, y): nearby peds run directly away from it. */
export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.down || ped.thug) continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    const d = Math.hypot(dx, dy);
    if (d < radius && d > 1) {
      ped.fleeT = Math.max(ped.fleeT, 1.6);
      ped.fleeX = (dx / d) * 190;
      ped.fleeY = (dy / d) * 190;
    }
  }
  for (const car of G.cars) {
    if (car.driver === 'traffic' && car.traffic) {
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < radius + 60) car.traffic.panic = Math.max(car.traffic.panic || 0, 1.2);
    }
  }
}

export function spawnBailedDriver(G, car) {
  const ped = createPed(car.x + 26, car.y + 10, G.rng, {});
  ped.fleeT = 3.2;
  ped.fleeX = 200;
  ped.fleeY = 60;
  G.peds.push(ped);
  return ped;
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.down) {
      ped.downT += dt;
      continue;
    }
    let mvx = 0;
    let mvy = 0;
    let speed = ped.speed;
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      mvx = ped.fleeX;
      mvy = ped.fleeY;
      speed = 196;
    } else if (ped.thug) {
      // Thugs hold their ground near their post and face the player (combat aims them).
      mvx = 0;
      mvy = 0;
    } else if (ped.waitT > 0) {
      ped.waitT -= dt;
    } else {
      const dx = ped.tx - ped.x;
      const dy = ped.ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) {
        if (G.rng() < 0.3) ped.waitT = range(G.rng, 0.6, 2.4);
        chooseTarget(G, ped);
      } else {
        mvx = (dx / d) * speed;
        mvy = (dy / d) * speed;
      }
    }
    ped.vx = mvx;
    ped.vy = mvy;
    ped.x += mvx * dt;
    ped.y += mvy * dt;
    if (mvx !== 0 || mvy !== 0) ped.phase += dt * (speed > 120 ? 13 : 8.5);
    const pos = { x: ped.x, y: ped.y };
    collideCircle(G.world, pos, 12);
    ped.x = pos.x;
    ped.y = pos.y;
  }
  // Fallen peds are cleared away after a while (the city tidies up off-screen).
  for (let i = G.peds.length - 1; i >= 0; i -= 1) {
    if (G.peds[i].down && G.peds[i].downT > 26) G.peds.splice(i, 1);
  }
}

export function drawPed(ctx, ped, t) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(25,20,15,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.down) {
    ctx.rotate(1.35);
    ctx.fillStyle = ped.color;
    ctx.fillRect(-13, -4.5, 26, 9);
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(17, 0, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const stride = Math.sin(ped.phase) * 5;
  const moving = Math.abs(ped.vx) + Math.abs(ped.vy) > 4;
  // Legs.
  ctx.strokeStyle = '#2d3436';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(moving ? stride : 2.5, 10);
  ctx.moveTo(0, 2);
  ctx.lineTo(moving ? -stride : -2.5, 10);
  ctx.stroke();
  // Torso.
  ctx.fillStyle = ped.thug ? '#2d3436' : ped.color;
  ctx.beginPath();
  ctx.arc(0, -1, 7.6, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, -2.5, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,22,16,0.85)';
  ctx.beginPath();
  ctx.arc(0, -4.2, 4.4, Math.PI, Math.PI * 2);
  ctx.fill();
  if (ped.thug) {
    // A held pistol, pointed by combat's aim.
    const a = ped.aimAngle || 0;
    ctx.strokeStyle = '#14181d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
    ctx.stroke();
  }
  ctx.restore();
}
