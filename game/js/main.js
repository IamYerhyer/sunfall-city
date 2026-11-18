// Sunfall City — the boot and the loop. Builds the city and its people, runs the
// screens (title, play, pause, WASTED, BUSTED), steps every system in order, settles
// car-to-car collisions, draws the world and the HUD, and poses the scripted scenes
// behind ?shot=cover|foot|drive|mission for the maker's screenshots.

import { PLAYER } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCamera, updateCamera, cameraView } from './camera.js';
import { buildWorld, drawWorld, drawBeacon, surfaceAt, poiById } from './world.js';
import { createCar, drawCar, collideCars, carSpeed } from './vehicles.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { initPeds, updatePeds, drawPed } from './pedestrians.js';
import { createWanted, updatePolice, clearHeat, respawnPoint, addHeat, HEAT_RAM } from './police.js';
import { createPlayer, updatePlayer, drawPlayer, carHitsPeds, exitCar } from './player.js';
import { createEffects, updateCombat, drawEffects, drawProjectiles, thugShoot } from './combat.js';
import { createStory, startMission, updateMissions, initBags, currentObjective, onThugDown } from './missions.js';
import { drawHUD, drawScreens, buttonAt } from './hud.js';
import { saveGame, loadSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 7) >>> 0;

let W = 1280;
let H = 720;
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
}
window.addEventListener('resize', resize);
resize();

const G = {
  rng: makeRng(SEED),
  time: 0,
  screen: 'title',
  world: null,
  player: null,
  cars: [],
  peds: [],
  bags: [],
  wanted: createWanted(),
  story: createStory(),
  errand: null,
  errandCd: 6,
  fx: createEffects(),
  audio: createAudio(),
  input: createInput(canvas),
  cam: createCamera(),
  view: { x: 0, y: 0, w: W, h: H },
  toasts: [],
  stats: { missionsDone: 0, errandsDone: 0, bagsFound: 0 },
  shake: 0,
  lastFine: 0,
  spawnCd: 0,
  frozen: false,
  titlePan: 0,
  surfaceAt,
  toast(text, kind) {
    G.toasts.push({ text, kind: kind || 'info', t: 4.2 });
    if (G.toasts.length > 3) G.toasts.shift();
    if (statusEl) statusEl.textContent = text;
  },
  thugShoot(thug) { thugShoot(G, thug); },
  onThugDown(ped) { onThugDown(G, ped); },
  wasted() { endRun('wasted'); },
  busted() { endRun('busted'); },
};

function buildWorldState(seed) {
  G.rng = makeRng(seed);
  G.world = buildWorld(G.rng);
  G.cars = [];
  G.peds = [];
  G.fx = createEffects();
  G.wanted = createWanted();
  G.story = createStory();
  G.errand = null;
  G.errandCd = 6;
  G.toasts = [];
  G.stats = { missionsDone: 0, errandsDone: 0, bagsFound: 0 };
  G.player = createPlayer();
  initTraffic(G, G.rng);
  initPeds(G, G.rng);
  initBags(G);
}

function newGame() {
  buildWorldState(SEED);
  G.screen = 'play';
  startMission(G, 0);
  G.toast('Sunfall City — Marina is waiting', 'info');
}

function continueGame() {
  const save = loadSave();
  buildWorldState(SEED);
  G.screen = 'play';
  if (save) {
    G.player.cash = save.cash;
    G.player.x = save.x;
    G.player.y = save.y;
    G.stats.missionsDone = save.missionsDone || 0;
    G.stats.errandsDone = save.errandsDone || 0;
    if (Array.isArray(save.bags)) save.bags.forEach((v, i) => { if (G.bags[i] && v) G.bags[i].taken = true; });
    G.stats.bagsFound = G.bags.filter((b) => b.taken).length;
    if (save.storyDone) {
      G.story.done = true;
      G.story.active = false;
      G.story.index = 3;
    } else {
      startMission(G, Math.min(3, save.storyIndex || 0));
    }
    G.toast('Welcome back to Sunfall', 'info');
  } else {
    startMission(G, 0);
  }
}

function endRun(kind) {
  if (G.screen !== 'play') return;
  G.screen = kind;
  const fine = Math.min(G.player.cash, Math.max(25, Math.floor(G.player.cash * 0.12)));
  G.lastFine = fine;
  G.audio.engine(false, 0);
  G.audio.siren(false, 0);
  G.audio.fail();
}

function respawn() {
  const kind = G.screen;
  G.player.cash -= G.lastFine;
  if (G.player.car) exitCar(G);
  const door = respawnPoint(kind);
  G.player.x = door.x;
  G.player.y = door.y;
  G.player.vx = 0;
  G.player.vy = 0;
  G.player.health = PLAYER.maxHealth;
  G.player.sinceHurt = 99;
  clearHeat(G);
  G.screen = 'play';
  saveGame(G);
}

function handleButtons() {
  if (!G.input.mouse.clicked) return;
  const id = buttonAt(G, W, H, G.input.mouse.clickX, G.input.mouse.clickY);
  if (!id) return;
  G.audio.unlock();
  G.audio.click();
  if (id === 'new') newGame();
  else if (id === 'continue') continueGame();
  else if (id === 'resume') G.screen = 'play';
  else if (id === 'save') { if (saveGame(G)) G.toast('Game saved', 'good'); }
  else if (id === 'restart') newGame();
  else if (id === 'mute') G.audio.toggleMute();
  else if (id === 'respawn') respawn();
}

function update(dt) {
  G.time += dt;
  // Toasts always age.
  for (let i = G.toasts.length - 1; i >= 0; i -= 1) {
    G.toasts[i].t -= dt;
    if (G.toasts[i].t <= 0) G.toasts.splice(i, 1);
  }
  if (G.frozen) return;

  if (G.screen === 'title') {
    updateTraffic(G, dt);
    updatePeds(G, dt);
    G.titlePan += dt * 0.05;
    const cx = 1600 + Math.cos(G.titlePan) * 620;
    const cy = 1200 + Math.sin(G.titlePan * 0.8) * 420;
    G.cam.lookX = cx;
    G.cam.lookY = cy;
    G.cam.x = cx;
    G.cam.y = cy;
    handleButtons();
    return;
  }
  if (G.screen === 'pause') {
    handleButtons();
    if (G.input.hit('KeyP') || G.input.hit('Escape')) G.screen = 'play';
    return;
  }
  if (G.screen === 'wasted' || G.screen === 'busted') {
    handleButtons();
    if (G.input.hit('Enter') || G.input.hit('Space')) respawn();
    return;
  }

  // Play.
  if (G.input.hit('KeyP') || G.input.hit('Escape')) { G.screen = 'pause'; return; }
  if (G.input.hit('KeyM')) G.audio.toggleMute();
  if (G.input.hit('KeyK')) saveGame(G);

  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePolice(G, dt);
  updatePeds(G, dt);
  updateMissions(G, dt);
  updateCombat(G, dt);
  settleCollisions(G, dt);

  // Siren when a live cruiser is near and the heat is on.
  let sirenNear = false;
  if (G.wanted.stars > 0) {
    for (const car of G.cars) {
      if (car.driver === 'police' && !car.dead && Math.hypot(car.x - G.player.x, car.y - G.player.y) < 760) { sirenNear = true; break; }
    }
  }
  G.audio.siren(sirenNear, dt);

  const focus = G.player.car || G.player;
  updateCamera(G.cam, dt, { x: focus.x, y: focus.y, vx: focus.vx || 0, vy: focus.vy || 0 }, W, H);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 14);
}

function settleCollisions(G, dt) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (Math.abs(a.x - b.x) > 90 || Math.abs(a.y - b.y) > 90) continue;
      const impact = collideCars(a, b);
      if (impact > 0.3) {
        const involvesPlayer = a === G.player.car || b === G.player.car;
        if (impact > 0.42) {
          a.hp -= impact * 16;
          b.hp -= impact * 16;
          if (a.hp <= 0) { a.hp = 0; a.dead = true; }
          if (b.hp <= 0) { b.hp = 0; b.dead = true; }
        }
        if (involvesPlayer) {
          G.audio.crash(impact);
          G.shake = Math.min(10, impact * 11);
          const other = a === G.player.car ? b : a;
          if (other.driver === 'police') importHeatRam();
          if (impact > 0.62) hurtViaCrash();
        } else if (Math.hypot(a.x - G.player.x, a.y - G.player.y) < 420) {
          G.audio.crash(impact * 0.6);
        }
      }
    }
    carHitsPeds(G, cars[i]);
  }
}

function importHeatRam() {
  // Ramming a cruiser is a crime the whole force notices.
  addHeat(G, HEAT_RAM);
}

function hurtViaCrash() {
  G.player.health -= 5;
  G.player.sinceHurt = 0;
  if (G.player.health <= 0) { G.player.health = 0; G.wasted(); }
}

function draw() {
  const view = cameraView(G.cam, W, H);
  view.w = W;
  view.h = H;
  G.view = view;
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  let shakeX = 0;
  let shakeY = 0;
  if (G.shake > 0.2) {
    shakeX = (Math.random() - 0.5) * G.shake;
    shakeY = (Math.random() - 0.5) * G.shake;
  }
  ctx.translate(-view.x + shakeX, -view.y + shakeY);

  drawWorld(ctx, G.world, view, G.time);
  drawEffects(ctx, G);

  // Cash bags glitter.
  for (const bag of G.bags) {
    if (bag.taken) continue;
    if (bag.x < view.x - 30 || bag.x > view.x + view.w + 30 || bag.y < view.y - 30 || bag.y > view.y + view.h + 30) continue;
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(bag.x - 8, bag.y - 6 + Math.sin(G.time * 3 + bag.x) * 2, 16, 12);
    ctx.fillStyle = '#ffd740';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', bag.x, bag.y + 3 + Math.sin(G.time * 3 + bag.x) * 2);
  }

  // Mission beacon.
  const obj = G.screen === 'play' || G.screen === 'pause' ? currentObjective(G) : null;
  if (obj && obj.point) drawBeacon(ctx, obj.point.x, obj.point.y, G.time);

  // Mission cars get a marker chevron.
  for (const car of G.cars) {
    if (car.mission && !car.dead) {
      ctx.fillStyle = '#ffd740';
      ctx.beginPath();
      const bob = Math.sin(G.time * 4) * 4;
      ctx.moveTo(car.x, car.y - 44 + bob);
      ctx.lineTo(car.x - 9, car.y - 58 + bob);
      ctx.lineTo(car.x + 9, car.y - 58 + bob);
      ctx.closePath();
      ctx.fill();
    }
  }

  for (const car of G.cars) drawCar(ctx, car, G.time);
  for (const ped of G.peds) {
    if (ped.x < view.x - 40 || ped.x > view.x + view.w + 40 || ped.y < view.y - 40 || ped.y > view.y + view.h + 40) continue;
    drawPed(ctx, ped, G.time);
  }
  if (G.screen !== 'title') drawPlayer(ctx, G.player, G.time);
  drawProjectiles(ctx, G);
  ctx.restore();

  if (G.screen === 'play' || G.screen === 'pause') drawHUD(ctx, G, W, H, G.time);
  drawScreens(ctx, G, W, H, G.time);
}

// --------------------------------------------------------------------------
// Scripted screenshot scenes. Each poses the real game — real systems, stepped
// forward with scripted keys — then freezes on the frame the maker asked for.

function scriptKeys(map) {
  G.input.down = (code) => !!map[code];
  G.input.hit = () => false;
}

function step(n, dt) {
  for (let i = 0; i < n; i += 1) update(dt || 1 / 30);
}

function setupShot(name) {
  buildWorldState(SEED);
  G.screen = 'play';
  G.player.cash = 1240;
  startMission(G, 0);
  const player = G.player;

  if (name === 'cover') {
    // A chase strung out along the long mid-city avenue: Rico ahead, two cruisers
    // on his tail, traffic to thread through.
    const car = createCar(900, 1431, 0, 'sedan', '#e74c3c', G.rng);
    car.driver = 'player';
    car.vx = 380;
    G.cars.push(car);
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    const cop1 = createCar(706, 1431, 0, 'police', '#f4f6f8', G.rng);
    cop1.driver = 'police';
    cop1.vx = 392;
    const cop2 = createCar(588, 1431, 0, 'police', '#f4f6f8', G.rng);
    cop2.driver = 'police';
    cop2.vx = 378;
    G.cars.push(cop1, cop2);
    G.wanted.heat = 3;
    G.wanted.stars = 3;
    scriptKeys({ KeyW: true });
    step(58);
    // Pose the frame's facts: exactly three stars, a sound car, no stale toasts.
    G.wanted.heat = 3;
    G.wanted.stars = 3;
    G.wanted.flashT = 1.4;
    car.hp = 88;
    G.toasts = [];
    G.fx.particles.push({ x: cop1.x + 42, y: cop1.y - 10, vx: 60, vy: -30, life: 0, maxLife: 9, size: 3.4, color: '#ffd76a', drag: 0, rise: 0 });
  } else if (name === 'foot') {
    player.x = 1160;
    player.y = 672;
    player.aim = 0.6;
    player.aimHold = 9;
    G.input.mouse.x = 860;
    G.input.mouse.y = 430;
    scriptKeys({});
    step(50);
    player.x = 1160;
    player.y = 672;
    player.aim = 0.6;
    player.aimHold = 9;
    G.story.briefT = 0; // the club's own sign carries this frame, not the brief card
    G.toasts = [];
  } else if (name === 'drive') {
    // Full speed along the coast road, one cruiser on the tail, the sea alongside.
    const car = createCar(200, 2011, 0, 'sport', '#3498db', G.rng);
    car.driver = 'player';
    car.vx = 470;
    G.cars.push(car);
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    const cop = createCar(30, 2011, 0, 'police', '#f4f6f8', G.rng);
    cop.driver = 'police';
    cop.vx = 448;
    G.cars.push(cop);
    G.wanted.heat = 2;
    G.wanted.stars = 2;
    scriptKeys({ KeyW: true });
    step(46);
    G.wanted.heat = 2;
    G.wanted.stars = 2;
    car.hp = 95;
    player.health = 100;
    G.toasts = [];
  } else if (name === 'mission') {
    // Story state: job 1 done, the Comet run live — Rico rolls down the pier avenue
    // toward the delivery beacon, the Sunfall Pier sign ahead of him.
    G.story.index = 1;
    G.story.stage = 1;
    G.story.active = true;
    G.story.briefT = 0;
    const car = createCar(1491, 1900, Math.PI / 2, 'sport', '#e74c3c', G.rng);
    car.driver = 'player';
    car.mission = true;
    car.vy = 150;
    G.cars.push(car);
    G.story.missionCar = car;
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    scriptKeys({ KeyW: true });
    step(20);
    G.toasts = [];
  }
  // Settle the camera on the player and hold the frame. Screenshot framing keeps
  // only a whisper of look-ahead so the chase behind stays in the picture.
  const focus = G.player.car || G.player;
  G.cam.lookX = focus.x + (focus.vx || 0) * 0.1;
  G.cam.lookY = focus.y + (focus.vy || 0) * 0.1;
  updateCamera(G.cam, 0.5, { x: focus.x, y: focus.y, vx: (focus.vx || 0) * 0.2, vy: (focus.vy || 0) * 0.2 }, W, H);
  G.frozen = true;
  window.__shotReady = true;
}

// --------------------------------------------------------------------------

buildWorldState(SEED);
if (SHOT) {
  setupShot(SHOT);
} else {
  G.screen = 'title';
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
  last = now;
  if (!SHOT) update(dt);
  else if (!G.frozen) update(dt);
  draw();
  G.input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
