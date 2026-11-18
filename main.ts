// Sunfall City — the hand-in program for the gta6-01 entry (Node 22, standard library
// only). The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library, no network).
// This program first surveys what it is about to hand in — every game file counted and
// weighed, every screenshot's real dimensions read out of its own header — and refuses
// anything the scorer's caps would refuse. Then it copies game/ and screenshots/ to
// /output and writes /output/dossier.json with the vendored make.fun library.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with `node serve.ts` (http://localhost:8080).

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// ---------------------------------------------------------------------------
// Pre-flight survey (the entrant's own checks, run before anything is copied).

const CAPS = {
  gameMaxFiles: 993,
  gameMaxBytes: 50331648,
  gamePathMaxBytes: 1000,
  shotMaxCount: 4,
  shotMinCount: 3,
  shotMaxBytes: 262144,
  shotLongMax: 1280,
  shotShortMin: 480,
};

function walkFiles(root: string): string[] {
  const found: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) found.push(full);
    }
  }
  return found.sort();
}

function surveyGame(gameDir: string): { files: number; bytes: number } {
  if (!existsSync(join(gameDir, 'index.html'))) throw new Error('pre-flight: game/index.html is missing');
  const files = walkFiles(gameDir);
  let bytes = 0;
  for (const file of files) {
    const rel = relative(gameDir, file);
    if (Buffer.byteLength(rel, 'utf8') > CAPS.gamePathMaxBytes) {
      throw new Error(`pre-flight: game path over ${CAPS.gamePathMaxBytes} bytes: ${rel}`);
    }
    bytes += statSync(file).size;
  }
  if (files.length > CAPS.gameMaxFiles) throw new Error(`pre-flight: game/ holds ${files.length} files, over the ${CAPS.gameMaxFiles} cap`);
  if (bytes > CAPS.gameMaxBytes) throw new Error(`pre-flight: game/ weighs ${bytes} bytes, over the ${CAPS.gameMaxBytes} cap`);
  return { files: files.length, bytes };
}

/** Read a PNG or JPEG header and report the picture's true width and height. */
function imageSize(file: string): { w: number; h: number; kind: string } {
  const buf = readFileSync(file);
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), kind: 'PNG' };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), kind: 'JPEG' };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  throw new Error(`pre-flight: cannot read image dimensions from ${file}`);
}

function surveyScreenshots(dir: string): Array<{ name: string; w: number; h: number; bytes: number }> {
  if (!existsSync(dir)) throw new Error('pre-flight: screenshots/ is missing');
  const names = readdirSync(dir).filter((n) => !n.startsWith('.')).sort();
  if (names.length < CAPS.shotMinCount || names.length > CAPS.shotMaxCount) {
    throw new Error(`pre-flight: screenshots/ holds ${names.length} images, need ${CAPS.shotMinCount} to ${CAPS.shotMaxCount}`);
  }
  return names.map((name) => {
    const file = join(dir, name);
    const bytes = statSync(file).size;
    const size = imageSize(file);
    const long = Math.max(size.w, size.h);
    const short = Math.min(size.w, size.h);
    if (bytes > CAPS.shotMaxBytes) throw new Error(`pre-flight: ${name} is ${bytes} bytes, over the ${CAPS.shotMaxBytes} cap`);
    if (long > CAPS.shotLongMax) throw new Error(`pre-flight: ${name} long side ${long}, over ${CAPS.shotLongMax}`);
    if (short < CAPS.shotShortMin) throw new Error(`pre-flight: ${name} short side ${short}, under ${CAPS.shotShortMin}`);
    return { name, w: size.w, h: size.h, bytes };
  });
}

const gameSurvey = surveyGame(join(here, 'game'));
const shotSurvey = surveyScreenshots(join(here, 'screenshots'));
console.log(`sunfall hand-in: game ${gameSurvey.files} files, ${gameSurvey.bytes} bytes`);
for (const shot of shotSurvey) {
  console.log(`sunfall hand-in: screenshot ${shot.name} ${shot.w}x${shot.h}, ${shot.bytes} bytes`);
}

// ---------------------------------------------------------------------------
// The hand-in itself: copy the two trees, then write the dossier the judge reads.

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log('sunfall hand-in: dossier.json written');

// ---------------------------------------------------------------------------
// Fingerprint manifest: a SHA-256 of every file just handed in, folded into one
// root hash and printed to the run log, so the exact tree that was copied can be
// recognised later without trusting file sizes or timestamps.

function fingerprintTree(root: string): { lines: string[]; rootHash: string } {
  const lines: string[] = [];
  const fold = createHash('sha256');
  for (const file of walkFiles(root)) {
    const rel = relative(root, file).split('\\').join('/');
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
    lines.push(`${digest}  ${rel}`);
    fold.update(rel, 'utf8');
    fold.update('\0', 'utf8');
    fold.update(digest, 'utf8');
    fold.update('\n', 'utf8');
  }
  return { lines, rootHash: fold.digest('hex') };
}

const manifest = fingerprintTree(out);
for (const line of manifest.lines) console.log(`sunfall fingerprint: ${line}`);
console.log(`sunfall fingerprint: tree root sha256 ${manifest.rootHash} over ${manifest.lines.length} files`);
