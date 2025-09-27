// Spawner/difficulty helpers (logic-only, no FX)
// Centralizes difficulty curve and spawn interval math.

import { Balance } from '../config/balance.js';

export function computeDifficulty(timeSec) {
  return 1 + timeSec * Balance.spawn.difficultyGrowthPerSec;
}

function targetInterval(timeSec) {
  return Math.max(
    Balance.spawn.intervalMin,
    Balance.spawn.intervalStart + timeSec * Balance.spawn.intervalSlopePerSec
  );
}

export function smoothInterval(currentInterval, timeSec, dt) {
  const target = targetInterval(timeSec);
  return currentInterval + (target - currentInterval) * Math.min(1, dt * 2);
}

export function rollSpawnTimer(interval) {
  const jitter = Balance.spawn.varianceMin + Math.random() * Balance.spawn.varianceRange;
  return interval * jitter * Balance.spawn.globalMultiplier;
}
