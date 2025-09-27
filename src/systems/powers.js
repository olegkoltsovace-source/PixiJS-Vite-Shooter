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

  // Internal wave FX (cone waves used by Force Push) managed here
  const waves = [];

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

  // Spawn a cone wave visual + impulse ring (used by Force Push)
  function spawnConeWave(x, y, angle, options = {}) {
    const halfAngle = options.halfAngle ?? (Math.PI / 3);
    const life = options.life ?? 0.5;
    const endRadius = options.endRadius ?? 680;
    const band = options.band ?? 48;
    const impulse = options.impulse ?? 2400;
    const color = options.color ?? 0x4caf50;

    const g = new PIXI.Graphics();
    g.blendMode = PIXI.BLEND_MODES.ADD;
    g.position.set(x, y);
    fxContainer.addChild(g);

    const wave = { g, x, y, angle, halfAngle, life, age: 0, endRadius, band, impulse, color, hit: new Set() };
    waves.push(wave);
  }

  function updateWaves(dt) {
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.age += dt;
      const t = Math.min(1, w.age / w.life);
      const r = t * w.endRadius;
      const alpha = 0.9 * (1 - t);
      const start = w.angle - w.halfAngle;
      const end = w.angle + w.halfAngle;

      // draw wave: filled glowing wedge + bold edge + white highlight
      w.g.clear();
      // Soft wedge fill to emphasize the cone area
      w.g.beginFill(w.color, alpha * 0.22);
      w.g.moveTo(0, 0);
      w.g.arc(0, 0, r, start, end);
      w.g.lineTo(0, 0);
      w.g.endFill();
      // Strong colored edge
      w.g.lineStyle(w.band, w.color, alpha);
      w.g.moveTo(Math.cos(start) * r, Math.sin(start) * r);
      w.g.arc(0, 0, r, start, end);
      // White highlight on the leading edge for extra punch
      w.g.lineStyle(Math.max(4, w.band * 0.35), 0xffffff, alpha * 0.8);
      w.g.moveTo(Math.cos(start) * r, Math.sin(start) * r);
      w.g.arc(0, 0, r, start, end);

      // apply impulse to enemies crossing the wave ring within cone
      const ux = Math.cos(w.angle);
      const uy = Math.sin(w.angle);
      const cosMax = Math.cos(w.halfAngle);
      for (let j = 0; j < enemies.length; j++) {
        const en = enemies[j];
        if (w.hit.has(en)) continue;
        const dx = en.spr.x - w.x;
        const dy = en.spr.y - w.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        if (dist < r - w.band || dist > r + w.band) continue;
        const inv = 1 / dist;
        const vx = dx * inv, vy = dy * inv;
        const dot = vx * ux + vy * uy;
        if (dot >= cosMax) {
          const push = w.impulse * (1 - t);
          en.vx += vx * push;
          en.vy += vy * push;
          w.hit.add(en);
        }
      }

      if (w.age >= w.life) {
        w.g.destroy();
        waves.splice(i, 1);
      }
    }
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
    spawnConeWave,
    updateWaves,
  };
}
