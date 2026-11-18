// The camera: follows a target with a velocity look-ahead so driving at speed shows the
// road coming, eases back when the player slows, and never shows outside the city.

import { WORLD } from './config.js';

export function createCamera() {
  return { x: WORLD.width / 2, y: WORLD.height / 2, lookX: 0, lookY: 0 };
}

/**
 * Move the camera toward the target. viewW/viewH are the visible size in world units.
 * The look-ahead leads by up to ~0.55 s of velocity, smoothed so it never snaps.
 */
export function updateCamera(cam, dt, target, viewW, viewH) {
  const lead = 0.55;
  const wantX = target.x + (target.vx || 0) * lead;
  const wantY = target.y + (target.vy || 0) * lead;
  const ease = 1 - Math.pow(0.0015, dt); // frame-rate independent smoothing
  cam.lookX += (wantX - cam.lookX) * ease;
  cam.lookY += (wantY - cam.lookY) * ease;
  cam.x = clampView(cam.lookX, viewW, WORLD.width);
  cam.y = clampView(cam.lookY, viewH, WORLD.height);
}

function clampView(centre, view, world) {
  if (view >= world) return world / 2;
  const half = view / 2;
  return Math.min(world - half, Math.max(half, centre));
}

/** World-space rectangle the camera currently shows. */
export function cameraView(cam, viewW, viewH) {
  return { x: cam.x - viewW / 2, y: cam.y - viewH / 2, w: viewW, h: viewH };
}
