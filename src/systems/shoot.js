// Shooting system: encapsulates bullet spawning and muzzle flash creation
// Usage:
//   import { shoot } from './systems/shoot.js'
//   shoot({ TEX, bulletContainer, fxContainer, player, playerState, pointerPos, bullets, onMuzzleFlash })

import * as PIXI from 'pixi.js';
import { Balance } from '../config/balance.js';

export function shoot({ TEX, bulletContainer, fxContainer, player, playerState, pointerPos, bullets, onMuzzleFlash }) {
  // Direction from player to pointer
  const dx = pointerPos.x - player.x;
  const dy = pointerPos.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const speed = Balance.bullet.speed; // px/s

  // Compute muzzle point (slightly in front of player) for FX placement
  const muzzleX = player.x + ux * (playerState.radius + 8);
  const muzzleY = player.y + uy * (playerState.radius + 8);
  const rot = Math.atan2(uy, ux) + Math.PI / 2; // textures are vertical

  // Trail sprite (stretched vertically and positioned behind the bullet)
  const trail = new PIXI.Sprite(TEX.trail);
  trail.anchor.set(0.5, 1);
  trail.blendMode = PIXI.BLEND_MODES.ADD;
  trail.alpha = 0.28;
  trail.rotation = rot;
  trail.x = muzzleX; trail.y = muzzleY;
  bulletContainer.addChild(trail);

  // Bullet sprite
  const spr = new PIXI.Sprite(TEX.bullet);
  spr.anchor.set(0.5);
  spr.tint = 0x4caf50;
  spr.blendMode = PIXI.BLEND_MODES.ADD; // additive bullets glow with the blur filter
  spr.rotation = rot;
  spr.x = muzzleX;
  spr.y = muzzleY;
  bulletContainer.addChild(spr);

  // Muzzle flash (very short-lived, additive)
  const flash = new PIXI.Sprite(TEX.muzzleFlash);
  flash.anchor.set(0.5, 1);
  flash.tint = 0x4caf50;
  flash.blendMode = PIXI.BLEND_MODES.ADD;
  flash.rotation = rot;
  flash.x = muzzleX; flash.y = muzzleY;
  flash.alpha = 0.9;
  flash.scale.set(0.9 + Math.random() * 0.3);
  fxContainer.addChild(flash);
  if (typeof onMuzzleFlash === 'function') onMuzzleFlash(flash, 0.08);

  bullets.push({ spr, vx: ux * speed, vy: uy * speed, life: 0, radius: Balance.bullet.radius, trail });
}
