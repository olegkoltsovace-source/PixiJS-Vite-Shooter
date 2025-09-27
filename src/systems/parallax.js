// Parallax starfield system
// Encapsulates: starfield texture generation, layer creation, layout, and per-frame update.

import * as PIXI from 'pixi.js';

// Internal: generate a starfield texture (small, tiling-friendly)
function makeStarfieldTexture(app, size = 256, stars = 140, color = 0xffffff, alpha = 0.9) {
  const g = new PIXI.Graphics();
  g.beginFill(color, alpha);
  for (let i = 0; i < stars; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.4 + Math.random() * 1.4;
    g.drawCircle(x, y, r);
  }
  g.endFill();
  const tex = app.renderer.generateTexture(g, PIXI.SCALE_MODES.LINEAR, 1);
  g.destroy(true);
  return tex;
}

// Create layers and add to bgContainer. Returns the parallaxLayers array for later updates.
export function initParallax(app, bgContainer) {
  // Create three parallax layers with different densities and tints (matches previous visuals)
  const far = new PIXI.TilingSprite(makeStarfieldTexture(app, 256, 80, 0xffffff, 0.7), app.screen.width, app.screen.height);
  far.tint = 0x99aabb; far.alpha = 0.22; far.blendMode = PIXI.BLEND_MODES.ADD; bgContainer.addChild(far);

  const mid = new PIXI.TilingSprite(makeStarfieldTexture(app, 256, 120, 0xffffff, 0.9), app.screen.width, app.screen.height);
  mid.tint = 0xdde6ff; mid.alpha = 0.28; mid.blendMode = PIXI.BLEND_MODES.ADD; bgContainer.addChild(mid);

  const near = new PIXI.TilingSprite(makeStarfieldTexture(app, 256, 180, 0xffffff, 1.0), app.screen.width, app.screen.height);
  near.tint = 0xffffff; near.alpha = 0.35; near.blendMode = PIXI.BLEND_MODES.ADD; bgContainer.addChild(near);

  const parallaxLayers = [
    { sprite: far,  factor: 24, driftX: 4,  driftY: 2 },
    { sprite: mid,  factor: 12, driftX: 10, driftY: 4 },
    { sprite: near, factor: 6,  driftX: 20, driftY: 8 },
  ];

  layoutParallax(app, parallaxLayers);
  return parallaxLayers;
}

// Ensure layers cover the screen size
export function layoutParallax(app, parallaxLayers) {
  for (const layer of parallaxLayers) {
    layer.sprite.width = app.screen.width;
    layer.sprite.height = app.screen.height;
  }
}

// Apply parallax based on player delta movement plus a gentle drift
export function updateParallax(parallaxLayers, dpx, dpy, dt) {
  for (const layer of parallaxLayers) {
    layer.sprite.tilePosition.x -= dpx / layer.factor;
    layer.sprite.tilePosition.y -= dpy / layer.factor;
    layer.sprite.tilePosition.x += layer.driftX * dt;
    layer.sprite.tilePosition.y += layer.driftY * dt;
  }
}
