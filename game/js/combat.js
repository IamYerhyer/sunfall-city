// Combat and effects: bullets with tracers, muzzle flashes, sparks, smoke and fire,
// skid marks that fade, and all the hit rules — what a bullet does to a building, a
// car, a pedestrian, a thug, a cruiser or Rico, and what the law thinks of it.

import { GUN, HEAT } from './config.js';
import { damageCar } from './vehicles.js';
import { addHeat } from './police.js';
import { scarePeds } from './pedestrians.js';
import { segmentBlocked } from './world.js';

export function createEffects() {
  return { bullets: [], particles: [], skids: [] };
}

export function spawnParticles(G, x, y, opts) {
  const o = opts || {};
  const count = o.count || 6;
  for (let i = 0; i < count; i += 1) {
    if (G.fx.particles.length > 420) return;
    const a = Math.random() * Math.PI * 2;
    const sp = (o.speed || 90) * (0.3 + Math.random() * 0.9);
    G.fx.particles.push({
      x, y,
      vx: Math.cos(a) * sp + (o.vx || 0),
      vy: Math.sin(a) * sp + (o.vy || 0),
      life: 0,
      maxLife: (o.life || 0.5) * (0.6 + Math.random() * 0.8),
      size: (o.size || 3) * (0.7 + Math.random() * 0.7),
      color: o.color || '#ffd76a',
      drag: o.drag || 2.2,
      rise: o.rise || 0,
    });
  }
}

export function fireBullet(G, from, angle, owner) {
  const spread = (Math.random() - 0.5) * 2 * GUN.spread;
  const a = angle + spread;
  G.fx.bullets.push({
    x: from.x + Math.cos(angle) * 18,
    y: from.y + Math.sin(angle) * 18,
    vx: Math.cos(a) * GUN.bulletSpeed,
    vy: Math.sin(a) * GUN.bulletSpeed,
    life: GUN.range / GUN.bulletSpeed,
    owner,
  });
  spawnParticles(G, from.x + Math.cos(angle) * 20, from.y + Math.sin(angle) * 20, {
    count: 3, speed: 60, life: 0.09, size: 4.5, color: '#ffe9a3',
  });
}

/** The player pulls the trigger (from the driver's seat when driving). */
export function playerShoot(G, angle) {
  const player = G.player;
  const from = player.car ? { x: player.car.x, y: player.car.y } : { x: player.x, y: player.y };
  fireBullet(G, from, angle, 'player');
  G.audio.shot();
  addHeat(G, HEAT.shotFired);
  scarePeds(G, from.x, from.y, 240);
}

export function thugShoot(G, thug) {
  const player = G.player;
  const target = player.car || player;
  const angle = Math.atan2(target.y - thug.y, target.x - thug.x);
  thug.aimAngle = angle;
  fireBullet(G, thug, angle, 'thug');
  G.audio.enemyShot();
}

function bulletHitsBuilding(G, b) {
  for (const rect of G.world.buildings) {
    if (b.x >= rect.x && b.x <= rect.x + rect.w && b.y >= rect.y && b.y <= rect.y + rect.h) return true;
  }
  return false;
}

export function updateCombat(G, dt) {
  const player = G.player;
  const pTarget = player.car || player;

  for (let i = G.fx.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.fx.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && bulletHitsBuilding(G, b)) {
      spawnParticles(G, b.x, b.y, { count: 5, speed: 130, life: 0.3, size: 2.4, color: '#ffd76a' });
      dead = true;
    }
    if (!dead && b.owner !== 'player') {
      const d = Math.hypot(b.x - pTarget.x, b.y - pTarget.y);
      if (d < (player.car ? 34 : 15)) {
        hurtPlayer(G, b.owner === 'thug' ? 7 : 5);
        spawnParticles(G, pTarget.x, pTarget.y, { count: 6, speed: 120, life: 0.35, size: 3, color: '#ff8a75' });
        dead = true;
      }
    }
    if (!dead && b.owner === 'player') {
      for (const car of G.cars) {
        if (car === player.car) continue;
        if (Math.abs(b.x - car.x) < car.l * 0.52 && Math.abs(b.y - car.y) < car.l * 0.52
          && Math.hypot(b.x - car.x, b.y - car.y) < car.l * 0.52) {
          damageCar(car, GUN.damage);
          spawnParticles(G, b.x, b.y, { count: 7, speed: 170, life: 0.32, size: 2.6, color: '#ffd76a' });
          if (car.driver === 'police') addHeat(G, car.dead ? HEAT.policeDown : HEAT.policeHit * 0.4);
          else if (car.driver === 'traffic' && car.traffic) car.traffic.panic = 2;
          if (car.dead) spawnParticles(G, car.x, car.y, { count: 16, speed: 200, life: 0.7, size: 4, color: '#ff9a3c' });
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const ped of G.peds) {
          if (ped.down) continue;
          if (Math.hypot(b.x - ped.x, b.y - ped.y) < 13) {
            ped.hp -= GUN.damage;
            spawnParticles(G, ped.x, ped.y, { count: 6, speed: 110, life: 0.35, size: 3, color: '#ff8a75' });
            if (ped.hp <= 0) {
              ped.down = true;
              ped.downT = 0;
              if (ped.thug) { G.onThugDown(ped); addHeat(G, HEAT.pedHit); }
              else { addHeat(G, HEAT.pedDown); scarePeds(G, ped.x, ped.y, 320); }
            } else if (ped.thug) {
              ped.fleeT = 0;
            } else {
              ped.fleeT = 2;
              ped.fleeX = (ped.x - b.x) * 4;
              ped.fleeY = (ped.y - b.y) * 4;
              addHeat(G, HEAT.pedHit * 0.5);
            }
            dead = true;
            break;
          }
        }
      }
    }
    if (dead) G.fx.bullets.splice(i, 1);
  }

  // Particles.
  for (let i = G.fx.particles.length - 1; i >= 0; i -= 1) {
    const p = G.fx.particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) { G.fx.particles.splice(i, 1); continue; }
    p.vx -= p.vx * p.drag * dt;
    p.vy -= p.vy * p.drag * dt + p.rise * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  // Skid marks fade very slowly.
  for (let i = G.fx.skids.length - 1; i >= 0; i -= 1) {
    G.fx.skids[i].alpha -= dt * 0.008;
    if (G.fx.skids[i].alpha <= 0.05) G.fx.skids.splice(i, 1);
  }
  // Burning wrecks and smoking wrecks-to-be.
  for (const car of G.cars) {
    if (car.dead && Math.random() < 0.3) {
      spawnParticles(G, car.x, car.y - 6, { count: 2, speed: 26, life: 0.9, size: 6, color: '#ff7a2f', rise: 60 });
      spawnParticles(G, car.x, car.y - 12, { count: 1, speed: 14, life: 1.3, size: 8, color: 'rgba(40,40,40,0.6)', rise: 46 });
    } else if (!car.dead && car.hp < 38 && Math.random() < 0.22) {
      spawnParticles(G, car.x, car.y - 8, { count: 1, speed: 12, life: 1, size: 6, color: 'rgba(70,70,70,0.55)', rise: 40 });
    }
  }
}

export function hurtPlayer(G, amount) {
  const player = G.player;
  if (player.hurtCd > 0) return;
  player.hurtCd = 0.12;
  player.health -= amount;
  if (player.health <= 0) {
    player.health = 0;
    G.wasted();
  }
}

/** Lay a skid segment behind a wheel when the car slides or spins its wheels. */
export function laySkid(G, car, wheel) {
  const back = -car.l * 0.31;
  const side = wheel === 'L' ? -car.w * 0.42 : car.w * 0.42;
  const wx = car.x + Math.cos(car.angle) * back - Math.sin(car.angle) * side;
  const wy = car.y + Math.sin(car.angle) * back + Math.cos(car.angle) * side;
  const last = wheel === 'L' ? car.skidL : car.skidR;
  if (last && Math.hypot(wx - last.x, wy - last.y) < 30) {
    G.fx.skids.push({ x1: last.x, y1: last.y, x2: wx, y2: wy, alpha: 0.5 });
    if (G.fx.skids.length > 700) G.fx.skids.splice(0, G.fx.skids.length - 700);
  }
  if (wheel === 'L') car.skidL = { x: wx, y: wy }; else car.skidR = { x: wx, y: wy };
}

export function clearSkids(car) {
  car.skidL = null;
  car.skidR = null;
}

export function drawEffects(ctx, G) {
  // Skid marks sit on the asphalt, under everything else that moves.
  ctx.strokeStyle = '#1c1e22';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const s of G.fx.skids) {
    ctx.globalAlpha = s.alpha;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawProjectiles(ctx, G) {
  // Tracers.
  for (const b of G.fx.bullets) {
    const back = 0.016;
    ctx.strokeStyle = 'rgba(255,230,150,0.95)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * back, b.y - b.vy * back);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Particles.
  for (const p of G.fx.particles) {
    const k = 1 - p.life / p.maxLife;
    ctx.globalAlpha = Math.min(1, k * 1.4);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.rise ? (1.6 - k * 0.6) : k + 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function hasLineOfSight(G, a, b) {
  return !segmentBlocked(G.world, a.x, a.y, b.x, b.y);
}
