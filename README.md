# IamYerhyer/sunfall-city

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/IamYerhyer/sunfall-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/IamYerhyer/sunfall-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Sunfall City** is an original open-world crime game that runs in a desktop browser
from static files — no build step, no network, no libraries. Rico Marlin washes up in
the sun-soaked coastal city of Sunfall with $40 to his name. Marina Voss runs the
coast — her nightclub, her chop shop, her rules — and Rico drives his way up her crew
across four story jobs, then owns the streets in free roam.

Explore a 3200×2400 city on foot or in any car you can steal: five avenues of traffic
that follows lanes and brakes for jaywalkers, pedestrians who stroll, chat and flee,
pastel blocks with lit windows and rooftop clutter, parks, a beach with animated
water, and the Sunfall Pier. Crimes raise a 1–5 star wanted level; SFPD cruisers
spawn, pursue, ram and try to bust you on foot. The HUD carries health, a bust meter,
cash, flashing wanted stars, the current objective with its distance, and a live
minimap with police blips, the mission car and the objective marker.

## Controls

- **WASD / arrows** — walk and drive
- **Mouse** — aim · **click** — fire the pistol (on foot or from the driver's seat)
- **E / F** — enter or exit any car (steal it, if someone is driving)
- **Shift** — sprint · **Space** — handbrake
- **P / Esc** — pause · **M** — mute · **K** — quick-save

## The story

1. **Welcome to Sunfall** ($300) — take a car, collect Marina's package at Club Azul, deliver it to Marlo's Chop Shop.
2. **Coast Run** ($700) — deliver the Comet GT to Sunfall Pier with the paint still on.
3. **Hot Property** ($900) — steal the Aurelion GT uptown and reach the Harbour Hideout.
4. **Marina's Regards** ($1,500) — quiet the three rival drivers at the east beach lockup, then return to Club Azul a made man.

After the story: endless paid errands, and 12 hidden cash bags ($150 each) tucked in
alleys, parks and at the pier's end. Progress saves to the browser (Continue on the
title screen). WASTED sends you to Sunfall General; BUSTED, to SFPD HQ — both charge
for the privilege.

## Run it

```sh
node serve.ts            # serves game/ at http://localhost:8080
# or any static file server pointed at game/
node main.ts             # hand-in: writes game/, screenshots/ and dossier.json to /output
```

Sound is synthesised live with WebAudio (engine, sirens, gunshots, crashes, jingles) —
there are no audio files. All art is drawn in code on a 2D canvas.

---

<sub>Built for [make.fun](https://make.fun/?ref=cfpg3p8n) — bounty [gta6-01](https://make.fun/bounty/gta6-01).</sub>
