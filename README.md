# Pixi.js Top-Down Shooter

A browser-based top-down shooter built with Pixi.js v6 and Vite. Survive endless waves of enemies, chain kills to unlock powers, and use a directional Force Push to clear threatening clusters.

**Live demo:** https://pixi-js-vite-shooter.vercel.app/

---

## Controls

| Input | Action |
|-------|--------|
| WASD / Arrow Keys | Move |
| Mouse | Aim |
| Left Click / Hold | Shoot |
| Right Click | Force Push (cooldown: 2s) |
| R | Restart after game over |

---

## Gameplay

Enemies spawn from the screen edges and chase the player. Difficulty increases continuously — spawn rate accelerates and enemies get faster over time. Every 3 kills charges a power which activates automatically in a rotating cycle.

### Power Cycle (every 3 kills)

Powers rotate in sequence — each activates automatically on the 3rd kill:

| Power | Effect |
|-------|--------|
| **Protective Shield** | Green force field ring repels incoming enemies with impulse |
| **Time Stop** | Slows all enemies to 20% speed for 5 seconds |
| **Destructive Shield** | Red ring around player — doubles movement speed and destroys enemies on contact |
| **Annihilation** | Instant screen-wide pulse that destroys every enemy simultaneously |

### Force Push (Right Click)

Cooldown-gated directional attack. Fires a 60-degree lethal cone toward the cursor, instantly destroying all enemies within range and spawning a visible cone wave with physics impulse.

### Rush Waves

Every 17 kills (then every 100 kills thereafter) a rush event triggers — a warning banner announces the direction, then a concentrated burst of enemies floods in from that edge.

---

## Features

- **Parallax starfield** — three-layer tiling background that shifts with player movement
- **Custom crosshair cursor** — pulsing green/white crosshair replaces the native cursor
- **Additive blending** — bullets, particles, explosions and power rings all use additive blend mode for a glowing neon aesthetic
- **Pixi filter stack** — blur filters on FX, bullet, and enemy containers for depth and glow
- **Hit sparks** — small white burst on bullet impact separate from the death explosion
- **Telegraph spawning** — enemies fade in with a ring indicator before becoming active
- **Screen shake** — camera punch on hits and power activations
- **High score persistence** — saved to localStorage across sessions
- **Auto-pause on tab blur** — game pauses when the window loses focus
- **Enemy-enemy collision** — enemies bounce off each other with physics impulse
- **Knockback** — player and enemies take velocity impulses on collision

---

## Tech Stack

- Pixi.js v6
- Vite
- Vanilla JavaScript (ES Modules)

---

## Architecture

```
src/
├── main.js                  # Game loop, entity management, input wiring
├── config/
│   └── balance.js           # All gameplay constants in one place
├── core/
│   └── containers.js        # Pixi display container setup
├── assets/
│   └── textures.js          # Procedural texture generation (no image files)
├── input/
│   └── input.js             # Keyboard and pointer state
├── systems/
│   ├── parallax.js          # Three-layer starfield parallax
│   ├── shoot.js             # Bullet spawning and muzzle flash
│   ├── spawn.js             # Difficulty curve and spawn interval math
│   ├── waves.js             # Rush wave director
│   ├── powers.js            # All four powers + Force Push wave FX
│   ├── cursor.js            # Custom crosshair cursor
│   └── pause.js             # Auto-pause on visibility change
└── ui/
    └── hud.js               # Score, lives, high score, force push cooldown
```

All visuals are procedurally generated — no image assets. Every sprite, particle, and effect is drawn with Pixi Graphics at startup and cached as a texture.

---

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.