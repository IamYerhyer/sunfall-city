// Rico Marlin, the player: walking and sprinting on foot with mouse aim, stealing and
// driving any car in the city, shooting from the pavement or the driver's seat, and
// the enter/exit-car dance that ties the two halves of the game together.

import { PLAYER, HEAT } from './config.js';
import { collideCircle, surfaceAt } from './world.js';
import { driveCar, lateralSlip, carSpeed, forwardSpeed } from './vehicles.js';
import { playerShoot, laySkid, clearSkids } from './combat.js';
import { addHeat } from './police.js';
import { spawnBailedDriver, scarePeds } from './pedestrians.js';

export function createPlayer() {
  return {
    x: PLAYER.start.x, y: PLAYER.start.y,
    vx: 0, vy: 0,
    aim: -Math.PI / 2,
    health: PLAYER.maxHealth,
    cash: PLAYER.startCash,
    car: null,
    phase: 0,
    shootCd: 0,
    hurtCd: 0,
    sinceHurt: 99,
    aimHold: 0,
    dead: false,
  };
}

export function nearestCar(G, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(G, car) {
  const player = G.player;
  if (car.driver === 'traffic') {
    spawnBailedDriver(G, car);
    addHeat(G, HEAT.stealDriven);
    G.toast('Car jacked — the driver is running', 'info');
  } else if (car.driver === 'police') {
    addHeat(G, HEAT.stealDriven + HEAT.policeHit * 0.5);
    G.toast('You stole a police cruiser!', 'bad');
  } else if (car.driver === null) {
    addHeat(G, HEAT.stealParked);
  }
  car.driver = 'player';
  car.traffic = null;
  player.car = car;
  G.audio.door();
}

export function exitCar(G) {
  const player = G.player;
  const car = player.car;
  if (!car) return;
  car.driver = null;
  player.car = null;
  // Step out on the left side of the car.
  player.x = car.x - Math.sin(car.angle) * 34;
  player.y = car.y + Math.cos(car.angle) * 34;
  const pos = { x: player.x, y: player.y };
  collideCircle(G.world, pos, PLAYER.radius);
  player.x = pos.x;
  player.y = pos.y;
  player.vx = 0;
  player.vy = 0;
  clearSkids(car);
  G.audio.door();
}

export function updatePlayer(G, dt) {
  const player = G.player;
  const input = G.input;
  player.shootCd = Math.max(0, player.shootCd - dt);
  player.hurtCd = Math.max(0, player.hurtCd - dt);
  player.aimHold = Math.max(0, player.aimHold - dt);
  player.sinceHurt += dt;
  if (player.sinceHurt > 6 && player.health > 0 && player.health < PLAYER.maxHealth) {
    player.health = Math.min(PLAYER.maxHealth, player.health + 3.2 * dt);
  }

  // Aim from the mouse, in world space.
  const view = G.view;
  const mouseWorldX = view.x + input.mouse.x;
  const mouseWorldY = view.y + input.mouse.y;

  if (player.car) {
    const car = player.car;
    player.x = car.x;
    player.y = car.y;
    player.vx = car.vx;
    player.vy = car.vy;
    player.aim = Math.atan2(mouseWorldY - car.y, mouseWorldX - car.x);

    const control = {
      throttle: (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) + (input.down('KeyS') || input.down('ArrowDown') ? -1 : 0),
      steer: (input.down('KeyA') || input.down('ArrowLeft') ? -1 : 0) + (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0),
      handbrake: input.down('Space'),
    };
    const surface = surfaceAt(car.x, car.y);
    const grip = surface === 'sand' ? 0.5 : surface === 'water' ? 0.4 : 1;
    if (surface === 'sand' && carSpeed(car) > 300) { car.vx *= 1 - 0.8 * dt; car.vy *= 1 - 0.8 * dt; }
    driveCar(car, control, dt, grip);
    const pos = { x: car.x, y: car.y };
    collideCircle(G.world, pos, 30);
    if (pos.x !== car.x || pos.y !== car.y) {
      const impact = carSpeed(car);
      if (impact > 240) {
        G.audio.crash(Math.min(1, impact / 500));
        G.shake = Math.min(9, impact / 55);
        car.hp -= impact * 0.028;
        if (car.hp <= 0) { car.hp = 0; car.dead = true; }
      }
      car.x = pos.x;
      car.y = pos.y;
      car.vx *= 0.35;
      car.vy *= 0.35;
    }
    // Skids when sliding or burning out.
    const slip = lateralSlip(car);
    const burningOut = control.throttle !== 0 && Math.abs(forwardSpeed(car)) < 40 && carSpeed(car) > 4;
    if ((slip > 95 && carSpeed(car) > 150) || (control.handbrake && carSpeed(car) > 190) || burningOut) {
      laySkid(G, car, 'L');
      laySkid(G, car, 'R');
      if (Math.random() < 0.3) G.audio.scrape();
    } else {
      clearSkids(car);
    }
    G.audio.engine(true, Math.min(1, carSpeed(car) / 520));

    if (input.mouse.down && player.shootCd <= 0) {
      player.shootCd = 0.16;
      player.aimHold = 0.5;
      playerShoot(G, player.aim);
    }
    if (input.hit('KeyE') || input.hit('KeyF')) exitCar(G);
    return;
  }

  // On foot.
  G.audio.engine(false, 0);
  let mx = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
  let my = (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0) - (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0);
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(mx, my) || 1;
  if (mx !== 0 || my !== 0) {
    player.vx = (mx / len) * speed;
    player.vy = (my / len) * speed;
    player.phase += dt * (sprint ? 12.5 : 9);
  } else {
    player.vx = 0;
    player.vy = 0;
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const pos = { x: player.x, y: player.y };
  collideCircle(G.world, pos, PLAYER.radius);
  player.x = pos.x;
  player.y = pos.y;
  player.aim = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);

  if (input.mouse.down && player.shootCd <= 0) {
    player.shootCd = 0.16;
    player.aimHold = 0.5;
    playerShoot(G, player.aim);
  }
  if (input.hit('KeyE') || input.hit('KeyF')) {
    const car = nearestCar(G, player.x, player.y, 56);
    if (car) enterCar(G, car);
  }
}

/** Any fast car meeting a pedestrian: they go down. The law notices when it's Rico. */
export function carHitsPeds(G, car) {
  const speed = carSpeed(car);
  if (speed < 90) return;
  for (const ped of G.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30) {
      ped.down = true;
      ped.downT = 0;
      if (car.driver === 'player') {
        addHeat(G, HEAT.pedDown);
        G.toast('You ran someone down!', 'bad');
        G.audio.crash(0.3);
      }
      scarePeds(G, ped.x, ped.y, 260);
    }
  }
}

export function drawPlayer(ctx, player, t) {
  if (player.car) return; // the car is drawn by vehicles.js; Rico is at the wheel
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(25,20,15,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 11, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const moving = Math.abs(player.vx) + Math.abs(player.vy) > 4;
  const stride = moving ? Math.sin(player.phase) * 5.5 : 0;
  ctx.strokeStyle = '#243447';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(stride, 11);
  ctx.moveTo(0, 2);
  ctx.lineTo(-stride, 11);
  ctx.stroke();
  // Rico's teal overshirt.
  ctx.fillStyle = '#12b5a5';
  ctx.beginPath();
  ctx.arc(0, -1, 8.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6e3c8';
  ctx.beginPath();
  ctx.arc(0, -1, 4.4, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#8d5524';
  ctx.beginPath();
  ctx.arc(0, -3, 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#191410';
  ctx.beginPath();
  ctx.arc(0, -4.8, 4.6, Math.PI, Math.PI * 2);
  ctx.fill();
  // Gun arm while aiming or just after a shot.
  if (player.aimHold > 0) {
    ctx.strokeStyle = '#5b4632';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(player.aim) * 11, Math.sin(player.aim) * 11);
    ctx.stroke();
    ctx.strokeStyle = '#14181d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(player.aim) * 9, Math.sin(player.aim) * 9);
    ctx.lineTo(Math.cos(player.aim) * 17, Math.sin(player.aim) * 17);
    ctx.stroke();
  }
  ctx.restore();
}
