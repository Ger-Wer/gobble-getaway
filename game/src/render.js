// Canvas renderer: the autumn farm, the kitchen, Mabel and Brindle, the
// end-screen scenes. Everything is vector art drawn from the palette in
// config.js; no image assets, no randomness (decoration comes from hashNoise
// so a given state always paints the same frame).
//
// Every shape is drawn in absolute field coordinates with the plain, boring
// canvas calls (clamped fillRects, straight-line polygons, full circles and
// linear gradients) — no context transforms, no canvas text. All readable
// text lives in the DOM overlay that main.js updates, so the pictures here
// are pure scenery.

import {
  FIELD, GROUND_Y, PPM, STAGES, PALETTE as P,
} from './config.js';
import { hashNoise } from './random.js';
import { ovenFlamePhase } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(s, screen) {
      if (screen === SCREEN_TITLE) drawTitle(ctx, s);
      else if (screen === SCREEN_OVER) { drawWorld(ctx, s); drawEndArt(ctx, s); }
      else drawWorld(ctx, s);
    },
  };
}

// ---------- small helpers ----------
//
// The field is a fixed 1280x720 area. These helpers keep every primitive
// inside it: a fillRect that started off-canvas would otherwise be dropped
// by simple renderers, so rects are clamped to the field before drawing.

function sRect(ctx, x, y, w, h) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(FIELD.width, Math.ceil(x + w));
  const y1 = Math.min(FIELD.height, Math.ceil(y + h));
  if (x1 <= x0 || y1 <= y0) return;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

/** Fill a straight-line polygon from [x, y] points. */
function poly(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

/** An ellipse as a 16-point polygon, rotated by `ang` around its centre. */
function ePoly(ctx, cx, cy, rx, ry, ang = 0, n = 16) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const px = Math.cos(a) * rx;
    const py = Math.sin(a) * ry;
    pts.push([cx + px * ca - py * sa, cy + px * sa + py * ca]);
  }
  poly(ctx, pts);
}

/** A full circle. */
function circle(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
}

/** The upper half of a circle as a polygon (a dome with a flat bottom). */
function dome(ctx, cx, cy, r, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = Math.PI - (i / n) * Math.PI;
    pts.push([cx + Math.cos(a) * r, cy - Math.sin(a) * r]);
  }
  poly(ctx, pts);
}

/** A thin bar as a polygon, rotated by `ang` around (cx, cy). */
function bar(ctx, cx, cy, w, h, ang) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const hw = w / 2;
  const hh = h / 2;
  const c = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  poly(ctx, c.map(([px, py]) => [cx + px * ca - py * sa, cy + px * sa + py * ca]));
}

/** One stroked straight segment. */
function seg(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** An 8-pointed star outline, filled by the caller. */
function starPts(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 8; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.4;
    const a = (i * Math.PI) / 4;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return pts;
}

/** A quadratic curve as two straight segments (the midpoint is exact). */
function quadSegs(p0, p1, p2) {
  return [p0, [(p0[0] + 2 * p1[0] + p2[0]) / 4, (p0[1] + 2 * p1[1] + p2[1]) / 4], p2];
}

/** Repeated decoration position: `i`th item of a tile repeated every `gap` px
 *  scrolled by `offset`, mapped into [fromX, toX] with wrap. */
function tileX(offset, i, gap, span) {
  const n = Math.floor(span / gap) + 2;
  const base = -((offset % gap) + gap) % gap;
  return base + i * gap - gap;
}

// ---------- background ----------

function skyGradient(ctx, top, bottom, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  sRect(ctx, 0, 0, FIELD.width, h);
}

function drawSun(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  circle(ctx, x, y, r * 1.5);
  ctx.fill();
  ctx.globalAlpha = 1;
  circle(ctx, x, y, r);
  ctx.fill();
}

function drawCloud(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(255, 244, 220, 0.85)';
  circle(ctx, x, y, 22 * s);
  ctx.fill();
  circle(ctx, x + 26 * s, y - 10 * s, 26 * s);
  ctx.fill();
  circle(ctx, x + 56 * s, y, 22 * s);
  ctx.fill();
}

function drawBarn(ctx, x, y, s) {
  // red barn with a white door, beside a silo
  sRect(ctx, x + 150 * s, y - 150 * s, 46 * s, 150 * s);
  ctx.fillStyle = P.siloTop;
  dome(ctx, x + 173 * s, y - 148 * s, 23 * s);
  ctx.fill();
  ctx.fillStyle = P.barn;
  sRect(ctx, x, y - 110 * s, 140 * s, 110 * s);
  ctx.fillStyle = P.barnRoof;
  poly(ctx, [[x - 10 * s, y - 110 * s], [x + 70 * s, y - 150 * s], [x + 150 * s, y - 110 * s]]);
  ctx.fill();
  ctx.fillStyle = P.barnDoor;
  sRect(ctx, x + 48 * s, y - 62 * s, 44 * s, 62 * s);
  ctx.strokeStyle = P.barnRoof;
  ctx.lineWidth = 3 * s;
  seg(ctx, x + 48 * s, y - 62 * s, x + 92 * s, y);
  seg(ctx, x + 92 * s, y - 62 * s, x + 48 * s, y);
}

function drawPumpkinPatch(ctx, x, y, s) {
  ctx.fillStyle = P.pumpkin;
  for (let i = 0; i < 3; i += 1) {
    const px = x + i * 20 * s;
    ePoly(ctx, px, y - 8 * s, 11 * s, 9 * s);
    ctx.fill();
  }
  ctx.strokeStyle = P.pumpkinStem;
  ctx.lineWidth = 3 * s;
  seg(ctx, x + 10 * s, y - 16 * s, x + 14 * s, y - 22 * s);
}

function drawCornStalk(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4 * s;
  seg(ctx, x, y, x, y - 60 * s);
  ctx.fillStyle = color;
  for (let i = 1; i <= 3; i += 1) {
    ePoly(ctx, x + (i % 2 ? 10 : -10) * s, y - (14 + i * 12) * s, 16 * s, 5 * s, i % 2 ? -0.5 : 0.5);
    ctx.fill();
  }
}

function drawWindowFrame(ctx, x, y, s) {
  ctx.fillStyle = '#f0e0bd';
  sRect(ctx, x - 6 * s, y - 6 * s, 104 * s, 104 * s);
  const g = ctx.createLinearGradient(0, y, 0, y + 92 * s);
  g.addColorStop(0, P.windowSky);
  g.addColorStop(1, '#e8842c');
  ctx.fillStyle = g;
  sRect(ctx, x, y, 92 * s, 92 * s);
  // a little barn on the horizon, seen through the window
  ctx.fillStyle = 'rgba(90, 40, 25, 0.8)';
  sRect(ctx, x + 58 * s, y + 44 * s, 22 * s, 18 * s);
  poly(ctx, [[x + 55 * s, y + 44 * s], [x + 69 * s, y + 36 * s], [x + 83 * s, y + 44 * s]]);
  ctx.fill();
  ctx.fillStyle = '#f0e0bd';
  sRect(ctx, x + 43 * s, y, 6 * s, 92 * s);
  sRect(ctx, x, y + 43 * s, 92 * s, 6 * s);
}

function drawLamp(ctx, x, y, s) {
  ctx.strokeStyle = '#4a2a17';
  ctx.lineWidth = 3 * s;
  seg(ctx, x, 40, x, y - 26 * s);
  ctx.fillStyle = '#5d381f';
  poly(ctx, [[x - 22 * s, y - 26 * s], [x + 22 * s, y - 26 * s], [x + 12 * s, y - 4 * s], [x - 12 * s, y - 4 * s]]);
  ctx.fill();
  ctx.fillStyle = P.flame;
  ctx.globalAlpha = 0.9;
  circle(ctx, x, y, 6 * s);
  ctx.fill();
  ctx.globalAlpha = 0.18;
  circle(ctx, x, y, 34 * s);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPieTable(ctx, x, y, s) {
  ctx.fillStyle = '#6f381f';
  sRect(ctx, x, y - 44 * s, 110 * s, 10 * s);
  sRect(ctx, x + 8 * s, y - 34 * s, 10 * s, 34 * s);
  sRect(ctx, x + 92 * s, y - 34 * s, 10 * s, 34 * s);
  ctx.fillStyle = '#f0e0bd';
  ePoly(ctx, x + 55 * s, y - 52 * s, 30 * s, 8 * s);
  ctx.fill();
  ctx.fillStyle = P.pumpkin;
  dome(ctx, x + 55 * s, y - 56 * s, 16 * s);
  ctx.fill();
  sRect(ctx, x + 39 * s, y - 58 * s, 32 * s, 6 * s);
  ctx.strokeStyle = 'rgba(255, 243, 221, 0.5)';
  ctx.lineWidth = 2 * s;
  poly(ctx, quadSegs([x + 50 * s, y - 80 * s], [x + 56 * s, y - 88 * s], [x + 52 * s, y - 96 * s]), false);
  ctx.stroke();
  poly(ctx, quadSegs([x + 62 * s, y - 82 * s], [x + 68 * s, y - 90 * s], [x + 64 * s, y - 98 * s]), false);
  ctx.stroke();
}

function drawFarmyardBg(ctx, camera, time) {
  skyGradient(ctx, P.skyTop, P.skyBottom, 560);
  drawSun(ctx, 1060, 130, 52, P.sun);
  for (let i = 0; i < 4; i += 1) {
    const x = tileX(camera * 0.1 + time * 6, i, 380, 1600);
    if (x > -80 && x < FIELD.width + 80) drawCloud(ctx, x, 90 + i * 34, 0.8 + (i % 2) * 0.4);
  }
  // rolling hills
  ctx.fillStyle = P.hill;
  const hill = [[0, 560]];
  for (let x = 0; x <= FIELD.width; x += 32) {
    const wx = x + camera * 0.25;
    hill.push([x, 470 + Math.sin(wx / 240) * 26 + Math.sin(wx / 97) * 10]);
  }
  hill.push([FIELD.width, 560]);
  poly(ctx, hill);
  ctx.fill();
  // barns anchored in world space, slow parallax
  const barnX = tileX(camera * 0.3, 0, 3400, 1280 + 3400);
  if (barnX > -260 && barnX < FIELD.width + 60) drawBarn(ctx, barnX, 500, 1);
  // pumpkin patch row
  for (let i = 0; i < 16; i += 1) {
    const x = tileX(camera * 0.6, i, 130, 1280 + 260);
    if (x > -60 && x < FIELD.width + 60 && hashNoise(i * 7 + Math.floor(camera * 0.6 / 130)) > -0.4) drawPumpkinPatch(ctx, x, 588, 0.8);
  }
}

function drawCornMazeBg(ctx, camera, time) {
  skyGradient(ctx, P.skyTopGold, P.skyBottomGold, 560);
  drawSun(ctx, 640, 110, 64, '#fff7d6');
  for (let i = 0; i < 4; i += 1) {
    const x = tileX(camera * 0.1 + time * 5, i, 420, 1600);
    if (x > -80 && x < FIELD.width + 80) drawCloud(ctx, x, 80 + i * 30, 0.9);
  }
  // far corn row
  for (let i = 0; i < 20; i += 1) {
    const x = tileX(camera * 0.4, i, 90, 1280 + 180);
    if (x > -30 && x < FIELD.width + 30) drawCornStalk(ctx, x, 566, 0.8, 'rgba(201, 143, 31, 0.55)');
  }
  // near corn row
  for (let i = 0; i < 14; i += 1) {
    const x = tileX(camera * 0.7, i, 130, 1280 + 260);
    if (x > -30 && x < FIELD.width + 30) drawCornStalk(ctx, x, 600, 1.5, P.cornGoldDark);
  }
}

function drawKitchenBg(ctx, camera) {
  skyGradient(ctx, P.wall, P.wallDark, 606);
  // ceiling band
  ctx.fillStyle = '#5d2f18';
  sRect(ctx, 0, 0, FIELD.width, 40);
  for (let i = 0; i < 5; i += 1) {
    const x = tileX(camera * 0.55, i, 420, 1280 + 420);
    if (x > -60 && x < FIELD.width + 60) {
      sRect(ctx, x, 40, 26, 26);
      drawLamp(ctx, x + 13, 78, 1);
    }
  }
  // windows with the farm sunset outside
  for (let i = 0; i < 4; i += 1) {
    const x = tileX(camera * 0.35, i, 500, 1280 + 500);
    if (x > -140 && x < FIELD.width + 140) drawWindowFrame(ctx, x, 130, 1);
  }
  // wainscot
  ctx.fillStyle = P.wainscot;
  sRect(ctx, 0, 470, FIELD.width, 136);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 10; i += 1) {
    const x = tileX(camera * 0.55, i, 160, 1280 + 320);
    sRect(ctx, x + 20, 486, 120, 104);
  }
  // a pie table past the counter
  for (let i = 0; i < 3; i += 1) {
    const x = tileX(camera * 0.75, i, 700, 1280 + 700);
    if (x > -160 && x < FIELD.width + 160) drawPieTable(ctx, x, 560, 1.1);
  }
  // checkered floor
  const gap = 64;
  for (let row = 0; row < 2; row += 1) {
    const y = 606 + row * 57;
    const off = Math.floor(camera / gap) % 2 === 0 ? 0 : gap / 2;
    for (let i = -1; i < 24; i += 1) {
      ctx.fillStyle = (i + row) % 2 === 0 ? P.floorA : P.floorB;
      sRect(ctx, i * gap - (camera % gap) - off + (row % 2) * 32, y, gap, 57);
    }
  }
}

function drawGroundBand(ctx, camera, stageIndex) {
  if (stageIndex === 2) return; // kitchen has its own floor
  ctx.fillStyle = stageIndex === 1 ? P.cornGold : P.field;
  sRect(ctx, 0, GROUND_Y, FIELD.width, FIELD.height - GROUND_Y);
  ctx.fillStyle = stageIndex === 1 ? P.cornGoldDark : P.fieldDark;
  sRect(ctx, 0, GROUND_Y, FIELD.width, 10);
  // tufts and fallen leaves
  for (let i = 0; i < 26; i += 1) {
    const x = tileX(camera, i, 64, 1280 + 128);
    if (x < -20 || x > FIELD.width + 20) continue;
    const n = hashNoise(i * 31);
    if (n > 0.1) {
      ctx.strokeStyle = P.grassTuft;
      ctx.lineWidth = 3;
      const y = GROUND_Y + 14 + n * 50;
      seg(ctx, x, y, x - 5, y - 10);
      seg(ctx, x, y, x + 1, y - 12);
      seg(ctx, x, y, x + 6, y - 9);
    } else {
      ctx.fillStyle = P.leaf[i % P.leaf.length];
      // a small leaf as a rotated four-point diamond
      const ly = GROUND_Y + 20 + n * 60;
      const a = n * 3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const c = [[7, 0], [0, 4], [-7, 0], [0, -4]];
      poly(ctx, c.map(([px, py]) => [x + px * ca - py * sa, ly + px * sa + py * ca]));
      ctx.fill();
    }
  }
}

/** The whole background of the current stage, with a crossfade when Mabel
 *  crosses a stage boundary. */
function drawBackground(ctx, s) {
  const camera = s.dist * PPM;
  const i = s.stageIndex;
  if (i === 0) drawFarmyardBg(ctx, camera, s.time);
  else if (i === 1) drawCornMazeBg(ctx, camera, s.time);
  else drawKitchenBg(ctx, camera);
  const next = i + 1;
  if (next < STAGES.length) {
    const b = STAGES[i].to;
    if (s.dist > b - 26) {
      const a = Math.min(1, (s.dist - (b - 26)) / 52);
      ctx.globalAlpha = a;
      if (next === 1) drawCornMazeBg(ctx, camera, s.time);
      else drawKitchenBg(ctx, camera);
      ctx.globalAlpha = 1;
    }
  }
  drawGroundBand(ctx, camera, i);
}

// ---------- the characters ----------
//
// Both characters are drawn relative to (cx, cy) — the point at their feet —
// scaled by s. Every local point is turned into an absolute field point by
// hand; there are no context transforms in this file.

function shadow(ctx, x, w) {
  ctx.fillStyle = 'rgba(40, 20, 5, 0.28)';
  ePoly(ctx, x, GROUND_Y + 8, w, 9);
  ctx.fill();
}

/** Draw Mabel, feet at (cx, cy), scaled by s. `pose` carries the animation
 *  state; the title and end screens pass their own idle poses. */
function drawMabel(ctx, cx, cy, s, pose, time) {
  const f = pose.facing || 1;
  const duck = pose.duck;
  const air = !pose.onGround;
  if (pose.invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
  shadow(ctx, cx, 42 * s * (1 - Math.min(1, pose.y / 420) * 0.4));
  const X = (lx) => cx + lx * s;
  const Y = (ly) => cy + ly * s;
  // legs
  ctx.strokeStyle = P.turkeyBeak;
  ctx.lineWidth = 4 * s;
  ctx.lineCap = 'round';
  const lift = air ? 6 : 0;
  const ph = Math.sin(pose.wingT);
  if (air) {
    seg(ctx, X(-6), Y(-14 + lift), X(-6), Y(0));
    seg(ctx, X(8), Y(-14 + lift), X(10), Y(0));
  } else {
    seg(ctx, X(-6), Y(-14), X(-6 - 7 * ph), Y(0));
    seg(ctx, X(8), Y(-14), X(8 - 7 * ph), Y(0));
  }
  // tail fan, behind the body
  const spread = air ? 1.5 : (pose.stumble > 0 ? 2.1 : 1.0);
  const tx = X(-24 * f);
  const ty = Y(-26);
  for (let i = 0; i < 5; i += 1) {
    const a = (-0.9 + i * 0.45) * spread + (f === 1 ? Math.PI : 0);
    ctx.fillStyle = P.turkeyTail[i % 3];
    // each feather is a slim bar fanned out from the pivot
    const fx = tx + Math.cos(a) * -16 * s;
    const fy = ty + Math.sin(a) * -16 * s;
    bar(ctx, fx, fy, 32 * s, 13 * s, a);
    ctx.fill();
  }
  // body
  const bodyRy = duck ? 15 : (air ? 21 : 24);
  const bodyY = duck ? -16 : -26;
  ctx.fillStyle = P.turkeyBody;
  ePoly(ctx, X(-2 * f), Y(bodyY), 27 * s, bodyRy * s);
  ctx.fill();
  // wing
  const wAng = air ? Math.sin(pose.wingT * 2.4) * 0.9 - 0.3 : Math.sin(pose.wingT) * 0.14;
  const wx = X(2 * f) + Math.cos(wAng) * -4 * f * s;
  const wy = Y(bodyY + 2) + Math.sin(wAng) * -4 * f * s;
  ctx.fillStyle = P.turkeyWing;
  bar(ctx, wx, wy, 30 * s, 18 * s, 0.3 * f + wAng);
  ctx.fill();
  // neck and head
  const hx = X(24 * f);
  const hy = Y(duck ? -26 : -46);
  ctx.strokeStyle = P.turkeyNeck;
  ctx.lineWidth = 8 * s;
  seg(ctx, X(14 * f), Y(bodyY - 8), hx, hy);
  ctx.fillStyle = P.turkeyHead;
  circle(ctx, hx, hy, 9.5 * s);
  ctx.fill();
  // comb and wattle
  ctx.fillStyle = P.turkeyComb;
  circle(ctx, hx - 3 * f * s, hy - 10 * s, 3.6 * s);
  ctx.fill();
  circle(ctx, hx + 2 * f * s, hy - 11 * s, 3.2 * s);
  ctx.fill();
  ctx.fillStyle = P.turkeyWattle;
  circle(ctx, hx + 5 * f * s, hy + 8 * s, 3.4 * s);
  ctx.fill();
  // beak and eye
  ctx.fillStyle = P.turkeyBeak;
  poly(ctx, [[hx + 8 * f * s, hy - 2 * s], [hx + 17 * f * s, hy + 1 * s], [hx + 8 * f * s, hy + 4 * s]]);
  ctx.fill();
  ctx.fillStyle = '#fff';
  circle(ctx, hx + 3 * f * s, hy - 3 * s, 3.4 * s);
  ctx.fill();
  ctx.fillStyle = '#241812';
  circle(ctx, hx + 4 * f * s, hy - 3 * s, 1.7 * s);
  ctx.fill();
  // dizzy stars while stumbling
  if (pose.stumble > 0) {
    ctx.fillStyle = P.textGold;
    for (let i = 0; i < 3; i += 1) {
      const a = time * 5 + i * 2.1;
      poly(ctx, starPts(Math.cos(a) * 20 * s, hy - 18 * s + Math.sin(a) * 6 * s, 4 * s));
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Farmer Brindle, feet at (cx, cy), scaled by s, always facing right. */
function drawFarmer(ctx, cx, cy, s, mode, time) {
  const X = (lx) => cx + lx * s;
  const Y = (ly) => cy + ly * s;
  shadow(ctx, cx, 40 * s);
  const run = mode === 'chase' || mode === 'lunge';
  const ph = Math.sin(time * 13);
  // legs
  ctx.strokeStyle = '#3d3128';
  ctx.lineWidth = 9 * s;
  ctx.lineCap = 'round';
  seg(ctx, X(-8), Y(-44), X(-8 + (run ? 11 * ph : 0)), Y(0));
  seg(ctx, X(8), Y(-44), X(8 + (run ? -11 * ph : 0)), Y(0));
  // torso: shirt then overalls
  ctx.fillStyle = P.farmerShirt;
  sRect(ctx, X(-20), Y(-88), 40 * s, 26 * s);
  ctx.fillStyle = P.farmerOveralls;
  sRect(ctx, X(-18), Y(-70), 36 * s, 30 * s);
  sRect(ctx, X(-14), Y(-80), 7 * s, 12 * s);
  sRect(ctx, X(7), Y(-80), 7 * s, 12 * s);
  // back arm swings
  ctx.strokeStyle = P.farmerShirt;
  ctx.lineWidth = 8 * s;
  seg(ctx, X(-14), Y(-80), X(-22 - (run ? 6 * ph : 0)), Y(-56));
  // head
  ctx.fillStyle = P.farmerSkin;
  circle(ctx, X(2), Y(-100), 13 * s);
  ctx.fill();
  // mustache and eye
  ctx.strokeStyle = P.farmerHair;
  ctx.lineWidth = 4 * s;
  poly(ctx, [[X(6), Y(-95)], [X(11), Y(-93)], [X(15), Y(-96)]], false);
  ctx.stroke();
  ctx.fillStyle = '#241812';
  circle(ctx, X(9), Y(-103), 2 * s);
  ctx.fill();
  if (mode !== 'rest') {
    ctx.strokeStyle = '#5d381f';
    ctx.lineWidth = 2.5 * s;
    seg(ctx, X(5), Y(-109), X(12), Y(-106));
  }
  // straw hat
  ctx.fillStyle = P.farmerHat;
  ePoly(ctx, X(2), Y(-110), 21 * s, 5.5 * s);
  ctx.fill();
  dome(ctx, X(2), Y(-112), 11 * s);
  ctx.fill();
  ctx.fillStyle = P.farmerHatBand;
  sRect(ctx, X(-9), Y(-114), 22 * s, 4 * s);
  // front arm with the pan
  const tele = mode === 'telegraph';
  const panX = mode === 'rest' ? 24 : (tele ? 26 : (mode === 'lunge' ? 44 : 32));
  const panY = mode === 'rest' ? -52 : (tele ? -128 : (mode === 'lunge' ? -60 : -78));
  ctx.strokeStyle = P.farmerShirt;
  ctx.lineWidth = 8 * s;
  seg(ctx, X(14), Y(-80), X(panX - 8), Y(panY + 8));
  ctx.fillStyle = P.farmerPan;
  circle(ctx, X(panX), Y(panY), 13 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  circle(ctx, X(panX - 4), Y(panY - 4), 5 * s);
  ctx.fill();
  ctx.strokeStyle = P.farmerPanHandle;
  ctx.lineWidth = 5 * s;
  seg(ctx, X(panX - 12), Y(panY + 6), X(panX - 22), Y(panY + 12));
  // lunge speed lines
  if (mode === 'lunge') {
    ctx.strokeStyle = 'rgba(60, 30, 10, 0.5)';
    ctx.lineWidth = 3 * s;
    for (let i = 0; i < 3; i += 1) {
      seg(ctx, X(-30 - i * 10), Y(-70 + i * 16), X(-52 - i * 10), Y(-70 + i * 16));
    }
  }
}

// ---------- hazards and corn ----------

function drawCorn(ctx, x, y, t) {
  ctx.fillStyle = '#7d9c3f';
  ePoly(ctx, x - 5, y + 8, 5, 10, -0.5);
  ctx.fill();
  ePoly(ctx, x + 5, y + 8, 5, 10, 0.5);
  ctx.fill();
  ctx.fillStyle = P.cornGold;
  ePoly(ctx, x, y, 6.5, 11);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = -1; i <= 1; i += 1) {
    circle(ctx, x + i * 3, y - 4 + Math.abs(i) * 3, 1.4);
    ctx.fill();
  }
  const tw = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.fillStyle = `rgba(255, 240, 180, ${0.35 + 0.4 * tw})`;
  poly(ctx, starPts(x + 9, y - 11, 4 + tw * 2));
  ctx.fill();
}

function drawHazards(ctx, s, camera) {
  for (const hz of s.hazards) {
    const x = hz.wx - camera;
    if (x < -200 || x > FIELD.width + 240) continue;
    const y = GROUND_Y;
    if (hz.type === 'hay') {
      ctx.fillStyle = P.hay;
      sRect(ctx, x - 38, y - 52, 76, 52);
      ctx.strokeStyle = P.hayDark;
      ctx.lineWidth = 3;
      for (let i = 1; i <= 3; i += 1) {
        seg(ctx, x - 36, y - 52 + i * 13, x + 36, y - 52 + i * 13);
      }
      ctx.lineWidth = 2;
      seg(ctx, x - 30, y - 6, x - 40, y - 2);
      seg(ctx, x + 30, y - 8, x + 40, y - 3);
    } else if (hz.type === 'fence') {
      ctx.fillStyle = P.fenceWood;
      sRect(ctx, x - 15, y - 82, 30, 82);
      ctx.fillStyle = P.fenceWoodDark;
      sRect(ctx, x - 15, y - 82, 30, 8);
      sRect(ctx, x - 15, y - 48, 30, 7);
      ctx.fillStyle = '#3d2412';
      circle(ctx, x - 8, y - 30, 2);
      ctx.fill();
      circle(ctx, x + 8, y - 16, 2);
      ctx.fill();
    } else if (hz.type === 'dog') {
      // Biscuit, the farm dog: he runs left after Mabel
      const ph = Math.sin(s.time * 21);
      ctx.fillStyle = '#8a6a4a';
      ePoly(ctx, x, y - 22, 34, 15);
      ctx.fill();
      ctx.fillStyle = '#75573a';
      circle(ctx, x - 30, y - 32, 11);
      ctx.fill();
      // ears and snout
      ctx.fillStyle = '#5d442c';
      poly(ctx, [[x - 38, y - 40], [x - 44, y - 50], [x - 32, y - 42]]);
      ctx.fill();
      ePoly(ctx, x - 42, y - 29, 6, 4);
      ctx.fill();
      ctx.fillStyle = '#241812';
      circle(ctx, x - 32, y - 35, 2);
      ctx.fill();
      // legs and tail
      ctx.strokeStyle = '#75573a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      seg(ctx, x - 18, y - 14, x - 18 + 9 * ph, y);
      seg(ctx, x - 6, y - 14, x - 6 - 9 * ph, y);
      seg(ctx, x + 12, y - 14, x + 12 + 9 * ph, y);
      seg(ctx, x + 24, y - 14, x + 24 - 9 * ph, y);
      poly(ctx, [[x + 32, y - 26], [x + 40, y - 32], [x + 46, y - 44 + ph * 4]], false);
      ctx.stroke();
    } else if (hz.type === 'corn') {
      for (let i = 0; i < 5; i += 1) {
        const sx = x - 38 + i * 19 + hashNoise(i * 17) * 6;
        const h = 92 + hashNoise(i * 29) * 24;
        ctx.strokeStyle = P.cornLeaf;
        ctx.lineWidth = 5;
        seg(ctx, sx, y, sx, y - h);
        ctx.fillStyle = P.cornLeaf;
        for (let l = 1; l <= 3; l += 1) {
          ePoly(ctx, sx + (l % 2 ? 12 : -12), y - l * (h / 4), 17, 5, l % 2 ? -0.5 : 0.5);
          ctx.fill();
        }
        if (i % 2 === 0) {
          ctx.fillStyle = P.cornGold;
          ePoly(ctx, sx + 10, y - h + 14, 5, 11, 0.4);
          ctx.fill();
        }
      }
    } else if (hz.type === 'scarecrow') {
      ctx.strokeStyle = P.scarecrowPole;
      ctx.lineWidth = 7;
      seg(ctx, x, y, x, y - 132);
      // the bar to duck under
      ctx.fillStyle = P.scarecrowPole;
      sRect(ctx, x - 75, y - 64, 150, 18);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      sRect(ctx, x - 75, y - 52, 150, 6);
      // rag shirt on the bar
      ctx.fillStyle = P.scarecrowShirt;
      sRect(ctx, x - 26, y - 100, 52, 36);
      // head
      ctx.fillStyle = P.scarecrowHead;
      circle(ctx, x, y - 142, 15);
      ctx.fill();
      ctx.fillStyle = '#241812';
      ctx.lineWidth = 2.5;
      seg(ctx, x - 8, y - 147, x - 3, y - 141);
      seg(ctx, x - 3, y - 147, x - 8, y - 141);
      seg(ctx, x + 3, y - 147, x + 8, y - 141);
      seg(ctx, x + 8, y - 141, x + 3, y - 147);
      poly(ctx, [[x - 5, y - 131], [x - 2, y - 128], [x + 2, y - 128], [x + 5, y - 131]], false);
      ctx.stroke();
      // straw hat
      ctx.fillStyle = P.farmerHat;
      ePoly(ctx, x, y - 155, 20, 5);
      ctx.fill();
      dome(ctx, x, y - 157, 10);
      ctx.fill();
    } else if (hz.type === 'pumpkin') {
      const py = hz.landed ? y : y - hz.y;
      if (!hz.landed) {
        const w = 14 + 26 * (1 - hz.y / 330);
        ctx.fillStyle = `rgba(40, 20, 5, ${0.16 + 0.22 * (1 - hz.y / 330)})`;
        ePoly(ctx, x, y + 6, w, 6);
        ctx.fill();
      }
      ctx.fillStyle = P.pumpkin;
      ePoly(ctx, x - 12, py - 22, 9, 19);
      ctx.fill();
      ePoly(ctx, x + 12, py - 22, 9, 19);
      ctx.fill();
      ctx.fillStyle = P.pumpkin;
      ePoly(ctx, x, py - 22, 11, 21);
      ctx.fill();
      ctx.strokeStyle = P.pumpkinStem;
      ctx.lineWidth = 5;
      seg(ctx, x, py - 42, x + 5, py - 52);
    } else if (hz.type === 'oven') {
      const phase = ovenFlamePhase(s, hz);
      // the flame, in front of the body
      if (phase === 'active') {
        const fx = x + 42;
        ctx.fillStyle = P.flame;
        const fp = [[fx, y]];
        for (let i = 0; i <= 5; i += 1) {
          const px = fx + (150 * i) / 5;
          const py = y - 20 - Math.sin(s.time * 22 + i * 2.2) * 4 - (1 - i / 5) * 5;
          fp.push([px, py]);
        }
        fp.push([fx + 150, y]);
        poly(ctx, fp);
        ctx.fill();
        ctx.fillStyle = P.flameCore;
        const cp = [[fx, y]];
        for (let i = 0; i <= 4; i += 1) {
          const px = fx + (118 * i) / 4;
          const py = y - 12 - Math.sin(s.time * 26 + i * 2.6 + 1) * 3 - (1 - i / 4) * 4;
          cp.push([px, py]);
        }
        cp.push([fx + 118, y]);
        poly(ctx, cp);
        ctx.fill();
      } else if (phase === 'warn') {
        for (let i = 0; i < 3; i += 1) {
          const a = (s.time * 3 + i * 0.33) % 1;
          ctx.fillStyle = `rgba(255, 157, 60, ${0.7 * (1 - a)})`;
          circle(ctx, x + 50 + i * 8, y - 10 - a * 30, 3.5);
          ctx.fill();
        }
      }
      // the body
      ctx.fillStyle = P.ovenBody;
      sRect(ctx, x - 50, y - 64, 100, 64);
      ctx.fillStyle = P.ovenDark;
      sRect(ctx, x - 50, y - 64, 100, 10);
      // door with the glow window
      ctx.fillStyle = '#3d434a';
      sRect(ctx, x - 34, y - 44, 46, 34);
      const glow = phase === 'active' ? 1 : (phase === 'warn' ? 0.45 + 0.4 * Math.sin(s.time * 12) : 0.12);
      ctx.fillStyle = `rgba(255, 157, 60, ${Math.max(0, glow)})`;
      sRect(ctx, x - 28, y - 38, 34, 20);
      // handle and feet
      ctx.fillStyle = P.ovenDark;
      sRect(ctx, x + 14, y - 40, 26, 7);
      sRect(ctx, x - 46, y, 12, 6);
      sRect(ctx, x + 34, y, 12, 6);
    } else if (hz.type === 'kniferoll') {
      // the carving knife, tumbling toward Mabel: it flips as it rolls
      const spin = s.time * 9 + hz.wx * 0.008;
      const flip = Math.cos(spin);
      const bounce = Math.abs(Math.sin(spin)) * 5;
      const m = flip >= 0 ? 1 : -1; // mirror the blade when it is face down
      const KX = (lx) => x + lx * m;
      const KY = (ly) => y - 15 - bounce + ly;
      // blade
      ctx.fillStyle = P.steel;
      poly(ctx, [[KX(-33), KY(8)], [KX(-33), KY(-8)], [KX(14), KY(-8)], [KX(22), KY(-1)], [KX(14), KY(8)]]);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      sRect(ctx, Math.min(x - 30 * m, x + 12 * m), KY(-5), 42, 3);
      // handle
      ctx.fillStyle = '#5d381f';
      sRect(ctx, Math.min(x + 14 * m, x + 36 * m), KY(-7), 22, 14);
      ctx.strokeStyle = 'rgba(60, 30, 10, 0.35)';
      ctx.lineWidth = 3;
      seg(ctx, x + 40, y - 24, x + 58, y - 24);
      seg(ctx, x + 44, y - 14, x + 64, y - 14);
    }
  }
}

// ---------- world and end-screen scenes ----------

function drawWorld(ctx, s) {
  const camera = s.dist * PPM;
  drawBackground(ctx, s);
  for (const c of s.corns) {
    const x = c.wx - camera;
    if (x < -40 || x > FIELD.width + 40) continue;
    drawCorn(ctx, x, GROUND_Y - c.y + Math.sin(s.time * 3 + c.wx * 0.05) * 6, s.time + c.wx * 0.1);
  }
  const f = s.farmer;
  const fx = s.player.sx - f.gap * PPM;
  if (fx > -130) drawFarmer(ctx, fx, GROUND_Y, 1, f.mode, s.time);
  drawHazards(ctx, s, camera);
  const p = s.player;
  drawMabel(ctx, p.sx, GROUND_Y - p.y, 1, p, s.time);
}

function drawTitle(ctx, s) {
  const camera = 60 + s.time * 9;
  drawFarmyardBg(ctx, camera, s.time);
  drawGroundBand(ctx, camera, 0);
  // a couple of big pumpkins up front
  for (let i = 0; i < 4; i += 1) {
    const x = tileX(camera, i, 420, 1280 + 840);
    if (x > -120 && x < FIELD.width + 120) drawPumpkinPatch(ctx, x, GROUND_Y + 66, 2.2);
  }
  // Brindle idling on the right, not yet alert
  drawFarmer(ctx, 1020, GROUND_Y, 1.35, 'rest', s.time);
  // Mabel idle on the left
  drawMabel(ctx, 360, GROUND_Y, 1.5, { y: 0, onGround: true, duck: false, facing: 1, wingT: s.time * 2.4, invuln: 0, stumble: 0 }, s.time);
  // the wooden sign (the letters on it are DOM, above the canvas)
  ctx.fillStyle = P.fenceWoodDark;
  sRect(ctx, 450, 154, 18, 220);
  sRect(ctx, 812, 154, 18, 220);
  ctx.fillStyle = P.fenceWood;
  sRect(ctx, 390, 165, 500, 150);
  ctx.strokeStyle = P.fenceWoodDark;
  ctx.lineWidth = 5;
  ctx.strokeRect(392.5, 167.5, 495, 145);
}

function windowScene(ctx, x, y, time) {
  ctx.fillStyle = '#f0e0bd';
  sRect(ctx, x - 160, y - 92, 320, 190);
  const g = ctx.createLinearGradient(0, y - 76, 0, y + 84);
  g.addColorStop(0, '#f5a44f');
  g.addColorStop(0.6, '#e8842c');
  g.addColorStop(1, '#a05a35');
  ctx.fillStyle = g;
  sRect(ctx, x - 144, y - 76, 288, 158);
  // moon and stars
  ctx.fillStyle = '#fff7d6';
  circle(ctx, x + 86, y - 40, 16);
  ctx.fill();
  ctx.fillStyle = 'rgba(245, 164, 79, 1)';
  circle(ctx, x + 93, y - 45, 14);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 247, 214, 0.9)';
  for (let i = 0; i < 5; i += 1) {
    circle(ctx, x - 120 + i * 34, y - 52 + (i % 2) * 14, 2.2);
    ctx.fill();
  }
  // far hill and barn
  ctx.fillStyle = 'rgba(90, 40, 25, 0.75)';
  poly(ctx, [[x - 144, y + 60], [x - 40, y + 34], [x + 144, y + 56], [x + 144, y + 82], [x - 144, y + 82]]);
  ctx.fill();
  sRect(ctx, x + 96, y + 34, 30, 22);
  poly(ctx, [[x + 92, y + 34], [x + 111, y + 24], [x + 130, y + 34]]);
  ctx.fill();
  // the sill
  ctx.fillStyle = '#fff3dd';
  sRect(ctx, x - 160, y + 70, 320, 20);
  // Mabel on the sill, tail fanned, looking back fondly
  drawMabel(ctx, x - 56, y + 70, 1, { y: 0, onGround: true, duck: false, facing: 1, wingT: time * 2, invuln: 0, stumble: 0 }, time);
}

function caughtScene(ctx, x, y, time) {
  // Mabel, plucked and dizzy, on the left
  drawMabel(ctx, x - 120, y, 1, { y: 0, onGround: true, duck: false, facing: 1, wingT: time * 2, invuln: 0, stumble: 0.6 }, time);
  // the net over her: a few crossing curves
  ctx.strokeStyle = 'rgba(255, 243, 221, 0.85)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 4; i += 1) {
    poly(ctx, quadSegs([x - 70, y + 10], [x - 45 - i * 12, y - 70 - i * 6], [x - 20 + i * 14, y - 14]), false);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i += 1) {
    poly(ctx, quadSegs([x - 64 + i * 4, y - 8], [x - 40 + i * 16, y - 34], [x - 58 + i * 10, y - 62]), false);
    ctx.stroke();
  }
  // Brindle smug on the right, pan raised
  drawFarmer(ctx, x + 150, y, 1.2, 'telegraph', time);
}

function drawEndArt(ctx, s) {
  ctx.fillStyle = 'rgba(30, 15, 5, 0.55)';
  sRect(ctx, 0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = P.panel;
  sRect(ctx, 290, 108, 700, 500);
  ctx.strokeStyle = P.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(291, 109, 698, 498);
  if (s.over === 'win') windowScene(ctx, 640, 240, s.time);
  else caughtScene(ctx, 640, 320, s.time);
}
