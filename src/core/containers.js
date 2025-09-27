// Display containers module
// Builds and returns all core Pixi containers used by the game.
// This module has no side effects (doesn’t add to stage).

import * as PIXI from 'pixi.js';

export function createContainers() {
  const bgContainer = new PIXI.Container();     // background/parallax lives here
  const world = new PIXI.Container();           // root for gameplay nodes
  const enemyContainer = new PIXI.Container();  // enemies
  const bulletContainer = new PIXI.Container(); // bullets and their trails
  const fxContainer = new PIXI.Container();     // particles, pulses, muzzle flashes

  return { bgContainer, world, enemyContainer, bulletContainer, fxContainer };
}
