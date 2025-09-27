// Pause system: encapsulates auto-pause on tab blur/visibility change and overlay text rendering.
// Usage:
//   import { initPause } from './systems/pause.js'
//   const pauser = initPause(app, { label: 'PAUSED' })
//   // pauser.pause(), pauser.resume(), pauser.setPaused(true|false), pauser.isPaused()
//   // pauser.overlay: PIXI.Text instance (for layout/positioning if needed)
//   // pauser.destroy(): remove listeners and overlay
//
// Design goals:
// - Keep main.js small: all event wiring and overlay creation are centralized here.
// - Stop Pixi ticker when paused to save CPU and fully freeze simulation.
// - Provide minimal API for toggling and status query.

import * as PIXI from 'pixi.js';

export function initPause(app, options = {}) {
  // Internal paused flag
  let paused = false;

  // Configurable label and style
  const label = options.label ?? 'PAUSED';
  const style = options.style ?? new PIXI.TextStyle({
    fill: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
    dropShadow: true,
    dropShadowColor: '#000000',
    dropShadowBlur: 6,
    dropShadowDistance: 0,
  });

  // Create overlay text above the world (added to stage so it renders regardless of world transforms)
  const overlay = new PIXI.Text(label, style);
  overlay.visible = false;
  app.stage.addChild(overlay);

  // Helper: center the overlay on current screen
  const layout = () => {
    overlay.x = (app.screen.width - overlay.width) / 2;
    overlay.y = (app.screen.height - overlay.height) / 2;
  };
  layout();

  // Pause/resume helpers that also toggle the ticker
  const pause = () => {
    if (paused) return;
    paused = true;
    overlay.visible = true;
    layout();
    app.ticker.stop();
  };

  const resume = () => {
    if (!paused) return;
    paused = false;
    overlay.visible = false;
    app.ticker.start();
  };

  const setPaused = (v) => (v ? pause() : resume());
  const isPaused = () => paused;

  // Visibility handler: auto pause on hidden, resume on visible
  const onVisibility = () => {
    if (document.hidden) pause(); else resume();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // Resize handler (optional, useful if consumer doesn't already center it)
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  // Cleanup
  const destroy = () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    if (overlay.parent) overlay.parent.removeChild(overlay);
    overlay.destroy();
  };

  // Return a small API surface to the caller
  return { pause, resume, setPaused, isPaused, overlay, layout, destroy };
}
