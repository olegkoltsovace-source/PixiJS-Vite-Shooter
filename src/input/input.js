// Input module: keyboard and pointer state
// API: initInput(stage, { onRightClick }) -> { keys, pointer: { pos, isDown } }

import * as PIXI from 'pixi.js';

export function initInput(stage, opts = {}) {
  const { onRightClick } = opts;

  const keys = Object.create(null);
  const pointer = {
    pos: new PIXI.Point(0, 0),
    isDown: false,
  };

  // Keyboard
  function onKeyDown(e) {
    keys[e.code] = true;
  }
  function onKeyUp(e) {
    keys[e.code] = false;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Disable context menu so RMB can be used in-game
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // Pointer
  stage.on('pointermove', (e) => {
    pointer.pos.copyFrom(e.data.global);
  });
  stage.on('pointerdown', (e) => {
    const btn = e.data.button;
    if (btn === 2) {
      if (typeof onRightClick === 'function') onRightClick();
    } else {
      pointer.isDown = true;
    }
  });
  stage.on('pointerup', () => { pointer.isDown = false; });
  stage.on('pointerupoutside', () => { pointer.isDown = false; });

  return { keys, pointer };
}
