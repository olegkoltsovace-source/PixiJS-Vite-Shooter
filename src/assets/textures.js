// Textures module
// Centralizes generation of all cached textures used by the game.
// Call createTextures(app) once at startup and reuse the returned textures.

import * as PIXI from 'pixi.js';

// --- Texture builders ---
function makeTriangleTexture(app, size = 22, fill = 0x4caf50, outline = 0xffffff) {
  const g = new PIXI.Graphics();
  g.lineStyle(2, outline, 0.9);
  g.beginFill(fill, 1);
  g.drawPolygon([
    0, -size,
    size * 0.7, size * 0.9,
    0, size * 0.5,
    -size * 0.7, size * 0.9,
  ]);
  g.endFill();// scale=2 to reduce aliasing on rotation
  const tex = app.renderer.generateTexture(g, PIXI.SCALE_MODES.LINEAR, 2);
  g.destroy(true);
  return tex;
}

function makeCircleTexture(app, radius = 14, fill = 0xff4757, outline = 0xffffff) {
  const g = new PIXI.Graphics();
  g.lineStyle(2, outline, 0.6);
  g.beginFill(fill, 1);
  g.drawCircle(0, 0, radius);
  g.endFill();
  const tex = app.renderer.generateTexture(g, PIXI.SCALE_MODES.LINEAR, 2);
  g.destroy(true);
  return tex;
}

function makeBulletTexture(app, w = 4, h = 10, fill = 0x4caf50) {
  const g = new PIXI.Graphics();
  g.beginFill(fill, 1);
  g.drawRoundedRect(-w / 2, -h / 2, w, h, 2);
  g.endFill();
  const tex = app.renderer.generateTexture(g, PIXI.SCALE_MODES.LINEAR, 2);
  g.destroy(true);
  return tex;
}

function makeParticleTexture(app, radius = 2, fill = 0xffffff) {
  const g = new PIXI.Graphics();
  g.beginFill(fill, 1);
  g.drawCircle(0, 0, radius);
  g.endFill();
  const tex = app.renderer.generateTexture(g, PIXI.SCALE_MODES.LINEAR, 2);
  g.destroy(true);
  return tex;
}

function makeTrailTexture(app, w = 3, h = 28, color = 0xffffff, alpha = 1) {
  const g = new PIXI.Graphics();
  g.beginFill(color, alpha);
  g.drawRoundedRect(-w / 2, -h, w, h, 1);
  g.endFill();
  const tex = app.renderer.generateTexture(g, PIXI.SCALE_MODES.LINEAR, 2);
  g.destroy(true);
  return tex;
}

function makeMuzzleFlashTexture(app, size = 18, color = 0xffffff) {
  const g = new PIXI.Graphics();
  g.beginFill(color, 1);
  g.drawPolygon([
    0, -size * 0.9,
    size * 0.45, size * 0.6,
    -size * 0.45, size * 0.6,
  ]);
  g.endFill();
  const tex = app.renderer.generateTexture(g, PIXI.SCALE_MODES.LINEAR, 2);
  g.destroy(true);
  return tex;
}

// --- Public factory ---
export function createTextures(app) {
  // Mirror sizes/colors currently used in the game to preserve visuals
  const textures = {
    player: makeTriangleTexture(app, 22, 0x4caf50),
    enemy: makeCircleTexture(app, 14, 0x00c2ff),
    bullet: makeBulletTexture(app, 4, 12, 0x4caf50),
    particle: makeParticleTexture(app, 1.8, 0xffffff),
    trail: makeTrailTexture(app, 3, 28, 0xffffff, 1),
    muzzleFlash: makeMuzzleFlashTexture(app, 18, 0xffffff),
  };
  return textures;
}
