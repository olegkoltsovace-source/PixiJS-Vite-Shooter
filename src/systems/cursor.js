// Custom cursor system: draws and updates a high-visibility crosshair
// API: initCursor(app) -> { update(pointerPos, timeSec), view }

import * as PIXI from 'pixi.js';

export function initCursor(app) {
  const cursor = new PIXI.Container();

  const g = new PIXI.Graphics();
  g.blendMode = PIXI.BLEND_MODES.ADD;
  // Outer white ring
  g.lineStyle(2, 0xffffff, 0.95).drawCircle(0, 0, 12);
  // Inner green ring
  g.lineStyle(3, 0x4caf50, 0.95).drawCircle(0, 0, 6);
  // Cross lines (small gaps near center for readability)
  g.lineStyle(2, 0xffffff, 0.95);
  g.moveTo(-18, 0).lineTo(-7, 0);
  g.moveTo(7, 0).lineTo(18, 0);
  g.moveTo(0, -18).lineTo(0, -7);
  g.moveTo(0, 7).lineTo(0, 18);
  // Center dot
  g.beginFill(0x4caf50, 1).drawCircle(0, 0, 2.2).endFill();

  cursor.addChild(g);
  app.stage.addChild(cursor);

  function update(pointerPos, timeSec = 0) {
    const pulse = 1 + 0.06 * Math.sin(timeSec * 6);
    cursor.scale.set(pulse);
    cursor.position.copyFrom(pointerPos);
  }

  return { update, view: cursor };
}
