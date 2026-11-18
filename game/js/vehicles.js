// Cars: the entity, the arcade driving model (velocity split into forward and lateral
// parts so the handbrake can break the rear loose), damage, and the top-down drawing —
// sedans, sports cars, pickups and SFPD cruisers with a flashing light bar.

import { CAR_COLORS } from './config.js';
import { pick } from './random.js';

export const CAR_KINDS = {
  sedan: { w: 46, l: 92, maxSpeed: 415, accel: 330, grip: 9.5, label: 'Sedan' },
  sport: { w: 44, l: 90, maxSpeed: 545, accel: 430, grip: 10.5, label: 'Comet GT' },
  luxury: { w: 47, l: 96, maxSpeed: 500, accel: 395, grip: 10, label: 'Aurelion GT' },
  pickup: { w: 50, l: 100, maxSpeed: 380, accel: 300, grip: 8.5, label: 'Pickup' },
  police: { w: 47, l: 94, maxSpeed: 520, accel: 420, grip: 10.5, label: 'SFPD Cruiser' },
};

let nextCarId = 1;

export function createCar(x, y, angle, kind, color, rng) {
  const spec = CAR_KINDS[kind];
  return {
    id: nextCarId++,
    x, y, angle,
    vx: 0, vy: 0,
    kind,
    w: spec.w, l: spec.l,
    color: color || (rng ? pick(rng, CAR_COLORS) : '#cccccc'),
    hp: 100,
    driver: null,        // 'traffic' | 'police' | 'player' | 'thug' | null (parked)
    dead: false,
    burning: 0,
    steerVis: 0,
    skidL: null, skidR: null,
    honkAt: 0,
    stuckT: 0,
  };
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

/**
 * One step of the driving model. control: {throttle -1..1, steer -1..1, handbrake}.
 * surfaceGrip scales the lateral grip (sand is loose, the pier is narrow and slow).
 */
export function driveCar(car, control, dt, surfaceGrip) {
  const spec = CAR_KINDS[car.kind];
  if (car.dead) {
    car.vx *= Math.max(0, 1 - 3 * dt);
    car.vy *= Math.max(0, 1 - 3 * dt);
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    return;
  }
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const rx = -fy;
  const ry = fx;
  let fwd = car.vx * fx + car.vy * fy;
  let lat = car.vx * rx + car.vy * ry;

  fwd += control.throttle * spec.accel * dt;
  // Rolling drag and a soft top speed, with reverse capped low.
  fwd -= fwd * 0.55 * dt;
  if (fwd > spec.maxSpeed) fwd = spec.maxSpeed;
  if (fwd < -150) fwd = -150;
  if (control.throttle === 0) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 60 * dt);

  const grip = (control.handbrake ? 2.1 : spec.grip) * (surfaceGrip || 1);
  lat -= lat * Math.min(1, grip * dt);

  const steerAuthority = Math.min(1, Math.abs(fwd) / 120) * (control.handbrake ? 1.55 : 1);
  car.angle += control.steer * 2.35 * steerAuthority * dt * (fwd < 0 ? -1 : 1);
  car.steerVis += ((control.steer || 0) - car.steerVis) * Math.min(1, 12 * dt);

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * fwd + -nfy * lat;
  car.vy = nfy * fwd + nfx * lat;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
}

/** Lateral slip in px/s — what lays skid marks and smoke. */
export function lateralSlip(car) {
  const rx = -Math.sin(car.angle);
  const ry = Math.cos(car.angle);
  return Math.abs(car.vx * rx + car.vy * ry);
}

/** Circle-vs-circle shove between two cars; returns impact strength 0..1 or 0. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minD = (a.l + b.l) * 0.32;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD || d2 < 0.01) return 0;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const overlap = minD - d;
  const total = 2;
  a.x -= nx * overlap * (1 / total);
  a.y -= ny * overlap * (1 / total);
  b.x += nx * overlap * (1 / total);
  b.y += ny * overlap * (1 / total);
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel < 0) {
    const impulse = -rel * 0.72;
    a.vx -= nx * impulse;
    a.vy -= ny * impulse;
    b.vx += nx * impulse;
    b.vy += ny * impulse;
    return Math.min(1, Math.abs(rel) / 320);
  }
  return 0.12;
}

export function damageCar(car, amount) {
  if (car.dead) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    car.dead = true;
  }
}

export function drawCar(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  // Ground shadow.
  ctx.fillStyle = 'rgba(25,20,15,0.28)';
  ctx.fillRect(-car.l / 2 + 5, -car.w / 2 + 7, car.l, car.w);
  ctx.rotate(car.angle);
  const L = car.l;
  const W = car.w;
  // Wheels.
  ctx.fillStyle = '#15181c';
  const ww = 11;
  const wh = 6.5;
  const wx = L * 0.31;
  const wy = W / 2 - 1;
  ctx.fillRect(wx - ww / 2, -wy - wh / 2 + car.steerVis * 2, ww, wh);
  ctx.fillRect(wx - ww / 2, wy - wh / 2 - car.steerVis * 2, ww, wh);
  ctx.fillRect(-wx - ww / 2, -wy - wh / 2, ww, wh);
  ctx.fillRect(-wx - ww / 2, wy - wh / 2, ww, wh);
  // Body.
  ctx.fillStyle = car.dead ? '#2c2f33' : car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  roundRect(ctx, -L / 2 + 4, -W / 2 + 3, L - 8, W * 0.32, 8);
  ctx.fill();
  // Cabin and glass.
  ctx.fillStyle = car.dead ? '#1d1f22' : '#22303e';
  roundRect(ctx, -L * 0.16, -W * 0.4, L * 0.42, W * 0.8, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,235,0.55)';
  roundRect(ctx, L * 0.16, -W * 0.36, L * 0.09, W * 0.72, 4);
  ctx.fill();
  roundRect(ctx, -L * 0.24, -W * 0.36, L * 0.07, W * 0.72, 4);
  ctx.fill();
  // Nose and tail trim.
  ctx.fillStyle = 'rgba(255,244,190,0.9)';
  ctx.fillRect(L / 2 - 4, -W * 0.32, 3.4, 8);
  ctx.fillRect(L / 2 - 4, W * 0.32 - 8, 3.4, 8);
  ctx.fillStyle = 'rgba(255,70,60,0.85)';
  ctx.fillRect(-L / 2 + 1, -W * 0.32, 3, 8);
  ctx.fillRect(-L / 2 + 1, W * 0.32 - 8, 3, 8);
  if (car.kind === 'sport' || car.kind === 'luxury') {
    ctx.fillStyle = 'rgba(20,20,24,0.75)';
    ctx.fillRect(-L / 2 + 2, -W * 0.42, 7, W * 0.84);
  }
  if (car.kind === 'pickup') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-L * 0.48, -W * 0.42, L * 0.3, W * 0.84);
  }
  if (car.kind === 'police') {
    ctx.fillStyle = '#f4f6f8';
    roundRect(ctx, -L / 2, -W / 2, L, W, 10);
    ctx.fill();
    ctx.fillStyle = '#1d2733';
    ctx.fillRect(-L * 0.05, -W / 2, L * 0.34, W);
    ctx.fillStyle = '#22303e';
    roundRect(ctx, -L * 0.16, -W * 0.4, L * 0.42, W * 0.8, 7);
    ctx.fill();
    ctx.fillStyle = '#f4f6f8';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SFPD', L * 0.12, 0);
    // Light bar: red and blue strobing.
    const phase = Math.floor(t * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#5a1d1d';
    ctx.fillRect(-8, -W * 0.3, 15, W * 0.28);
    ctx.fillStyle = phase ? '#2d5bff' : '#1d2d5a';
    ctx.fillRect(-8, W * 0.02, 15, W * 0.28);
    if (car.driver) {
      ctx.fillStyle = phase ? 'rgba(255,59,48,0.16)' : 'rgba(45,91,255,0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, 74, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Damage scratches.
  if (car.hp < 55 && !car.dead) {
    ctx.strokeStyle = 'rgba(20,20,20,0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-L * 0.3, -W * 0.3);
    ctx.lineTo(-L * 0.05, W * 0.1);
    ctx.moveTo(L * 0.2, W * 0.35);
    ctx.lineTo(L * 0.42, -W * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
