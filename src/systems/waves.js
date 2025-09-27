// Waves director: periodic rushes triggered by total kill count thresholds.
// Small, self-contained logic with no FX. Main integrates via onKill() and update().
// API:
//   const waves = initWaves();
//   waves.onKill(kills = 1)
//   waves.update(dt, spawnEnemy, difficulty)
//   waves.isRushActive() -> boolean
//   waves.getBanner() -> { visible, text }

export function initWaves(options = {}) {
  const cfg = {
    killThreshold: options.killThreshold ?? 17,
    nextGapKills: options.nextGapKills ?? 100,
    warningLead: options.warningLead ?? 1.8,     // seconds of warning before rush
    rushDuration: options.rushDuration ?? 2.8,   // seconds of concentrated spawns
    // Rush cadence in seconds between spawns; will be scaled with difficulty
    baseCadence: options.baseCadence ?? 0.14,
    // Base count and scale per difficulty; used to approximate target number of enemies spawned during the rush
    baseCount: options.baseCount ?? 10,
    perDifficulty: options.perDifficulty ?? 2,
  };

  const state = {
    totalKills: 0,
    nextThreshold: cfg.killThreshold,
    mode: 'idle', // idle | warning | rush
    timer: 0,
    direction: null, // 'left' | 'right' | 'top' | 'bottom'
    lastDirection: null,
    // Rush spawning internals
    spawnTimer: 0,
    targetSpawns: 0,
    spawned: 0,
  };

  function pickDirection() {
    const dirs = ['left', 'right', 'top', 'bottom'];
    // Avoid immediate repeat if possible
    const candidates = state.lastDirection ? dirs.filter(d => d !== state.lastDirection) : dirs;
    const dir = candidates[Math.floor(Math.random() * candidates.length)];
    state.lastDirection = dir;
    return dir;
  }

  function onKill(kills = 1) {
    state.totalKills += Math.max(0, kills|0);
    // Trigger a wave if we crossed the next threshold and not already in a wave
    if (state.mode === 'idle' && state.totalKills >= state.nextThreshold) {
      // After triggering a wave, schedule the next one far enough ahead to avoid back-to-back waves
      state.nextThreshold = state.totalKills + cfg.nextGapKills;
      state.mode = 'warning';
      state.timer = cfg.warningLead;
      state.direction = pickDirection();
    }
  }

  function isRushActive() {
    return state.mode === 'rush';
  }

  function getBanner() {
    if (state.mode === 'warning') {
      const dir = state.direction?.toUpperCase?.() ?? 'UNKNOWN';
      return { visible: true, text: `WARNING! Rush inbound from ${dir}` };
    }
    if (state.mode === 'rush') {
      const dir = state.direction?.toUpperCase?.() ?? 'UNKNOWN';
      return { visible: true, text: `RUSH: ${dir}` };
    }
    return { visible: false, text: '' };
  }

  // Compute an edge spawn position along the chosen direction.
  function spawnFromEdge(direction, spawnEnemy, difficulty, screenW, screenH) {
    const margin = 6;
    if (direction === 'left') {
      const y = Math.random() * screenH;
      spawnEnemy(difficulty, { x: margin, y });
    } else if (direction === 'right') {
      const y = Math.random() * screenH;
      spawnEnemy(difficulty, { x: screenW - margin, y });
    } else if (direction === 'top') {
      const x = Math.random() * screenW;
      spawnEnemy(difficulty, { x, y: margin });
    } else if (direction === 'bottom') {
      const x = Math.random() * screenW;
      spawnEnemy(difficulty, { x, y: screenH - margin });
    }
  }

  // Note: update expects spawnEnemy(difficulty, overridePos?) to be able to spawn at specific edges.
  function update(dt, spawnEnemy, difficulty, screenW, screenH) {
    if (state.mode === 'idle') return;

    state.timer -= dt;

    if (state.mode === 'warning') {
      if (state.timer <= 0) {
        // Enter rush mode
        state.mode = 'rush';
        state.timer = cfg.rushDuration;
        state.spawnTimer = 0;
        state.spawned = 0;
        // Approximate target spawns based on difficulty and duration
        state.targetSpawns = Math.max(
          1,
          Math.floor(cfg.baseCount + cfg.perDifficulty * Math.max(1, difficulty))
        );
      }
      return;
    }

    if (state.mode === 'rush') {
      // Spawn cadence: speed up slightly with difficulty
      const cadence = Math.max(0.06, cfg.baseCadence * (1 / Math.min(3, Math.max(1, difficulty / 2))));
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.spawned < state.targetSpawns) {
        spawnFromEdge(state.direction, spawnEnemy, difficulty, screenW, screenH);
        state.spawned++;
        state.spawnTimer += cadence;
      }

      if (state.timer <= 0) {
        state.mode = 'idle';
        state.direction = null;
        state.timer = 0;
      }
    }
  }

  return { onKill, update, isRushActive, getBanner };
}
