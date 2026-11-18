// The live minimap: the whole city in a corner panel — avenues, the shore, every
// cruiser as a flashing blip, traffic as pale dots, the objective in gold, the mission
// car in red, unclaimed cash bags as tiny dollars, and Rico as a white arrow that
// turns with him (or with his car).

import { WORLD, ROADS_X, ROADS_Y, SAND_Y, WATER_Y } from './config.js';
import { currentObjective } from './missions.js';

export const MAP_W = 196;
export const MAP_H = 147;

export function drawMinimap(ctx, G, x, y, t) {
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, MAP_W, MAP_H);
  ctx.clip();
  // Land, sea and sand.
  ctx.fillStyle = '#8b9a7d';
  ctx.fillRect(x, y, MAP_W, MAP_H);
  ctx.fillStyle = '#eed49e';
  ctx.fillRect(x, y + SAND_Y * sy, MAP_W, (WATER_Y - SAND_Y) * sy);
  ctx.fillStyle = '#2b7ea6';
  ctx.fillRect(x, y + WATER_Y * sy, MAP_W, MAP_H - WATER_Y * sy);
  // Avenues.
  ctx.strokeStyle = 'rgba(40,44,50,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const rx of ROADS_X) { ctx.moveTo(x + rx * sx, y); ctx.lineTo(x + rx * sx, y + MAP_H); }
  for (const ry of ROADS_Y) { ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + MAP_W, y + ry * sy); }
  ctx.stroke();
  // Cash bags still out there.
  ctx.fillStyle = 'rgba(255,230,120,0.9)';
  ctx.font = 'bold 7px Arial, sans-serif';
  ctx.textAlign = 'center';
  for (const bag of G.bags) {
    if (!bag.taken) ctx.fillText('$', x + bag.x * sx, y + bag.y * sy + 2);
  }
  // Traffic.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const car of G.cars) {
    if (car.driver === 'traffic') ctx.fillRect(x + car.x * sx - 1.5, y + car.y * sy - 1.5, 3, 3);
  }
  // The mission car.
  if (G.story.missionCar && !G.story.missionCar.dead) {
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.arc(x + G.story.missionCar.x * sx, y + G.story.missionCar.y * sy, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips flash red/blue.
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    ctx.fillStyle = Math.floor(t * 5) % 2 === 0 ? '#ff3b30' : '#2d5bff';
    ctx.beginPath();
    ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Objective.
  const obj = currentObjective(G);
  if (obj && obj.point) {
    ctx.strokeStyle = '#ffd740';
    ctx.lineWidth = 2;
    const ox = x + obj.point.x * sx;
    const oy = y + obj.point.y * sy;
    ctx.beginPath();
    ctx.arc(ox, oy, 5 + Math.sin(t * 5) * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Rico.
  const player = G.player;
  const focus = player.car || player;
  const angle = player.car ? player.car.angle : player.aim;
  ctx.translate(x + focus.x * sx, y + focus.y * sy);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4.4, -4);
  ctx.lineTo(-4.4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Frame.
  ctx.strokeStyle = 'rgba(10,14,18,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, MAP_W, MAP_H);
}
