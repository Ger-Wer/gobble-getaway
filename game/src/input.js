// Keyboard and pointer input. Held keys give a steering direction and a duck
// flag; one-shot presses (jump, pause, mute) are queued and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// The mouse plays too: a click is a jump and a walk order to the clicked
// screen x, so clicking ahead of a hazard jumps Mabel over it there.

import { FIELD } from './config.js';

export const ACTION_PAUSE = 1;
export const ACTION_MUTE = 2;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);
const DUCK = new Set(['ArrowDown', 'KeyS']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let left = false;
  let right = false;
  let duck = false;
  let jump = false;
  let actions = 0;
  /** The screen x the last click asked Mabel to walk to, or null. */
  let walkTarget = null;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) { left = true; event.preventDefault(); }
    else if (RIGHT.has(event.code)) { right = true; event.preventDefault(); }
    else if (DUCK.has(event.code)) { duck = true; event.preventDefault(); }
    else if (JUMP.has(event.code)) {
      if (!event.repeat) jump = true;
      event.preventDefault();
    } else if (PAUSE.has(event.code) && !event.repeat) actions |= ACTION_PAUSE;
    else if (MUTE.has(event.code) && !event.repeat) actions |= ACTION_MUTE;
    else return;
  });

  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (DUCK.has(event.code)) duck = false;
  });

  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur so Mabel does not keep sprinting into an oven.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    duck = false;
  });

  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    walkTarget = ((event.clientX - rect.left) / rect.width) * FIELD.width;
    jump = true;
    event.preventDefault();
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. Keys only; the walk
     *  order from the mouse is separate so a key press always wins. */
    direction() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    duckHeld() {
      return duck;
    },
    /** Take the queued jump press (a keyboard press or a click). */
    takeJump() {
      const was = jump;
      jump = false;
      return was;
    },
    /** Take the one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Take and clear the pointer's walk order. */
    takeWalkTarget() {
      const was = walkTarget;
      walkTarget = null;
      return was;
    },
  };
}
