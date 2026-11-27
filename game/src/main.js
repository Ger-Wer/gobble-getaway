// Boot and the one loop. Input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens: title,
// play, paused and over.
//
// ?seed=N fixes the run. ?shot=title|play|kitchen|end (with &seed=N and
// optional &at=metres) stages that scene instead of running the loop, paints
// it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, GOAL_M, LIVES, PPM, STEP } from './config.js';
import { createWorld, EVENT_FLAP, EVENT_HIT, EVENT_JUMP, EVENT_LAND, EVENT_LOSE, EVENT_NEAR, EVENT_OVER, EVENT_STAGE, EVENT_CORN, EVENT_LUNGE } from './world.js';
import { ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createSound } from './sound.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const atParam = Number.parseFloat(params.get('at') ?? '');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const sound = createSound();
const world = createWorld(seed);
const renderer = createRenderer(canvas);

// Scale the fixed 1280x720 stage to the window; canvas and overlay scale
// together, so the text stays glued to the picture.
const stage = document.getElementById('stage');
const fitStage = () => {
  stage.style.transform = `scale(${window.innerWidth / 1280}, ${window.innerHeight / 720})`;
};
window.addEventListener('resize', fitStage);
fitStage();

// ---------- the DOM overlay (all readable text lives here) ----------

const E = (id) => document.getElementById(id);
const ui = {
  hud: E('hud'), scoreV: E('hud-score-v'), distV: E('hud-dist'),
  progFill: E('prog-fill'), drums: [E('drum-0'), E('drum-1'), E('drum-2')],
  muted: E('hud-muted'), hint: E('hud-hint'),
  title: E('scr-title'), press: E('press'), bestTag: E('best-tag'), bestV: E('best-v'),
  end: E('scr-end'), endTitle: E('end-title'), endReason: E('end-reason'),
  endDist: E('end-dist'), endScore: E('end-score'), endPress: E('end-press'),
  pause: E('scr-pause'), banner: E('banner'), bannerSub: E('banner-sub'),
  toasts: [E('toast-0'), E('toast-1'), E('toast-2'), E('toast-3'), E('toast-4'), E('toast-5')],
  mark: E('farmer-mark'),
};

const pad6 = (n) => String(Math.floor(n)).padStart(6, '0');
const pulse = (el) => { el.style.opacity = String(0.55 + 0.45 * Math.sin(world.time * 4)); };

function updateDom(screen, best, muted) {
  const w = world;
  ui.hud.hidden = !(screen === SCREEN_PLAY || screen === SCREEN_PAUSED);
  ui.title.hidden = screen !== SCREEN_TITLE;
  ui.end.hidden = screen !== SCREEN_OVER;
  ui.pause.hidden = screen !== SCREEN_PAUSED;
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
    ui.scoreV.textContent = pad6(w.score);
    ui.distV.textContent = `${Math.floor(w.dist)} / ${GOAL_M} m`;
    ui.progFill.style.width = `${Math.min(100, (w.dist / GOAL_M) * 100)}%`;
    for (let i = 0; i < LIVES; i += 1) ui.drums[i].classList.toggle('lost', i >= w.lives);
    ui.muted.hidden = !muted;
    ui.hint.style.opacity = w.time < 7 ? String(Math.min(1, 7 - w.time)) : '0';
  }
  if (screen === SCREEN_TITLE) {
    pulse(ui.press);
    ui.bestTag.hidden = best <= 0;
    if (best > 0) ui.bestV.textContent = `BEST  ${pad6(best)}`;
  }
  if (screen === SCREEN_OVER) {
    const win = w.over === 'win';
    ui.endTitle.textContent = win ? 'SHE ESCAPED!' : 'CAUGHT!';
    ui.endTitle.className = win ? 'center-line win' : 'center-line lose';
    ui.endReason.textContent = w.overReason;
    ui.endDist.textContent = `DISTANCE  ${Math.floor(w.dist)} / ${GOAL_M} m`;
    ui.endScore.textContent = `SCORE  ${Math.floor(w.score)}    ·    BEST  ${Math.max(best, Math.floor(w.score))}`;
    pulse(ui.endPress);
  }
  // stage banner
  if (w.banner && w.banner.t >= 0 && w.banner.t <= w.banner.life) {
    const a = Math.min(1, w.banner.t * 3, (w.banner.life - w.banner.t) * 2);
    ui.banner.textContent = w.banner.text;
    ui.banner.hidden = a <= 0;
    ui.banner.style.opacity = String(Math.max(0, a));
    ui.bannerSub.hidden = !w.banner.sub || a <= 0;
    if (w.banner.sub) ui.bannerSub.textContent = w.banner.sub;
    if (w.banner.sub) ui.bannerSub.style.opacity = String(Math.max(0, a));
  } else {
    ui.banner.hidden = true;
    ui.bannerSub.hidden = true;
  }
  // score toasts (near misses, corn)
  const toasts = w.toasts || [];
  for (let i = 0; i < ui.toasts.length; i += 1) {
    const el = ui.toasts[i];
    const t = toasts[i];
    if (!t) { el.hidden = true; continue; }
    el.hidden = false;
    el.textContent = t.text;
    el.style.left = `${t.x}px`;
    el.style.top = `${t.y - t.t * 42 - 12}px`;
    el.style.color = t.color || '#fff3dd';
    el.style.opacity = String(Math.max(0, 1 - t.t / t.life));
  }
  // farmer mood mark (! telegraph, ? rest)
  const fm = w.farmer.mode;
  if (fm === 'telegraph' || fm === 'rest') {
    const fx = w.player.sx - w.farmer.gap * PPM;
    ui.mark.hidden = false;
    ui.mark.textContent = fm === 'telegraph' ? '!' : '?';
    ui.mark.className = fm === 'telegraph' ? 'alert' : 'ask';
    ui.mark.style.left = `${fx + (fm === 'telegraph' ? 18 : 22)}px`;
    ui.mark.style.top = `${606 - (fm === 'telegraph' ? 172 : 170)}px`;
  } else {
    ui.mark.hidden = true;
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function playEvents(events) {
  if (events & EVENT_JUMP) sound.jump();
  else if (events & EVENT_FLAP) sound.flap();
  else if (events & EVENT_LAND) sound.land();
  if (events & EVENT_CORN) sound.corn();
  if (events & EVENT_NEAR) sound.near();
  if (events & EVENT_HIT) sound.hit();
  if (events & EVENT_LUNGE) sound.lunge();
  if (events & EVENT_STAGE) sound.stage();
  if (events & EVENT_WIN) sound.win();
  if (events & EVENT_LOSE) sound.lose();
}

function runShot(name) {
  const scene = stageShot(name, world, Number.isFinite(atParam) ? atParam : null);
  let painted = 0;
  const paint = () => {
    renderer.draw(world, scene.screen, 0, sound.isMuted());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      updateDom(scene.screen, scene.best, false);
      window.__shotReady = true;
    }
  };
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen
  // changes and the big moments.
  const announce = (message) => { status.textContent = message; };

  const startGame = () => {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.unlock();
    announce('Run! 900 metres to the farmhouse window. Dodge the farmer, the ovens and the knives.');
  };

  const endGame = () => {
    screen = SCREEN_OVER;
    if (world.score > best) {
      best = world.score;
      saveBest(best);
    }
    announce(world.overReason + ` Distance ${Math.floor(world.dist)} metres, score ${Math.floor(world.score)}. Best ${Math.floor(best)}.`);
  };

  const handleActions = () => {
    const actions = input.takeActions();
    const walkTo = input.takeWalkTarget();
    const start = input.takeJump();
    if (actions & ACTION_MUTE) {
      sound.setMuted(!sound.isMuted());
      announce(sound.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE && (start || walkTo !== null)) { startGame(); return; }
    if (screen === SCREEN_OVER && (start || walkTo !== null)) { startGame(); return; }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (screen === SCREEN_PAUSED && (actions & ACTION_PAUSE || start)) {
      screen = SCREEN_PLAY;
      last = performance.now();
      announce('Running again.');
      return;
    }
  };

  const step = () => {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { dir: 0, jump: false, duck: false, walkTarget: null }, true);
      return;
    }
    const events = world.step(STEP, {
      dir: input.direction(),
      jump: input.takeJump(),
      duck: input.duckHeld(),
      walkTarget: input.takeWalkTarget(),
    }, false);
    playEvents(events);
    if (events & EVENT_OVER) endGame();
  };

  const frame = (now) => {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen !== SCREEN_PLAY && screen !== SCREEN_TITLE) {
      // paused or over: keep the ambient clock for the blinking prompts
      if (screen === SCREEN_OVER) world.step(STEP, { dir: 0, jump: false, duck: false, walkTarget: null }, false);
      renderer.draw(world, screen, best, sound.isMuted());
      updateDom(screen, best, sound.isMuted());
      return;
    }
    while (accumulator >= STEP && screen === SCREEN_PLAY) {
      step();
      accumulator -= STEP;
    }
    if (screen === SCREEN_TITLE) {
      const events = world.step(STEP, { dir: 0, jump: false, duck: false, walkTarget: null }, true);
      void events;
    }
    renderer.draw(world, screen, best, sound.isMuted());
    updateDom(screen, best, sound.isMuted());
  };

  // Leaving the tab pauses a running game rather than letting Brindle feast unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Mabel\'s Gobble-Getaway. Press Space or click to start the run.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
