// Centralized gameplay balance/config constants (no FX-related values).
// Import this in systems to avoid magic numbers and ease tuning.

export const Balance = {
  player: {
    speed: 280,              // px/s
    radius: 16,              // collision radius
    fireRate: 10,            // bullets per second
    invulnDuration: 1.2,     // seconds after hit
    knockbackImpulse: 420,   // player knockback impulse on damage
    dampingExp: 6,           // exponential damping exponent for velocities
  },

  bullet: {
    speed: 650,              // px/s
    radius: 5,
    lifetime: 2.0,           // seconds
  },

  enemy: {
    radius: 14,
    baseSpeed: 60,
    difficultySpeedFactor: 70,   // scales with difficulty (clamped in code)
    randomSpeedJitter: 40,       // additional random speed
    bounceImpulse: 260,          // enemy-enemy bounce impulse
    spawnLock: 0.25,             // spawn telegraph lock/fade-in duration
  },

  spawn: {
    difficultyGrowthPerSec: 0.105,  // difficulty = 1 + t * this
    intervalStart: 1.2,             // starting spawn interval
    intervalSlopePerSec: -0.035,    // interval decreases by this per sec (clamped by intervalMin)
    intervalMin: 0.25,              // minimum spawn interval
    varianceMin: 0.6,               // actual interval multiplier min
    varianceRange: 0.8,             // actual multiplier range (min .. min+range)
    globalMultiplier: 1.35,         // overall spawn multiplier
  },

  forcePush: {
    cooldown: 2.0,                  // seconds
    halfAngleRad: Math.PI / 3,      // 60 degrees lethal cone
    maxRangeScreenDiagFactor: 0.75, // fraction of screen diagonal for max lethal range
  },
};
