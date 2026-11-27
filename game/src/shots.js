// The screenshot scenes behind ?shot=title|play|kitchen|end. Each one plays
// the real rules forward from a fresh world steered by a simple autopilot, so
// a frame is what a real run looks like and the same seed always gives the
// same frame.

import { GOAL_M, HAZARD, MABEL, PPM, STAGES, STEP } from './config.js';
import { ovenFlamePhase } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** How fast a hazard closes on Mabel, in px/s (scroll + its own speed). */
function approachPx(state, hz) {
  const stage = STAGES[state.stageIndex];
  const scroll = stage.run * (1 + (0.3 * state.dist) / GOAL_M) * PPM;
  return scroll + (HAZARD[hz.type].speed || 0);
}

/** When a jump (plus one flap at the apex) is above height h: { t1, t2 } in
 *  seconds, worked out by integrating the arc — or null if the arc never
 *  reaches that height. */
function airTimes(h) {
  let y = 0;
  let vy = MABEL.jumpV;
  let t = 0;
  let flapped = false;
  let t1 = null;
  let t2 = null;
  const dt = 1 / 240;
  for (let i = 0; i < 4 * 240; i += 1) {
    vy -= MABEL.gravity * dt;
    y += vy * dt;
    t += dt;
    if (!flapped && vy < 0) { vy = MABEL.flapV; flapped = true; }
    if (y <= 0) break;
    if (t1 === null && y >= h) t1 = t;
    if (t1 !== null && y < h) { t2 = t; break; }
  }
  if (t1 === null) return null;
  return { t1, t2: t2 === null ? t : t2 };
}

/** Mabel's effective width once world.js applies its forgiving shrink. */
const PLAYER_W = 36;

/** One step of play: what the autopilot would press right now. */
export function autopilot(state) {
  const p = state.player;
  const camera = state.dist * PPM;
  let dir = 0;
  let jump = false;
  let duck = false;

  // Duck under the scarecrow bar.
  for (const hz of state.hazards) {
    if (hz.type !== 'scarecrow') continue;
    const relX = hz.wx - camera - p.sx;
    if (relX > -130 && relX < 150) duck = true;
  }
  // Slide under an oven flame that is lit.
  for (const hz of state.hazards) {
    if (hz.type !== 'oven') continue;
    const phase = ovenFlamePhase(state, hz);
    if (phase !== 'active' && phase !== 'warn') continue;
    const x = hz.wx - camera;
    const flameLeft = x + HAZARD.oven.w / 2;
    const flameRight = x + HAZARD.oven.w / 2 + HAZARD.oven.flame.len;
    if (p.sx > flameLeft - 160 && p.sx < flameRight + 40) duck = true;
  }
  // Step off the line of a pumpkin until it has landed, and slide under
  // one already falling close.
  for (const hz of state.hazards) {
    if (hz.type !== 'pumpkin' || hz.landed) continue;
    const relX = hz.wx - camera - p.sx;
    if (relX > -30 && relX < 240) dir = -1;
    if (hz.falling && relX > -80 && relX < 100 && hz.y < 130) duck = true;
  }
  // Jump over what is closing in (bales, fences, dogs, corn, ovens, knives,
  // landed pumpkins): the hazard leads with its LEFT edge, which is what
  // reaches Mabel first.
  const tLand = (2 * MABEL.jumpV) / MABEL.gravity; // single-arc land time
  for (const hz of state.hazards) {
    const def = HAZARD[hz.type];
    if (def.kind !== 'jump') continue;
    if (hz.type === 'pumpkin' && !hz.landed) continue; // handled above
    const x = hz.wx - camera;
    if (x < p.sx - 160 || x > p.sx + 520) continue;
    const front = x - def.w / 2;
    const G = front - (p.sx + PLAYER_W / 2);
    const D = def.w * 0.88 + PLAYER_W; // width both boxes must pass through
    // The closing speed includes Mabel's own walk: moving toward the hazard
    // speeds it up, moving away slows it (or separates it entirely).
    const v = approachPx(state, hz) + p.velX;
    if (v < 60) continue; // separating or crawling: it will pass or I will clear it
    const arc = airTimes(def.h);
    if (!arc) continue;
    if (p.onGround) {
      // G shrinks as the hazard closes; trigger mid-window, never at the
      // last safe moment, and bail with a desperate jump if it is on top of us.
      const gMid = (v * arc.t1 + (v * arc.t2 - D)) / 2;
      if (G < gMid && G > -1.2 * D) jump = true;
    } else if (p.canFlap && p.vy < 0) {
      // Rescue flap, decided by prediction: where will the hazard's leading
      // edge be when this arc lands, and are we already below its top?
      const rem = tLand - p.jumpT;
      if (rem > 0.02) {
        const gLand = G - v * rem;
        const collidesAtLanding = gLand > -D && gLand < 10;
        const collidesMidAir = G <= 0 && p.y < def.h;
        if (collidesAtLanding || collidesMidAir) jump = true;
      }
    }
  }
  // Otherwise hold a comfy line a bit left of centre.
  if (dir === 0) {
    if (p.sx < 430) dir = 1;
    else if (p.sx > 490) dir = -1;
  }
  return { dir, jump, duck, walkTarget: null };
}

/** Good kitchen frame: inside the kitchen, an oven lit up ahead. */
function kitchenMoment(state) {
  if (state.dist < 640 || state.dist > 860) return false;
  const camera = state.dist * PPM;
  for (const hz of state.hazards) {
    if (hz.type !== 'oven') continue;
    const x = hz.wx - camera;
    if (x < 120 || x > 620) continue;
    const phase = ovenFlamePhase(state, hz);
    if (phase === 'active' || phase === 'warn') return true;
  }
  return false;
}

/**
 * Set `world` to the named scene and return the screen to draw over it plus
 * the best score to show. `at` overrides the play-scene stop distance.
 */
export function stageShot(name, world, at) {
  world.reset();
  if (name === 'play' || name === 'kitchen' || name === 'end') {
    const stopAt = name === 'play' ? (at || 60) : Infinity;
    for (let i = 0; i < 60 * 240; i += 1) {
      const ctrl = autopilot(world);
      world.step(STEP, ctrl, false);
      if (world.over) break;
      if (name === 'play' && world.dist >= stopAt) break;
      if (name === 'kitchen' && kitchenMoment(world)) break;
    }
    return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: Math.floor(world.score) };
  }
  // title: let the farmyard drift for a few quiet seconds
  const idle = { dir: 0, jump: false, duck: false, walkTarget: null };
  for (let i = 0; i < 5 * 60; i += 1) world.step(STEP, idle, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
