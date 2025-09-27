import * as PIXI from 'pixi.js';
import { createTextures } from './assets/textures.js';
import { initParallax, layoutParallax, updateParallax } from './systems/parallax.js';
import { createContainers } from './core/containers.js';
import { initHud } from './ui/hud.js';
import { initCursor } from './systems/cursor.js';
import { initInput } from './input/input.js';
import { Balance } from './config/balance.js';
import { shoot as shootSystem } from './systems/shoot.js';
import { rollSpawnTimer } from './systems/spawn.js';
import { initWaves } from './systems/waves.js';
import { initPause } from './systems/pause.js';

// --- Basic Application Setup ---
const app = new PIXI.Application({
  resizeTo: window,
  backgroundColor: 0x0d0f1a,
  antialias: true,
});
document.body.appendChild(app.view);
// Hide the native mouse cursor globally. We set it on the canvas and body,
// and also inject a defensive CSS rule to cover any dev overlays or future DOM elements.
app.renderer.view.style.cursor = 'none';
document.body.style.cursor = 'none';
const hideCursorStyle = document.createElement('style');
hideCursorStyle.setAttribute('data-hide-cursor', '');
hideCursorStyle.innerHTML = `
  html, body, canvas { cursor: none !important; }
`;
document.head.appendChild(hideCursorStyle);

// Make stage interactive for pointer events
app.stage.interactive = true;
app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height);

// Root containers
const { bgContainer, world, enemyContainer, bulletContainer, fxContainer } = createContainers();
// Initialize parallax and keep layers array for updates
const parallaxLayers = initParallax(app, bgContainer);

// Add background behind the world
app.stage.addChild(bgContainer, world);
world.addChild(enemyContainer, bulletContainer, fxContainer);

// Add subtle bloom/glow using built-in filters in Pixi v6
// - Blur on FX container softens particles and explosions (cheap pseudo-bloom)
// - Light blur on bullets + additive blend gives a nice glow trail
// - Slight color boost on world increases vibrancy without washing out
const fxBlur = new PIXI.filters.BlurFilter(4);
fxBlur.quality = 2;
fxContainer.filters = [fxBlur];

const bulletBlur = new PIXI.filters.BlurFilter(1.2);
bulletBlur.quality = 1;
bulletContainer.filters = [bulletBlur];

// Enemy glow: light blur + mild brightness for a subtle halo
const enemyBlur = new PIXI.filters.BlurFilter(0.8);
enemyBlur.quality = 1;
const enemyColor = new PIXI.filters.ColorMatrixFilter();
enemyColor.brightness(1.04, true);
enemyColor.saturate(0.1, true);
enemyContainer.filters = [enemyBlur, enemyColor];

const colorBoost = new PIXI.filters.ColorMatrixFilter();
colorBoost.saturate(0.2, true);
colorBoost.brightness(1.06, true);
world.filters = (world.filters || []).concat([colorBoost]);

// Player glow: soft additive halo updated each frame
const playerGlow = new PIXI.Graphics();
playerGlow.blendMode = PIXI.BLEND_MODES.ADD;
playerGlow.filters = [new PIXI.filters.BlurFilter(8)];
fxContainer.addChild(playerGlow);

// Cached textures
const TEX = createTextures(app);

// --- Player ---
const player = new PIXI.Sprite(TEX.player);
player.anchor.set(0.5);
player.x = app.screen.width / 2;
player.y = app.screen.height / 2;
world.addChild(player);
// Track last player position for parallax
let lastPlayerX = player.x;
let lastPlayerY = player.y;

const playerState = {
  speed: Balance.player.speed,
  radius: Balance.player.radius,
  fireRate: Balance.player.fireRate,
  fireCooldown: 0,
  lives: Balance.player.livesStart,
  invuln: 0,
  vx: 0,
  vy: 0,
};

// --- Input (keyboard + pointer) ---
const input = initInput(app.stage, { onRightClick: () => tryForcePush() });
// Add game-specific keys handling
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyR') attemptRestart();
});
// Initialize pointer at center
input.pointer.pos.set(app.screen.width / 2, app.screen.height / 2);

// --- Entities ---
const bullets = [];
const enemies = [];
const particles = [];
const waves = [];
const pulses = [];
// Short-lived muzzle flash FX instances
const muzzleFlashes = [];

function shoot() {
  shootSystem({
    TEX,
    bulletContainer,
    fxContainer,
    player,
    playerState,
    pointerPos: input.pointer.pos,
    bullets,
    onMuzzleFlash: (flash, life)=>{ muzzleFlashes.push({ spr: flash, age: 0, life }); }
  });
}


function spawnEnemy(difficulty = 1, posOverride = null) {
  // Spawn just inside screen from a given edge position or a random side
  const margin = 6;
  const pos = { x: 0, y: 0 };
  if (posOverride && typeof posOverride.x === 'number' && typeof posOverride.y === 'number') {
    pos.x = posOverride.x; pos.y = posOverride.y;
  } else {
    const side = Math.floor(Math.random() * 4); // 0=L,1=R,2=T,3=B
    if (side === 0) { pos.x = margin; pos.y = Math.random() * app.screen.height; }
    if (side === 1) { pos.x = app.screen.width - margin; pos.y = Math.random() * app.screen.height; }
    if (side === 2) { pos.x = Math.random() * app.screen.width; pos.y = margin; }
    if (side === 3) { pos.x = Math.random() * app.screen.width; pos.y = app.screen.height - margin; }
  }

  const spr = new PIXI.Sprite(TEX.enemy);
  spr.anchor.set(0.5);
  spr.x = pos.x;
  spr.y = pos.y;
  spr.alpha = 0; // fade-in during telegraph
  enemyContainer.addChild(spr);

  // Telegraph: quick, faint ring at spawn position
  // Uses existing pulses system for a one-shot expanding ring
  {
    const g = new PIXI.Graphics();
    g.blendMode = PIXI.BLEND_MODES.ADD;
    fxContainer.addChild(g);
    pulses.push({ g, x: pos.x, y: pos.y, life: 0.25, age: 0, endRadius: 14 * 2.2, band: 12, color: 0x00c2ff });
  }

  // Speed scales with difficulty
  const base = Balance.enemy.baseSpeed;
  const extra = Balance.enemy.difficultySpeedFactor * Math.min(difficulty, 6);
  const speed = (base + extra + Math.random() * Balance.enemy.randomSpeedJitter) * 0.8;
  const radius = Balance.enemy.radius;

  // spawnLock: enemy will not move while the telegraph plays; also used for fade-in
  enemies.push({ spr, speed, radius, hp: 1, vx: 0, vy: 0, spawnLock: Balance.enemy.spawnLock, spawnLockTotal: Balance.enemy.spawnLock });
}

function explodeAt(x, y, color = 0xffffff, count = 12) {
  // Make blue explosions (enemy deaths) more prominent with extra speed, size, and glow
  const isBlue = color === 0x00c2ff;
  for (let i = 0; i < count; i++) {
    const p = new PIXI.Sprite(TEX.particle);
    p.tint = color;
    p.anchor.set(0.5);
    p.blendMode = PIXI.BLEND_MODES.ADD;
    p.x = x; p.y = y;
    const a = Math.random() * Math.PI * 2;
    const speedBoost = isBlue ? 1.4 : 1.0;
    const sizeBase = isBlue ? 1.4 : 1.0;
    const s = (80 + Math.random() * 140) * speedBoost;
    const life = (0.4 + Math.random() * 0.5) * (isBlue ? 1.1 : 1.0);
    p.scale.set(sizeBase * (0.9 + Math.random() * 0.6));
    particles.push({ spr: p, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, age: 0 });
    fxContainer.addChild(p);
  }
}

// Small white hit-spark burst for tactile bullet impacts (separate from death explosion)
function spawnHitSparks(x, y, count = 5) {
  for (let i = 0; i < count; i++) {
    const p = new PIXI.Sprite(TEX.particle);
    p.tint = 0xffffff;
    p.anchor.set(0.5);
    p.blendMode = PIXI.BLEND_MODES.ADD;
    p.x = x; p.y = y;
    const a = Math.random() * Math.PI * 2;
    const s = 220 + Math.random() * 180; // fast, tiny sparks
    const life = 0.12 + Math.random() * 0.12;
    p.scale.set(0.7 + Math.random() * 0.5);
    particles.push({ spr: p, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, age: 0 });
    fxContainer.addChild(p);
  }
}

function tryForcePush() {
  // Right-click "Force Push": cooldown-gated, lethal cone clear
  if (game.isOver) return;
  if (game.forcePushCooldown > 0) return; // still recharging

  const ang = Math.atan2(input.pointer.pos.y - player.y, input.pointer.pos.x - player.x);

  // Instantaneously destroy all enemies within a forward cone to make this tactically useful.
  // Visual wave is still spawned for feedback.
  const opts = { halfAngle: Balance.forcePush.halfAngleRad, maxRange: Math.min(680, Math.hypot(app.screen.width, app.screen.height) * Balance.forcePush.maxRangeScreenDiagFactor) };
  const killed = killEnemiesInCone(player.x, player.y, ang, opts);
  // Pass wider visuals explicitly for consistency with lethal cone
  spawnConeWave(player.x, player.y, ang, { halfAngle: opts.halfAngle, endRadius: 680, band: 56 });
  // Brief green flash to sell the power hit
  triggerPowerFeedback(10, 0x4caf50, 0.08);

  // Start cooldown and reflect in UI immediately
  game.forcePushCooldown = Balance.forcePush.cooldown;
  hud.setForceCooldown(game.forcePushCooldown);

  // Small extra camera punch if many enemies were cleared
  if (killed >= 3) game.shake = Math.max(game.shake, 12);
}

function spawnConeWave(x, y, angle, options = {}) {
  // Wider, longer, thicker visual for a more powerful feel
  const halfAngle = options.halfAngle ?? (Math.PI / 3); // 60 degrees
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
  game.shake = Math.max(game.shake, 8);
}

// Destroy all enemies within a cone originating at (cx, cy), facing `angle`.
// Returns the number of enemies removed. Used by Force Push to be tactically strong.
function killEnemiesInCone(cx, cy, angle, { halfAngle = Math.PI / 6, maxRange = 520 } = {}) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const cosMax = Math.cos(halfAngle);
  let killed = 0;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    const dx = en.spr.x - cx;
    const dy = en.spr.y - cy;
    const dist = Math.hypot(dx, dy) || 0.0001;
    if (dist > maxRange) continue;
    const vx = dx / dist, vy = dy / dist;
    if (vx * ux + vy * uy >= cosMax) {
      explodeAt(en.spr.x, en.spr.y, 0x00c2ff, 26);
      en.spr.destroy(); enemies.splice(i, 1);
      addScore(1);
      killed++;
    }
  }
  return killed;
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
  // Guard against missing config by using optional chaining and sane defaults
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
  game.shake = Math.max(game.shake, 18);
}

// --- UI (HUD) ---
const hud = initHud(app);
const { overlay: hudOverlay } = hud;

// Waves director (rush + banner)
const rush = initWaves();
const waveBanner = new PIXI.Text('', new PIXI.TextStyle({ fill: '#ff5252', fontSize: 24, fontWeight: '900' }));
waveBanner.visible = false;
app.stage.addChild(waveBanner);

// Pause system: encapsulates overlay + auto-pause on tab hide
const pauser = initPause(app, { label: 'PAUSED' });

// --- Custom Cursor (high-visibility crosshair) ---
const cursor = initCursor(app);



// Screen-space green flash for power activation (drawn above everything)
// Fades very quickly to give powers more punch without being distracting.
const powerFlashG = new PIXI.Graphics();
app.stage.addChild(powerFlashG);
const powerFlash = { age: 0, life: 0, color: 0x4caf50 };
function triggerPowerFeedback(strength = 14, color = 0x4caf50, duration = 0.12) {
  powerFlash.age = 0;
  powerFlash.life = duration;
  powerFlash.color = color;
  // Low-frequency camera punch
  game.shake = Math.max(game.shake, strength);
}


window.addEventListener('resize', () => {
  hud.layout();
  hudOverlay.layout();
  layoutParallax(app, parallaxLayers);
  // Clamp player to screen after resize
  const pr = playerState.radius;
  player.x = Math.max(pr, Math.min(app.screen.width - pr, player.x));
  player.y = Math.max(pr, Math.min(app.screen.height - pr, player.y));
  // Also re-center pause overlay (module provides a layout method)
  if (pauser && pauser.layout) pauser.layout();
});

// --- Game State ---
const game = {
  score: 0,
  isOver: false,
  // Note: pause state now lives in the pause system; keeping this flag is unnecessary,
  // but retained here if other systems ever need to query it indirectly.
  paused: false,
  spawnInterval: 1.2,
  spawnTimer: 0,
  difficultyTime: 0,
  shake: 0,
  forcePushCooldown: 0,
  forcePushCooldownMax: 2,
  activePower: null,
  killProgress: 0,
  powerIndex: 0, // 0: shield, 1: aura, 2: time slow
};

function activateNextPower() {
  // Power cycle (4-step):
  // 0: Protective Shield (force field)
  // 1: Time Stop (time slow)
  // 2: Destructive Shield (Dash)
  // 3: Annihilation (instant kill-all)
  if (game.activePower) return;
  const idx = game.powerIndex % 4;

  if (idx === 0) {
    // Protective Shield (active)
    game.activePower = activateForceField();
    game.powerIndex = 1;
  } else if (idx === 1) {
    // Time Stop (active)
    game.activePower = activateTimeSlow();
    game.powerIndex = 2;
  } else if (idx === 2) {
    // Destructive Shield / Dash (active)
    game.activePower = activateDash();
    game.powerIndex = 3;
  } else {
    // Annihilation (instant)
    game.powerIndex = 0;
    setTimeout(() => {
      if (!game.isOver) {
        activateAnnihilationAura();
        game.killProgress = 0;
      }
    }, 0);
  }
}

function activateForceField(options = {}) {
  const life = options.life ?? 5.0;
  const radius = options.radius ?? 140;
  const band = options.band ?? 18;
  const impulse = options.impulse ?? 900;
  const color = options.color ?? 0x4caf50;

  const g = new PIXI.Graphics();
  g.blendMode = PIXI.BLEND_MODES.ADD;
  fxContainer.addChild(g);
  // Power activation feedback (flash + camera punch)
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

function updateActivePower(dt) {
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
    if (p.g) p.g.destroy();
    game.activePower = null;
    game.killProgress = 0; // must get 3 new kills after power ends
  }
}

function setScore(v) {
  game.score = v;
  hud.setScore(v);
}

function addScore(delta = 1, opts = {}) {
  // Centralized score increment and power progression only
  const countForPower = opts.countForPower !== false;
  const prev = game.score;
  setScore(prev + delta);
  if (delta > 0) {
    // Count all kills towards rush director
    rush.onKill(delta);
  }
  if (countForPower && !game.activePower) {
    game.killProgress += delta;
    if (game.killProgress >= 3) {
      game.killProgress -= 3;
      activateNextPower();
    }
  }
}

function setLives(v) { playerState.lives = v; hud.setLives(v); }


function damagePlayer(hitX, hitY, applyKnockback = true) {
  if (playerState.invuln > 0 || game.isOver) return;
  setLives(playerState.lives - 1);
  playerState.invuln = Balance.player.invulnDuration; // seconds
  flash(player, 0xff4d4f, 0xffffff, 200);
  game.shake = Math.max(game.shake, 12);
  // Knockback away from impact point (optional)
  if (applyKnockback && typeof hitX === 'number' && typeof hitY === 'number') {
    const dx = player.x - hitX;
    const dy = player.y - hitY;
    const len = Math.hypot(dx, dy) || 1;
    const k = Balance.player.knockbackImpulse; // strength
    playerState.vx += (dx / len) * k;
    playerState.vy += (dy / len) * k;
  }
  if (playerState.lives <= 0) endGame();
}

function endGame() {
  game.isOver = true;
  hudOverlay.show();
}


function attemptRestart() {
  if (!game.isOver) return;
  // Clear entities
  for (const b of bullets) { b.spr.destroy(); }
  for (const en of enemies) { en.spr.destroy(); }
  for (const p of particles) { p.spr.destroy(); }
  bullets.length = 0; enemies.length = 0; particles.length = 0;
  for (const w of waves) { if (w.g) w.g.destroy(); }
  waves.length = 0;
  for (const p of pulses) { if (p.g) p.g.destroy(); }
  pulses.length = 0;

  // Reset state
  setScore(0);
  setLives(Balance.player.livesStart);
  player.x = app.screen.width / 2;
  player.y = app.screen.height / 2;
  input.pointer.pos.set(player.x, player.y - 50);
  playerState.invuln = Balance.player.invulnDuration;
  playerState.vx = 0; playerState.vy = 0;
  game.spawnInterval = 1.2; game.spawnTimer = 0; game.difficultyTime = 0; game.shake = 0; game.isOver = false;
  hudOverlay.hide();
  if (game.activePower && game.activePower.g) { game.activePower.g.destroy(); }
  game.activePower = null;
  game.killProgress = 0;

  // Reset Force Push cooldown UI
  game.forcePushCooldown = 0;
  hud.setForceCooldown(0);
  }

function getEnemySpeedMultiplier() {
  const p = game.activePower;
  if (p && p.type === 'timeSlow') return p.slowFactor ?? 0.2;
  return 1;
}

// --- Visual helpers ---
function flash(displayObject, colorA = 0xffd166, colorB = 0xffffff, durationMs = 120) {
  const original = displayObject.tint;
  displayObject.tint = colorA;
  setTimeout(() => { displayObject.tint = colorB; }, durationMs);
  setTimeout(() => { displayObject.tint = original; }, durationMs * 2);
}

// --- Main Update Loop ---
app.ticker.add((delta) => {
  const dt = delta / 60; // normalize to seconds assuming 60 FPS baseline

  // Update player rotation to face pointer
  const dx = input.pointer.pos.x - player.x;
  const dy = input.pointer.pos.y - player.y;
  player.rotation = Math.atan2(dy, dx) + Math.PI / 2; // ship triangle faces up in local tex

  // Movement
  let mx = 0, my = 0;
  if (input.keys['KeyW'] || input.keys['ArrowUp']) my -= 1;
  if (input.keys['KeyS'] || input.keys['ArrowDown']) my += 1;
  if (input.keys['KeyA'] || input.keys['ArrowLeft']) mx -= 1;
  if (input.keys['KeyD'] || input.keys['ArrowRight']) mx += 1;
  if (mx !== 0 || my !== 0) {
  const len = Math.hypot(mx, my);
  mx /= len; my /= len;
  }
  // Apply power-based speed multiplier (Dash makes the player faster while active)
  const speedMul = (game.activePower && game.activePower.type === 'dash') ? (game.activePower.speedMul || 1) : 1;
  player.x += mx * playerState.speed * speedMul * dt;
  player.y += my * playerState.speed * speedMul * dt;
  // Apply knockback velocity with damping
  player.x += playerState.vx * dt;
  player.y += playerState.vy * dt;
  const damp = Math.exp(-Balance.player.dampingExp * dt); // exponential damping
  playerState.vx *= damp;
  playerState.vy *= damp;

  // Clamp to screen
  const pr = playerState.radius;
  player.x = Math.max(pr, Math.min(app.screen.width - pr, player.x));
  player.y = Math.max(pr, Math.min(app.screen.height - pr, player.y));

  // Parallax update (move starfield opposite to player movement, plus gentle drift)
  {
    const dpx = player.x - lastPlayerX;
    const dpy = player.y - lastPlayerY;
    updateParallax(parallaxLayers, dpx, dpy, dt);
    lastPlayerX = player.x;
    lastPlayerY = player.y;
  }

  // Cursor follows the pointer (custom crosshair with a subtle pulse)
  cursor.update(input.pointer.pos, app.ticker.lastTime / 1000);

  // Force Push cooldown timer + UI text (right-aligned). Updates every frame.
  if (game.forcePushCooldown > 0) {
    game.forcePushCooldown = Math.max(0, game.forcePushCooldown - dt);
    hud.setForceCooldown(game.forcePushCooldown);
  } else {
    hud.setForceCooldown(0);
  }

  // Shooting
  playerState.fireCooldown -= dt;
  if ((input.pointer.isDown || input.keys['Space']) && playerState.fireCooldown <= 0 && !game.isOver) {
    shoot();
    playerState.fireCooldown = 1 / playerState.fireRate;
  }

  // Spawn enemies
  game.spawnTimer -= dt;
  game.difficultyTime += dt;
  const difficulty = 1 + game.difficultyTime * Balance.spawn.difficultyGrowthPerSec;
  const targetInterval = Math.max(Balance.spawn.intervalMin, Balance.spawn.intervalStart + game.difficultyTime * Balance.spawn.intervalSlopePerSec);
  // Smoothly approach target interval
  game.spawnInterval += (targetInterval - game.spawnInterval) * Math.min(1, dt * 2);
  if (game.spawnTimer <= 0 && !game.isOver && !rush.isRushActive()) {
    spawnEnemy(difficulty);
    game.spawnTimer = rollSpawnTimer(game.spawnInterval);
  }
  // Waves: update (may spawn concentrated enemies from one edge) and update banner
  rush.update(dt, (diff, pos) => spawnEnemy(diff, pos), difficulty, app.screen.width, app.screen.height);
  {
    const b = rush.getBanner();
    waveBanner.visible = !!b.visible;
    if (b.visible) {
      waveBanner.text = b.text;
      waveBanner.x = (app.screen.width - waveBanner.width) / 2;
      waveBanner.y = 64;
    }
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.spr.x += b.vx * dt;
    b.spr.y += b.vy * dt;
    b.life += dt;

    // Update the trail to stretch opposite the velocity and follow the bullet
    if (b.trail) {
      const spd = Math.hypot(b.vx, b.vy) || 1;
      const len = Math.max(10, Math.min(60, spd * 0.06));
      b.trail.rotation = b.spr.rotation;
      b.trail.width = 3;
      b.trail.height = len;
      b.trail.alpha = 0.18 + Math.min(0.28, spd / 1400 * 0.3);
      b.trail.x = b.spr.x - (b.vx / spd) * len * 0.5;
      b.trail.y = b.spr.y - (b.vy / spd) * len * 0.5;
    }

    // Remove if off-screen or too old
    if (
      b.spr.x < -20 || b.spr.x > app.screen.width + 20 ||
      b.spr.y < -20 || b.spr.y > app.screen.height + 20 ||
      b.life > Balance.bullet.lifetime
    ) {
      b.spr.destroy();
      if (b.trail) b.trail.destroy();
      bullets.splice(i, 1);
    }
  }

  // Update enemies (seek player)
  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];

    // Spawn telegraph lock: fade-in and hold before starting movement
    if (en.spawnLock && en.spawnLock > 0) {
      en.spawnLock -= dt;
      en.spr.alpha = 1 - (en.spawnLock / en.spawnLockTotal);
      continue;
    }

    const dx = player.x - en.spr.x;
    const dy = player.y - en.spr.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const slowMul = getEnemySpeedMultiplier();
    en.spr.x += ux * en.speed * dt * slowMul;
    en.spr.y += uy * en.speed * dt * slowMul;
    // Apply enemy knockback velocity with damping
    en.spr.x += en.vx * dt;
    en.spr.y += en.vy * dt;
    const edamp = Math.exp(-Balance.player.dampingExp * dt);
    en.vx *= edamp;
    en.vy *= edamp;

    // Collide with player
    const dist2 = (player.x - en.spr.x) ** 2 + (player.y - en.spr.y) ** 2;
    const rad = en.radius + playerState.radius;
    if (dist2 <= rad * rad) {
    const len = Math.sqrt(dist2) || 1;
    const nx = (player.x - en.spr.x) / len;
    const ny = (player.y - en.spr.y) / len;
    // Separate positions to prevent sinking
    const overlap = rad - len;
    const sep = overlap + 0.01;
    player.x += nx * (sep * 0.5);
    player.y += ny * (sep * 0.5);
    en.spr.x -= nx * (sep * 0.5);
    en.spr.y -= ny * (sep * 0.5);
    // Apply bounce impulses
    const impulse = 360;
    playerState.vx += nx * impulse;
    playerState.vy += ny * impulse;
    en.vx -= nx * (impulse * 0.9);
    en.vy -= ny * (impulse * 0.9);
    // FX and damage (without extra knockback)
    explodeAt((player.x + en.spr.x) * 0.5, (player.y + en.spr.y) * 0.5, 0xff4d4f, 8);
    damagePlayer(en.spr.x, en.spr.y, false);
    continue;
    }
  }

  // Active power update
  updateActivePower(dt);

  // Pulse rings update (visual only)
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.age += dt;
    const t = Math.min(1, p.age / p.life);
    const r = t * p.endRadius;
    const alpha = 0.95 * (1 - t);
    p.g.clear();
    p.g.lineStyle(p.band, p.color, alpha);
    p.g.position.set(p.x, p.y);
    p.g.drawCircle(0, 0, r);
    if (p.age >= p.life) {
      p.g.destroy();
      pulses.splice(i, 1);
    }
  }

  // Cone force waves update and impulse application
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

  // Enemy vs enemy collisions (bounce, no damage)
  for (let a = 0; a < enemies.length; a++) {
    const A = enemies[a];
    for (let b = a + 1; b < enemies.length; b++) {
      const B = enemies[b];
      const dx = B.spr.x - A.spr.x;
      const dy = B.spr.y - A.spr.y;
      const dist2 = dx * dx + dy * dy;
      const rad = A.radius + B.radius;
      if (dist2 > 0 && dist2 < rad * rad) {
        const dist = Math.sqrt(dist2) || 0.0001;
        const nx = dx / dist, ny = dy / dist;
        // Separate positions equally to resolve overlap
        const overlap = rad - dist;
        const sep = overlap + 0.01;
        A.spr.x -= nx * sep * 0.5;
        A.spr.y -= ny * sep * 0.5;
        B.spr.x += nx * sep * 0.5;
        B.spr.y += ny * sep * 0.5;
        // Apply symmetric bounce impulses
        const impulse = Balance.enemy.bounceImpulse;
        A.vx -= nx * impulse;
        A.vy -= ny * impulse;
        B.vx += nx * impulse;
        B.vy += ny * impulse;
      }
    }
  }

  // Bullet vs enemy collisions (single target)
  for (let j = bullets.length - 1; j >= 0; j--) {
    const b = bullets[j];
    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i];
      const dx = en.spr.x - b.spr.x;
      const dy = en.spr.y - b.spr.y;
      const rad = en.radius + b.radius;
      if (dx * dx + dy * dy <= rad * rad) {
        // Immediate hit sparks for tactile impact
        spawnHitSparks(b.spr.x, b.spr.y, 4 + Math.floor(Math.random() * 3));
        // Blue death burst for the enemy
        explodeAt(en.spr.x, en.spr.y, 0x00c2ff, 26);
        b.spr.destroy(); if (b.trail) b.trail.destroy(); bullets.splice(j, 1);
        en.spr.destroy(); enemies.splice(i, 1);
        addScore(1);
        break;
      }
    }
  }

  // Update particles (simple fade + move)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    p.spr.x += p.vx * dt;
    p.spr.y += p.vy * dt;
    const t = p.age / p.life;
    p.spr.alpha = Math.max(0, 1 - t);
    if (p.age >= p.life) {
      p.spr.destroy();
      particles.splice(i, 1);
    }
  }

  // Update player glow halo (soft additive circle around the ship)
  playerGlow.clear()
    .beginFill(0x4caf50, 0.25)
    .drawCircle(player.x, player.y, playerState.radius * 1.6)
    .endFill();

  // Update muzzle flashes (very short life, scale and alpha decay)
  for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
    const f = muzzleFlashes[i];
    f.age += dt;
    const t = f.age / f.life;
    f.spr.alpha = Math.max(0, 1 - t) * 0.9;
    const s = 1 + t * 0.6;
    f.spr.scale.set(s, s);
    if (f.age >= f.life) {
      f.spr.destroy();
      muzzleFlashes.splice(i, 1);
    }
  }

  // Invulnerability timer visual feedback
  if (playerState.invuln > 0) {
    playerState.invuln -= dt;
    player.alpha = 0.5 + Math.sin(app.ticker.lastTime * 0.05) * 0.25;
    if (playerState.invuln <= 0) player.alpha = 1;
  }

  // Simple screen shake when hit
  if (game.shake > 0) {
    game.shake -= 50 * dt;
    const s = Math.max(0, game.shake);
    world.x = (Math.random() - 0.5) * s;
    world.y = (Math.random() - 0.5) * s;
  } else {
    world.x = world.y = 0;
  }

  // Power activation screen flash overlay (green), fades quickly
  if (powerFlash.life > 0) {
    powerFlash.age += dt;
    const t = Math.min(1, powerFlash.age / powerFlash.life);
    const alpha = 0.22 * (1 - t);
    powerFlashG.clear().beginFill(powerFlash.color, alpha).drawRect(0, 0, app.screen.width, app.screen.height).endFill();
    if (powerFlash.age >= powerFlash.life) {
      powerFlash.life = 0;
      powerFlashG.clear();
    }
  }
});

// Start with a small invulnerability grace period
playerState.invuln = Balance.player.invulnDuration;

// --- DEBUG/Quality-of-life ---
// Spawn a few enemies initially to see action fast
for (let i = 0; i < 4; i++) setTimeout(() => spawnEnemy(1), 300 + i * 200);
