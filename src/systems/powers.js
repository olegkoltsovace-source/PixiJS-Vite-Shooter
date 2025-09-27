// Powers system: activation and per-frame update for player powers
// Exports initPowers(ctx) which wires required references and returns
// { activateForceField, activateTimeSlow, activateDash, activateAnnihilationAura, updateActivePower }

import { Balance } from '../config/balance.js';

export function initPowers(ctx) {
  const {
    PIXI,
    app,
    fxContainer,
    player,
    enemies,
    pulses,
    addScore,
    explodeAt,
    triggerPowerFeedback,
  } = ctx;

  function activateForceField(options = {}) {
    const life = options.life ?? 5.0;
    const radius = options.radius ?? 140;
    const band = options.band ?? 18;
    const impulse = options.impulse ?? 900;
    const color = options.color ?? 0x4caf50;

    const g = new PIXI.Graphics();
    g.blendMode = PIXI.BLEND_MODES.ADD;
    fxContainer.addChild(g);

    // Activation feedback (flash + camera punch)
    triggerPowerFeedback(14, 0x4caf50, 0.12);

    const power = { type: 'forceField', g, life, age: 0, radius, band, impulse, color, inside: new Set() };

    // On activation, push any enemies currently within the radius to just outside the field
    const margin = 4;
    for (let i = 0; i < enemies.length; i++) {
      const en = enemies[i];
      const dx = en.spr.x - player.x;
      const dy = en.spr.y - player.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      if (dist < radius) {
        const nx = dx / dist, ny = dy / dist;
        const target = radius + margin;
        en.spr.x = player.x + nx * target;
        en.spr.y = player.y + ny * target;
        en.vx += nx * impulse * 0.6;
        en.vy += ny * impulse * 0.6;
      }
    }

    return power;
  }

  function activateTimeSlow(options = {}) {
    const life = options.life ?? 5.0;
    const slowFactor = options.slowFactor ?? 0.2; // 80% slow down
    const g = new PIXI.Graphics();
    g.blendMode = PIXI.BLEND_MODES.ADD;
    fxContainer.addChild(g);
    // Power activation feedback (flash + camera punch)
    triggerPowerFeedback(12, 0x4caf50, 0.12);
    return { type: 'timeSlow', g, life, age: 0, slowFactor };
  }

  // Dash (Destructive Shield)
  // Active power that:
  // - Draws a red ring around the player
  // - Doubles (configurable) the player's movement speed while active
  // - Instantly destroys enemies whose centers enter the ring radius
  function activateDash(options = {}) {
    const dashCfg = Balance.dash || {};
    const life = options.life ?? (dashCfg.duration ?? 5);
    const radius = options.radius ?? (dashCfg.radius ?? 140);
    const band = options.band ?? (dashCfg.band ?? 18);
    const color = options.color ?? (dashCfg.color ?? 0xff4d4f);
    const speedMul = options.speedMultiplier ?? (dashCfg.speedMultiplier ?? 2.0);

    // Visual ring (additive)
    const g = new PIXI.Graphics();
    g.blendMode = PIXI.BLEND_MODES.ADD;
    fxContainer.addChild(g);

    // Activation feedback (light screen punch in red)
    triggerPowerFeedback(10, color, 0.10);

    // Set player tint for the duration of dash
    player.__dashTint = true;
    player.__dashTintColor = color;
    player.tint = color;

    return { type: 'dash', g, life, age: 0, radius, band, color, speedMul };
  }

  function activateAnnihilationAura(options = {}) {
    const life = options.life ?? 0.35;
    const endRadius = options.endRadius ?? Math.hypot(app.screen.width, app.screen.height);
    const band = options.band ?? 34;
    const color = options.color ?? 0x4caf50;

    // Visual pulse
    const g = new PIXI.Graphics();
    g.blendMode = PIXI.BLEND_MODES.ADD;
    fxContainer.addChild(g);
    pulses.push({ g, x: player.x, y: player.y, life, age: 0, endRadius, band, color });
    // Power activation feedback (flash + stronger camera punch)
    triggerPowerFeedback(18, 0x4caf50, 0.12);

    // Destroy all current enemies, award score without counting for next power
    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i];
      explodeAt(en.spr.x, en.spr.y, 0x00c2ff, 36);
      en.spr.destroy();
      enemies.splice(i, 1);
      addScore(1, { countForPower: false });
    }
    // Also add a bit of camera punch
    // The main integrates screen shake via triggerPowerFeedback above
  }

  function updateActivePower(dt, game) {
    const p = game.activePower;
    if (!p) return;
    p.age += dt;

    if (p.type === 'forceField') {
      // Visual (ring around player)
      p.g.clear();
      const alpha = 0.6 * (1 - Math.min(1, p.age / p.life));
      p.g.lineStyle(p.band, p.color, alpha);
      p.g.position.set(player.x, player.y);
      p.g.drawCircle(0, 0, p.radius);

      // Apply impulse to enemies entering the field
      for (let i = 0; i < enemies.length; i++) {
        const en = enemies[i];
        const dx = en.spr.x - player.x;
        const dy = en.spr.y - player.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const wasInside = p.inside.has(en);
        const isInside = dist <= p.radius;
        if (isInside && !wasInside) {
          const nx = dx / dist, ny = dy / dist;
          en.vx += nx * p.impulse;
          en.vy += ny * p.impulse;
          p.inside.add(en);
        } else if (!isInside && wasInside) {
          p.inside.delete(en);
        }
      }
    } else if (p.type === 'dash') {
      // Destructive Shield (Dash): draw red ring and kill contacting enemies
      p.g.clear();
      const t = Math.min(1, p.age / p.life);
      const alpha = 0.7 * (1 - t);
      p.g.lineStyle(p.band, p.color, alpha);
      p.g.position.set(player.x, player.y);
      p.g.drawCircle(0, 0, p.radius);

      // Destroy enemies whose centers lie within the ring radius
      for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        const dx = en.spr.x - player.x;
        const dy = en.spr.y - player.y;
        if (dx * dx + dy * dy <= p.radius * p.radius) {
          explodeAt(en.spr.x, en.spr.y, 0x00c2ff, 26);
          en.spr.destroy();
          enemies.splice(i, 1);
          // Do not count kills during active powers for power progression
          addScore(1, { countForPower: false });
        }
      }
    } else if (p.type === 'timeSlow') {
      // Subtle visual indicator for Time Stop
      p.g.clear();
      const t = Math.min(1, p.age / p.life);
      const alpha = 0.22 + 0.18 * (1 - t);
      const r = 200 + Math.sin(app.ticker.lastTime * 0.02) * 8;
      p.g.lineStyle(10, 0x4caf50, alpha);
      p.g.position.set(player.x, player.y);
      p.g.drawCircle(0, 0, r);
    }

    if (p.age >= p.life) {
      // Cleanup for any power
      if (p.g) p.g.destroy();
      // If dash was active, clear dash tint flag
      if (p.type === 'dash') {
        player.__dashTint = false;
        player.__dashTintColor = undefined;
      }
      game.activePower = null;
      game.killProgress = 0; // must get 3 new kills after power ends
    }
  }

  return {
    activateForceField,
    activateTimeSlow,
    activateDash,
    activateAnnihilationAura,
    updateActivePower,
  };
}
