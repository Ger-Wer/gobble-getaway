// The whole run, simulated in fixed steps. Mabel runs right (the camera
// scrolls), Farmer Brindle gains from behind, hazards and corn spawn ahead
// and drift offscreen left, and the run ends when Mabel is caught, plucked
// or reaches the farmhouse window at GOAL_M.

import {
  FARMER, GROUND_Y, GOAL_M, HAZARD, LIVES, MABEL, NEAR_MISS_PX, PPM, SCORE, SPAWN, STAGES,
} from './config.js';
import { createRandom } from './random.js';

// Event bit flags, for the loop to play sounds and change screens.
export const EVENT_OVER = 1;
export const EVENT_HIT = 2;
export const EVENT_STAGE = 4;
export const EVENT_WIN = 8;
export const EVENT_LOSE = 16;
export const EVENT_CORN = 32;
export const EVENT_NEAR = 64;
export const EVENT_JUMP = 128;
export const EVENT_FLAP = 256;
export const EVENT_LAND = 512;
export const EVENT_LUNGE = 1024;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createWorld(seed) {
  const random = createRandom(seed);
  const state = {
    time: 0,
    dist: 0,
    stageIndex: 0,
    over: null,
    overReason: '',
    score: 0,
    lives: LIVES,
    toasts: [],
    banner: null,
    player: {
      sx: 430, y: 0, vy: 0, onGround: true, canFlap: true, jumpT: 0, velX: 0,
      duck: false, invuln: 0, stumble: 0, facing: 1, wingT: 0,
    },
    farmer: { gap: FARMER.startGap, mode: 'chase', t: 0, nextLunge: 8 },
    hazards: [],
    corns: [],
    spawnCursor: 0,
    cornCursor: 0,
    lastHazardType: '',
    seed,
  };

  function reset() {
    state.time = 0;
    state.dist = 0;
    state.stageIndex = 0;
    state.over = null;
    state.overReason = '';
    state.score = 0;
    state.lives = LIVES;
    state.toasts = [];
    state.banner = { text: STAGES[0].name, sub: 'Run 900 m to the farmhouse window', t: 0, life: 2.4 };
    const p = state.player;
    p.sx = 430; p.y = 0; p.vy = 0; p.onGround = true; p.canFlap = true; p.jumpT = 0; p.velX = 0;
    p.duck = false; p.invuln = 0; p.stumble = 0; p.facing = 1; p.wingT = 0;
    const f = state.farmer;
    f.gap = FARMER.startGap; f.mode = 'chase'; f.t = 0;
    f.nextLunge = 7.5 + random() * 3;
    state.hazards = [];
    state.corns = [];
    state.spawnCursor = 700;
    state.cornCursor = 1050;
    state.lastHazardType = '';
  }

  /** The stage a world-x position belongs to (hazards spawn by landing spot). */
  function stageAt(wx) {
    const m = wx / PPM;
    for (let i = 0; i < STAGES.length; i += 1) if (m >= STAGES[i].from && m < STAGES[i].to) return i;
    return STAGES.length - 1;
  }

  function addToast(text, x, y, color, size) {
    state.toasts.push({ text, x, y, t: 0, life: 1.15, color: color || '#fff3dd', size: size || 26 });
    if (state.toasts.length > 8) state.toasts.shift();
  }

  /** One fixed step. `ctrl` = { dir, jump, duck, walkTarget }. In `ambient`
   *  (title screen) mode only time and toasts advance. */
  function step(dt, ctrl, ambient) {
    const s = state;
    let events = 0;
    s.time += dt;
    for (const t of s.toasts) t.t += dt;
    s.toasts = s.toasts.filter((t) => t.t < t.life);
    if (s.banner) {
      s.banner.t += dt;
      if (s.banner.t > s.banner.life) s.banner = null;
    }
    if (ambient || s.over) return events;

    const stage = STAGES[s.stageIndex];
    // Stage change: a banner, a bonus, and the farmer loses track for a bit.
    if (s.stageIndex < STAGES.length - 1 && s.dist >= STAGES[s.stageIndex + 1].from) {
      s.stageIndex += 1;
      const ns = STAGES[s.stageIndex];
      s.score += SCORE.stageBonus;
      s.banner = { text: 'STAGE ' + (s.stageIndex + 1) + ' — ' + ns.name, sub: 'The farmer loses track: he stumbles around the corner', t: 0, life: 2.4 };
      s.farmer.gap = Math.min(FARMER.maxGap, s.farmer.gap + 20);
      s.farmer.nextLunge = ns.lungeEvery[0] + random() * (ns.lungeEvery[1] - ns.lungeEvery[0]);
      addToast('STAGE CLEAR +100', s.player.sx, GROUND_Y - 190, '#ffd24c', 30);
      events |= EVENT_STAGE;
    }

    const speedM = stage.run * (1 + 0.3 * s.dist / GOAL_M);
    const scrollPx = speedM * PPM * dt;
    s.dist += speedM * dt;
    s.score += speedM * dt * SCORE.meter;
    const camera = s.dist * PPM;

    // Victory: the back window.
    if (s.dist >= GOAL_M) {
      s.dist = GOAL_M;
      s.over = 'win';
      s.overReason = 'Mabel slipped out the back window as the sun went down.';
      s.score += 250;
      s.banner = null;
      events |= EVENT_OVER | EVENT_WIN;
      return events;
    }

    const p = s.player;
    p.wingT += dt * (p.onGround ? 16 : 34);
    if (p.invuln > 0) p.invuln -= dt;
    if (p.onGround) p.jumpT = 0;
    else p.jumpT += dt;

    // --- steering
    let dir = ctrl.dir;
    let duck = Boolean(ctrl.duck) && p.onGround;
    if (p.stumble > 0) {
      p.stumble -= dt;
      dir = 0;
      duck = false;
    }
    if (dir === 0 && ctrl.walkTarget != null) {
      const diff = ctrl.walkTarget - p.sx;
      if (Math.abs(diff) > 18) dir = diff > 0 ? 1 : -1;
    }
    if (dir !== 0) {
      p.sx += dir * MABEL.walkSpeed * dt;
      p.facing = dir;
    }
    p.velX = dir !== 0 ? dir * MABEL.walkSpeed : 0;
    p.sx = clamp(p.sx, MABEL.xMin, MABEL.xMax);

    // --- jumping and falling
    if (ctrl.jump && p.stumble <= 0) {
      if (p.onGround) {
        p.vy = MABEL.jumpV;
        p.onGround = false;
        p.canFlap = true;
        events |= EVENT_JUMP;
      } else if (p.canFlap) {
        p.vy = MABEL.flapV;
        p.canFlap = false;
        events |= EVENT_FLAP;
      }
    }
    if (!p.onGround) {
      p.vy -= MABEL.gravity * dt;
      p.y += p.vy * dt;
      duck = false;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.onGround = true;
        p.canFlap = true;
        events |= EVENT_LAND;
      }
    }
    p.duck = duck;

    // --- spawning
    while (s.spawnCursor < camera + SPAWN.lead) {
      const idx = stageAt(s.spawnCursor);
      const list = STAGES[idx].obstacles;
      let type = list[Math.floor(random() * list.length)];
      if (type === s.lastHazardType && list.length > 1) {
        type = list[(list.indexOf(type) + 1) % list.length];
      }
      s.lastHazardType = type;
      const hz = { type, wx: s.spawnCursor, offset: random() * 8, passed: false, minGap: 9999 };
      if (type === 'pumpkin') { hz.landed = false; hz.falling = false; hz.y = HAZARD.pumpkin.fallFrom; }
      s.hazards.push(hz);
      s.spawnCursor += SPAWN.minGap + random() * SPAWN.extraGap;
    }
    while (s.cornCursor < camera + SPAWN.lead) {
      const count = Math.round(SPAWN.cornCount[0] + random() * (SPAWN.cornCount[1] - SPAWN.cornCount[0]));
      const height = 44 + random() * 116;
      for (let i = 0; i < count; i += 1) {
        s.corns.push({ wx: s.cornCursor + i * SPAWN.cornGap, y: height + Math.sin(i * 1.1) * 22, taken: false });
      }
      s.cornCursor += SPAWN.cornArcEvery[0] + random() * (SPAWN.cornArcEvery[1] - SPAWN.cornArcEvery[0]);
    }

    // --- hazards: move, fall, collide
    // While invulnerable (post-hit) Mabel takes no damage at all; the blink
    // is pure cosmetics, handled in the renderer.
    const pBox = p.invuln > 0 ? null : playerBox(s);
    for (const hz of s.hazards) {
      const def = HAZARD[hz.type];
      if (hz.type === 'dog' || hz.type === 'kniferoll') {
        hz.wx -= scrollPx + def.speed * dt;
      }
      if (hz.type === 'pumpkin' && !hz.landed) {
        const relX = hz.wx - camera - p.sx;
        if (!hz.falling && relX > -40 && relX < HAZARD.pumpkin.windowPx) hz.falling = true;
        if (hz.falling) {
          hz.y -= (HAZARD.pumpkin.fallFrom / HAZARD.pumpkin.fallSeconds) * dt;
          if (hz.y <= 0) { hz.y = 0; hz.landed = true; }
        }
      }
      const x = hz.wx - camera;
      if (x < -220 || x > camera + 2000) continue;
      const boxes = hazardBoxes(s, hz, camera);
      // near-miss tracking: smallest horizontal gap while the boxes share height
      if (pBox && Math.abs(x - p.sx) < 420) {
        for (const hb of boxes) {
          const vertical = pBox.y1 < hb.y2 && pBox.y2 > hb.y1;
          if (vertical) {
            const gap = Math.max(hb.x1 - pBox.x2, pBox.x1 - hb.x2, 0);
            hz.minGap = Math.min(hz.minGap, gap);
          }
        }
      }
      if (hz.passed === false && x + def.w / 2 < p.sx - MABEL.width / 2) {
        hz.passed = true;
        if (hz.minGap < NEAR_MISS_PX) {
          s.score += SCORE.nearMiss;
          addToast('CLOSE! +' + SCORE.nearMiss, p.sx, GROUND_Y - 200, '#9ddb6a', 24);
          s.farmer.gap = Math.min(FARMER.maxGap, s.farmer.gap + 0.8);
          events |= EVENT_NEAR;
        }
      }
      if (pBox && !s.over) {
        for (const hb of boxes) {
          if (overlaps(pBox, hb)) {
            events |= hurt(s);
            if (s.over) break;
            break;
          }
        }
        if (s.over) break;
      }
    }
    s.hazards = s.hazards.filter((hz) => hz.wx - camera > -260);

    // --- corn
    for (const c of s.corns) {
      if (c.taken) continue;
      const x = c.wx - camera;
      const cy = GROUND_Y - c.y;
      if (pBox && Math.abs(x - p.sx) < 40 && Math.abs(cy - (pBox.y1 + pBox.y2) / 2) < 52) {
        c.taken = true;
        s.score += SCORE.corn;
        addToast('+' + SCORE.corn, x, cy - 30, '#ffd24c', 22);
        events |= EVENT_CORN;
      }
    }
    s.corns = s.corns.filter((c) => c.wx - camera > -100 && !c.taken);

    // --- Farmer Brindle
    const f = s.farmer;
    const [restGap, restDur] = stage.rest;
    if (f.mode === 'chase') {
      f.gap -= stage.creep * dt;
      f.nextLunge -= dt;
      if (f.gap > restGap) { f.mode = 'rest'; f.t = restDur; }
      else if (f.nextLunge <= 0) { f.mode = 'telegraph'; f.t = FARMER.lungeTelegraph; events |= EVENT_LUNGE; }
    } else if (f.mode === 'rest') {
      f.gap -= stage.creep * 0.3 * dt;
      f.t -= dt;
      if (f.t <= 0) { f.mode = 'chase'; f.nextLunge = stage.lungeEvery[0] + random() * (stage.lungeEvery[1] - stage.lungeEvery[0]); }
    } else if (f.mode === 'telegraph') {
      f.gap -= stage.creep * 0.4 * dt;
      f.t -= dt;
      if (f.t <= 0) { f.mode = 'lunge'; f.t = FARMER.lungeSeconds; }
    } else {
      f.gap -= (stage.creep + FARMER.lungeCreep) * dt;
      f.t -= dt;
      if (f.t <= 0) { f.mode = 'chase'; f.nextLunge = stage.lungeEvery[0] + random() * (stage.lungeEvery[1] - stage.lungeEvery[0]); }
    }
    f.gap = clamp(f.gap, 0, FARMER.maxGap);
    if (f.gap <= 0.4) {
      f.gap = 0;
      s.over = 'lose';
      s.overReason = 'Farmer Brindle caught Mabel by the tail feathers.';
      events |= EVENT_OVER | EVENT_LOSE;
    }
    return events;
  }

  function hurt(s) {
    s.lives -= 1;
    const p = s.player;
    p.invuln = MABEL.invulnSeconds;
    p.stumble = MABEL.stumbleSeconds;
    p.vy = Math.max(p.vy, 240);
    p.onGround = false;
    s.farmer.gap = Math.min(FARMER.maxGap, s.farmer.gap + FARMER.mercyOnHit);
    addToast('OUCH! -1', p.sx, GROUND_Y - 210, '#ff6b4a', 30);
    const events = EVENT_HIT;
    if (s.lives <= 0) {
      s.over = 'lose';
      s.overReason = 'Mabel was too plucked to keep running — Brindle was waiting with the net.';
      return events | EVENT_OVER | EVENT_LOSE;
    }
    return events;
  }

  state.reset = reset;
  state.step = step;
  state.addToast = addToast;
  reset();
  return state;
}

/** Mabel's hit box in screen coordinates. */
export function playerBox(s) {
  const p = s.player;
  const h = !p.onGround ? MABEL.airHeight : (p.duck ? MABEL.duckHeight : MABEL.height);
  const bottom = GROUND_Y - p.y;
  return { x1: p.sx - MABEL.width / 2, x2: p.sx + MABEL.width / 2, y1: bottom - h, y2: bottom };
}

/** The hazard's active hit boxes in screen coordinates (an oven may have two:
 *  body and flame; a scarecrow only its bar). */
export function hazardBoxes(s, hz, camera) {
  const def = HAZARD[hz.type];
  const x = hz.wx - camera;
  const out = [];
  if (hz.type === 'scarecrow') {
    out.push({ x1: x - def.w / 2, x2: x + def.w / 2, y1: GROUND_Y - def.barY - def.h, y2: GROUND_Y - def.barY });
    return out;
  }
  if (hz.type === 'pumpkin') {
    if (hz.landed) out.push({ x1: x - def.w / 2, x2: x + def.w / 2, y1: GROUND_Y - def.h, y2: GROUND_Y });
    else if (hz.falling) out.push({ x1: x - def.w / 2, x2: x + def.w / 2, y1: GROUND_Y - hz.y - def.h, y2: GROUND_Y - hz.y });
    return out;
  }
  if (hz.type === 'oven') {
    out.push({ x1: x - def.w / 2, x2: x + def.w / 2, y1: GROUND_Y - def.h, y2: GROUND_Y });
    const phase = ovenFlamePhase(s, hz);
    if (phase === 'active') {
      out.push({ x1: x + def.w / 2 - 8, x2: x + def.w / 2 + def.flame.len, y1: GROUND_Y - def.flame.h, y2: GROUND_Y });
    }
    return out;
  }
  out.push({ x1: x - def.w / 2, x2: x + def.w / 2, y1: GROUND_Y - def.h, y2: GROUND_Y });
  return out;
}

/** The oven's flame cycle: 'idle', 'warn' or 'active'. */
export function ovenFlamePhase(s, hz) {
  const fl = HAZARD.oven.flame;
  const total = fl.idle + fl.warn + fl.active;
  const t = (s.time + hz.offset) % total;
  if (t < fl.idle) return 'idle';
  if (t < fl.idle + fl.warn) return 'warn';
  return 'active';
}

function overlaps(a, b) {
  // Forgiving margins: the player box shrinks 8 px per side, the hazard 6 %.
  const ax1 = a.x1 + 8, ax2 = a.x2 - 8;
  const ay1 = a.y1 + 6, ay2 = a.y2 - 2;
  const bw = (b.x2 - b.x1) * 0.06, bh = (b.y2 - b.y1) * 0.06;
  const bx1 = b.x1 + bw, bx2 = b.x2 - bw;
  const by1 = b.y1 + bh, by2 = b.y2 - bh;
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}
