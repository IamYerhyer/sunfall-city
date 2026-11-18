// The HUD and the screens: health and bust bars, cash, flashing wanted stars, the
// objective line with its distance, the weapon readout, toasts and mission briefs —
// and the canvas-drawn start, pause, WASTED and BUSTED screens with their buttons.

import { WANTED } from './config.js';
import { currentObjective, MISSIONS } from './missions.js';
import { drawMinimap, MAP_W, MAP_H } from './minimap.js';
import { hasSave } from './save.js';

const FONT = 'Arial, sans-serif';

export function drawHUD(ctx, G, w, h, t) {
  const player = G.player;
  // Minimap, bottom-left, with the health bar under it.
  drawMinimap(ctx, G, 14, h - MAP_H - 48, t);
  bar(ctx, 14, h - 34, MAP_W, 11, player.health / 100, '#e84393', '#3a1426');
  ctx.fillStyle = '#fff';
  ctx.font = `bold 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 14, h - 38);
  if (G.wanted.bust > 0.01) {
    bar(ctx, 14, h - 18, MAP_W, 7, G.wanted.bust, '#f7d774', '#3a3214');
    ctx.fillStyle = '#f7d774';
    ctx.font = `bold 9px ${FONT}`;
    ctx.fillText('BUSTED?', 14, h - 21);
  }

  // Cash and wanted stars, top-right.
  ctx.textAlign = 'right';
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillStyle = '#7bed9f';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(`$${player.cash.toLocaleString('en-US')}`, w - 18, 36);
  ctx.shadowBlur = 0;
  drawStars(ctx, G, w - 18, 52, t);
  if (player.car) {
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const hp = Math.max(0, Math.round(player.car.hp));
    ctx.fillText(`${player.car.kind === 'police' ? 'SFPD Cruiser' : 'Vehicle'} · condition ${hp}%`, w - 18, 96);
  }

  // Weapon, bottom-right.
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('PISTOL', w - 18, h - 18);
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(player.car ? 'click: fire from the car' : 'click: fire · E: enter car', w - 18, h - 34);

  // Objective, top-centre.
  const obj = currentObjective(G);
  if (obj) {
    ctx.textAlign = 'center';
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillStyle = '#ffd740';
    ctx.fillText((obj.mission || '').toUpperCase(), w / 2, 24);
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 5;
    ctx.fillText(`${obj.text}${obj.point ? `  ·  ${obj.dist} m` : ''}`, w / 2, 48);
    ctx.shadowBlur = 0;
  }

  // Mission brief card while it lasts.
  if (G.story.active && G.story.briefT > 0) {
    const mission = MISSIONS[G.story.index];
    panel(ctx, w / 2 - 300, 66, 600, 86);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd740';
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(mission.title, w / 2, 90);
    ctx.fillStyle = '#f1f2f6';
    ctx.font = `13.5px ${FONT}`;
    wrapText(ctx, mission.brief, w / 2, 112, 560, 17);
  }

  // Toasts, stacked under the brief.
  let ty = G.story.briefT > 0 ? 168 : 76;
  for (const toast of G.toasts) {
    ctx.textAlign = 'center';
    ctx.font = `bold 15px ${FONT}`;
    const tw = ctx.measureText(toast.text).width + 30;
    ctx.fillStyle = 'rgba(12,16,22,0.72)';
    ctx.fillRect(w / 2 - tw / 2, ty - 17, tw, 26);
    ctx.fillStyle = toast.kind === 'bad' ? '#ff7675' : toast.kind === 'good' ? '#7bed9f' : '#dfe6e9';
    ctx.fillText(toast.text, w / 2, ty + 2);
    ty += 32;
  }

  // Low-health vignette pulse.
  if (player.health < 30 && player.health > 0) {
    ctx.fillStyle = `rgba(200,30,30,${0.1 + Math.sin(t * 6) * 0.05})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawStars(ctx, G, rightX, y, t) {
  const stars = G.wanted.stars;
  const flash = G.wanted.flashT > 0 && Math.floor(t * 7) % 2 === 0;
  ctx.font = '24px Arial, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < WANTED.maxStars; i += 1) {
    const x = rightX - i * 27;
    if (i < stars) {
      ctx.fillStyle = flash ? '#ffffff' : '#ffd740';
      ctx.fillText('★', x, y + 22);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillText('★', x, y + 22);
    }
  }
}

export function bar(ctx, x, y, w, h, frac, color, back) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,15,22,0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,215,64,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}

export function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
  return yy;
}

// ------------------------------------------------------------------ screens

export function menuButtons(G, w, h) {
  const cx = w / 2;
  if (G.screen === 'title') {
    const buttons = [{ id: 'new', label: 'NEW GAME', x: cx - 120, y: h * 0.6, w: 240, h: 46 }];
    if (hasSave()) buttons.push({ id: 'continue', label: 'CONTINUE', x: cx - 120, y: h * 0.6 + 58, w: 240, h: 46 });
    return buttons;
  }
  if (G.screen === 'pause') {
    return [
      { id: 'resume', label: 'RESUME', x: cx - 120, y: h * 0.42, w: 240, h: 44 },
      { id: 'save', label: 'SAVE GAME', x: cx - 120, y: h * 0.42 + 54, w: 240, h: 44 },
      { id: 'restart', label: 'NEW GAME', x: cx - 120, y: h * 0.42 + 108, w: 240, h: 44 },
      { id: 'mute', label: G.audio.isMuted() ? 'SOUND: OFF' : 'SOUND: ON', x: cx - 120, y: h * 0.42 + 162, w: 240, h: 44 },
    ];
  }
  if (G.screen === 'wasted' || G.screen === 'busted') {
    return [{ id: 'respawn', label: 'CONTINUE', x: cx - 110, y: h * 0.62, w: 220, h: 46 }];
  }
  return [];
}

export function drawScreens(ctx, G, w, h, t) {
  const input = G.input;
  if (G.screen === 'title') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(16,24,38,0.42)');
    grad.addColorStop(0.55, 'rgba(16,24,38,0.18)');
    grad.addColorStop(1, 'rgba(16,24,38,0.66)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd740';
    ctx.font = 'bold 84px Georgia, serif';
    ctx.shadowColor = 'rgba(255,120,60,0.55)';
    ctx.shadowBlur = 26;
    ctx.fillText('SUNFALL CITY', w / 2, h * 0.3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f1f2f6';
    ctx.font = 'italic 19px Georgia, serif';
    ctx.fillText('An original open-world crime story on one sun-soaked coast', w / 2, h * 0.3 + 40);
    ctx.font = `15.5px ${FONT}`;
    wrapText(ctx, 'Rico Marlin washes up in Sunfall with $40 and a borrowed name. Marina Voss runs the coast — her nightclub, her chop shop, her rules. Drive her four jobs, outrun the SFPD, and the streets are yours.', w / 2, h * 0.42, 640, 22);
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('WASD drive & walk · mouse aim · click fire · E enter/exit car · Shift sprint · Space handbrake · P pause · M mute', w / 2, h * 0.42 + 58);
    drawButtons(ctx, G, w, h, input);
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('Every car in Sunfall can be yours. So can every consequence.', w / 2, h - 22);
  } else if (G.screen === 'pause') {
    ctx.fillStyle = 'rgba(8,12,18,0.66)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('PAUSED', w / 2, h * 0.32);
    drawButtons(ctx, G, w, h, input);
  } else if (G.screen === 'wasted' || G.screen === 'busted') {
    ctx.fillStyle = G.screen === 'wasted' ? 'rgba(60,4,4,0.55)' : 'rgba(6,16,44,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.font = 'bold 88px Georgia, serif';
    ctx.fillStyle = G.screen === 'wasted' ? '#ff3b30' : '#5aa2ff';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText(G.screen === 'wasted' ? 'WASTED' : 'BUSTED', w / 2, h * 0.42);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f1f2f6';
    ctx.font = `17px ${FONT}`;
    ctx.fillText(G.screen === 'wasted'
      ? `Sunfall General patches Rico up. The bill: $${G.lastFine}.`
      : `The SFPD impound the moment. Fine: $${G.lastFine}, and the heat is gone.`, w / 2, h * 0.42 + 44);
    drawButtons(ctx, G, w, h, input);
  }
}

function drawButtons(ctx, G, w, h, input) {
  for (const b of menuButtons(G, w, h)) {
    const hover = input.mouse.x >= b.x && input.mouse.x <= b.x + b.w && input.mouse.y >= b.y && input.mouse.y <= b.y + b.h;
    ctx.fillStyle = hover ? '#ffd740' : 'rgba(14,20,30,0.85)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#ffd740';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = hover ? '#14181d' : '#ffd740';
    ctx.font = `bold 19px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 7);
  }
}

/** Which button a click lands on, if any. */
export function buttonAt(G, w, h, x, y) {
  for (const b of menuButtons(G, w, h)) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}
