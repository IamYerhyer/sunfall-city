// The story: four jobs for Marina Voss that walk Rico up Sunfall's ladder, then an open
// city — paid errands that keep coming and twelve hidden cash bags. Each job is a list
// of stages; a stage is an objective line, a place, and a condition (arrive in a car,
// arrive on foot, drive one specific car, clear out the thugs). The beacon, the HUD
// objective and the minimap marker all read the same current stage.

import { poiById, BAG_SPOTS, collideCircle } from './world.js';
import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { clearHeat } from './police.js';
import { saveGame } from './save.js';

export const MISSIONS = [
  {
    title: 'Welcome to Sunfall',
    brief: 'Marina Voss runs this coast, and she has work for a driver who shows up. Take a car, swing by Club Azul for her package, and drop it at Marlo’s Chop Shop.',
    reward: 300,
    stages: [
      { text: 'Get in a car', kind: 'enterCar' },
      { text: 'Drive to Club Azul', kind: 'reach', at: 'club', r: 84 },
      { text: 'Pick up the package at the club door', kind: 'reachFoot', at: 'club', r: 40 },
      { text: 'Deliver the package to Marlo’s Chop Shop', kind: 'reach', at: 'chop', r: 88 },
    ],
  },
  {
    title: 'Coast Run',
    brief: 'Marlo has a Comet GT with a buyer waiting at the pier. The car is outside the Chop Shop — deliver it to Sunfall Pier with the paint still on.',
    reward: 700,
    stages: [
      { text: 'Take the Comet GT outside the Chop Shop', kind: 'driveCar', spawn: 'missionCar' },
      { text: 'Deliver the Comet GT to Sunfall Pier', kind: 'reachInCar', at: 'pier', r: 92 },
    ],
  },
  {
    title: 'Hot Property',
    brief: 'A Aurelion GT is parked uptown, full of somebody else’s paperwork. Steal it, and get it to the Harbour Hideout before the SFPD make it famous.',
    reward: 900,
    stages: [
      { text: 'Steal the Aurelion GT uptown', kind: 'driveCar', spawn: 'hotCar' },
      { text: 'Get the car to the Harbour Hideout', kind: 'reachInCar', at: 'hideout', r: 92 },
    ],
  },
  {
    title: 'Marina’s Regards',
    brief: 'A rival crew is squatting in the east beach lockup and talking loudly. Go there, quiet the three of them, then come back to Club Azul a made man.',
    reward: 1500,
    stages: [
      { text: 'Go to the east beach lockup', kind: 'reach', at: 'lockup', r: 92 },
      { text: 'Quiet the three rival drivers', kind: 'thugs', at: 'lockup', r: 92 },
      { text: 'Return to Club Azul', kind: 'reach', at: 'club', r: 88 },
    ],
  },
];

const EXTRA_POINTS = {
  lockup: { x: 2790, y: 2076, name: 'East Beach Lockup' },
};

export function stagePoint(stage) {
  if (stage.at && EXTRA_POINTS[stage.at]) return EXTRA_POINTS[stage.at];
  if (stage.at) {
    const poi = poiById(stage.at);
    return { x: poi.door.x, y: poi.door.y, name: poi.name };
  }
  return null;
}

export function createStory() {
  return { index: 0, stage: 0, active: false, done: false, briefT: 0, missionCar: null, thugs: [] };
}

export function initBags(G) {
  // Nudge each spot out of any building so every bag can actually be reached.
  G.bags = BAG_SPOTS.map((s) => {
    const probe = { x: s.x, y: s.y };
    collideCircle(G.world, probe, 8);
    return { x: probe.x, y: probe.y, taken: false };
  });
}

function spawnMissionCar(G, which) {
  if (which === 'missionCar') {
    const chop = poiById('chop');
    const car = createCar(chop.door.x + 66, chop.door.y + 58, Math.PI, 'sport', '#e74c3c', G.rng);
    car.driver = null;
    car.mission = true;
    G.cars.push(car);
    return car;
  }
  // The Aurelion GT: parked uptown by the central avenue.
  const car = createCar(1560, 706, 0, 'luxury', '#f7dc6f', G.rng);
  car.driver = null;
  car.mission = true;
  G.cars.push(car);
  return car;
}

function spawnThugs(G) {
  const at = EXTRA_POINTS.lockup;
  const thugs = [];
  const spots = [[-46, -30], [38, -52], [6, 44]];
  for (const [dx, dy] of spots) {
    const thug = createPed(at.x + dx, at.y + dy, G.rng, { thug: true, color: '#2d3436' });
    G.peds.push(thug);
    thugs.push(thug);
  }
  return thugs;
}

export function startMission(G, index) {
  const story = G.story;
  story.index = index;
  story.stage = 0;
  story.active = true;
  story.briefT = 9;
  story.missionCar = null;
  story.thugs = [];
  const mission = MISSIONS[index];
  G.toast(`${mission.title} — $${mission.reward}`, 'info');
  prepareStage(G);
}

function prepareStage(G) {
  const story = G.story;
  const mission = MISSIONS[story.index];
  if (!mission) return;
  const stage = mission.stages[story.stage];
  if (!stage) return;
  if (stage.spawn && !story.missionCar) story.missionCar = spawnMissionCar(G, stage.spawn);
  if (stage.kind === 'thugs' && story.thugs.length === 0) story.thugs = spawnThugs(G);
}

export function currentObjective(G) {
  if (G.story.active && !G.story.done) {
    const mission = MISSIONS[G.story.index];
    const stage = mission.stages[G.story.stage];
    if (stage) {
      const point = stagePoint(stage);
      const focus = G.player.car || G.player;
      const dist = point ? Math.round(Math.hypot(point.x - focus.x, point.y - focus.y) / 10) : 0;
      return { text: stage.text, dist, point, mission: mission.title };
    }
  }
  if (G.errand && G.errand.active) {
    const focus = G.player.car || G.player;
    const dist = Math.round(Math.hypot(G.errand.x - focus.x, G.errand.y - focus.y) / 10);
    return { text: G.errand.text, dist, point: G.errand, mission: 'Errand' };
  }
  return null;
}

function completeStage(G) {
  const story = G.story;
  const mission = MISSIONS[story.index];
  story.stage += 1;
  G.audio.pickup();
  if (story.stage >= mission.stages.length) {
    // Job done.
    G.player.cash += mission.reward;
    G.stats.missionsDone += 1;
    G.audio.jingle();
    G.toast(`Job done: ${mission.title} — +$${mission.reward}`, 'good');
    clearHeat(G);
    if (story.missionCar) story.missionCar.mission = false;
    story.missionCar = null;
    story.thugs = [];
    if (story.index + 1 < MISSIONS.length) {
      startMission(G, story.index + 1);
    } else {
      story.active = false;
      story.done = true;
      G.toast('The coast is yours. Errands and cash bags still pay.', 'good');
    }
    saveGame(G);
  } else {
    prepareStage(G);
  }
}

export function updateMissions(G, dt) {
  const player = G.player;
  const story = G.story;
  if (story.briefT > 0) story.briefT -= dt;

  // Cash bags: walk or drive over one to pocket it.
  for (const bag of G.bags) {
    if (bag.taken) continue;
    const focus = player.car || player;
    if (Math.hypot(bag.x - focus.x, bag.y - focus.y) < 34) {
      bag.taken = true;
      player.cash += 150;
      G.stats.bagsFound += 1;
      G.audio.cash();
      G.toast(`Hidden cash bag — +$150 (${G.stats.bagsFound}/12)`, 'good');
    }
  }

  if (story.active && !story.done) {
    const mission = MISSIONS[story.index];
    const stage = mission.stages[story.stage];
    if (stage) {
      const point = stagePoint(stage);
      const focus = player.car || player;
      const d = point ? Math.hypot(point.x - focus.x, point.y - focus.y) : 0;
      let done = false;
      if (stage.kind === 'enterCar') done = !!player.car;
      else if (stage.kind === 'reach') done = d < stage.r;
      else if (stage.kind === 'reachFoot') done = !player.car && d < stage.r;
      else if (stage.kind === 'reachInCar') done = !!player.car && d < stage.r;
      else if (stage.kind === 'driveCar') done = !!player.car && player.car === story.missionCar;
      else if (stage.kind === 'thugs') done = story.thugs.every((t) => t.down);
      if (done) completeStage(G);
    }
    // Thugs shoot back while their stage is live.
    const liveStage = mission.stages[story.stage];
    if (liveStage && liveStage.kind === 'thugs') {
      for (const thug of story.thugs) {
        if (thug.down) continue;
        thug.shootCd -= dt;
        const target = player.car || player;
        const dist = Math.hypot(target.x - thug.x, target.y - thug.y);
        thug.aimAngle = Math.atan2(target.y - thug.y, target.x - thug.x);
        if (dist < 400 && thug.shootCd <= 0) {
          thug.shootCd = 1.15 + Math.random() * 0.5;
          G.thugShoot(thug);
        }
      }
    }
  }

  updateErrand(G, dt);
}

// Free-roam errands after (and between) story jobs: a fare, a drop-off, a payout.
export function updateErrand(G, dt) {
  const player = G.player;
  if (G.story.active && !G.story.done) return;
  if (!G.errand) {
    G.errandCd = (G.errandCd || 6) - dt;
    if (G.errandCd <= 0) {
      const spots = [
        { x: 1160, y: 622, name: 'Club Azul' }, { x: 2360, y: 1202, name: 'the Chop Shop' },
        { x: 1460, y: 2338, name: 'Sunfall Pier' }, { x: 560, y: 1782, name: 'the Hideout' },
        { x: 2790, y: 2076, name: 'the Lockup' }, { x: 1760, y: 530, name: 'the central park' },
        { x: 2660, y: 240, name: 'the north-east corner' },
      ];
      const spot = spots[Math.floor(G.rng() * spots.length)];
      const pay = 120 + Math.floor(G.rng() * 15) * 10;
      G.errand = { x: spot.x, y: spot.y, pay, active: true, text: `Errand: get to ${spot.name} — $${pay}` };
      G.toast(G.errand.text, 'info');
    }
    return;
  }
  const focus = player.car || player;
  if (Math.hypot(G.errand.x - focus.x, G.errand.y - focus.y) < 80) {
    player.cash += G.errand.pay;
    G.stats.errandsDone += 1;
    G.audio.jingle();
    G.toast(`Errand done — +$${G.errand.pay}`, 'good');
    G.errand = null;
    G.errandCd = 14;
    saveGame(G);
  }
}

/** Called by combat when a thug drops: count the lockup clear-out. */
export function onThugDown(G, thug) {
  G.toast('Rival down', 'info');
}
