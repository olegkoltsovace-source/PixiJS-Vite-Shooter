// HUD/UI module: score, lives, force push cooldown, and game over overlay
// Provides initHud(app) -> { setScore, setLives, setForceCooldown, layout, overlay }

import * as PIXI from 'pixi.js';

export function initHud(app) {
  // Styles
  const uiStyleSmall = new PIXI.TextStyle({ fill: '#a9b4d0', fontSize: 16, letterSpacing: 0.5 });
  const uiStyle = new PIXI.TextStyle({ fill: '#ffffff', fontSize: 22, fontWeight: '700' });
  const titleStyle = new PIXI.TextStyle({ fill: '#ffffff', fontSize: 42, fontWeight: '900' });

  // Score (left)
  const scoreLabel = new PIXI.Text('Score', uiStyleSmall);
  scoreLabel.x = 16; scoreLabel.y = 12;
  const scoreText = new PIXI.Text('0', uiStyle);
  scoreText.x = 16; scoreText.y = 32;

  // Lives and Force Push cooldown (right)
  const livesLabel = new PIXI.Text('Lives', uiStyleSmall);
  const livesText = new PIXI.Text('300', uiStyle);

  const forceLabel = new PIXI.Text('Force Push', uiStyleSmall);
  const forceText = new PIXI.Text('Ready', uiStyle);

  app.stage.addChild(scoreLabel, scoreText, livesLabel, livesText, forceLabel, forceText);

  // Game Over overlay
  const overlay = new PIXI.Container();
  const overlayBg = new PIXI.Graphics().beginFill(0x000000, 0.5).drawRect(0, 0, app.screen.width, app.screen.height).endFill();
  const gameOverText = new PIXI.Text('GAME OVER', titleStyle);
  const hintText = new PIXI.Text('Press R to restart', uiStyle);
  overlay.addChild(overlayBg, gameOverText, hintText);
  overlay.visible = false;
  app.stage.addChild(overlay);

  function layout() {
    // Right align lives and cooldown blocks
    livesLabel.x = app.screen.width - livesLabel.width - 16;
    livesLabel.y = 12;
    livesText.x = app.screen.width - livesText.width - 16;
    livesText.y = 32;

    forceLabel.x = app.screen.width - forceLabel.width - 16;
    forceLabel.y = livesText.y + livesText.height + 10;
    forceText.x = app.screen.width - forceText.width - 16;
    forceText.y = forceLabel.y + 20;

    // Stage hit area mirrors screen size for pointer events
    app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height);

    // Overlay size and centering
    overlayBg.clear().beginFill(0x000000, 0.5).drawRect(0, 0, app.screen.width, app.screen.height).endFill();
    gameOverText.x = (app.screen.width - gameOverText.width) / 2;
    gameOverText.y = app.screen.height * 0.38;
    hintText.x = (app.screen.width - hintText.width) / 2;
    hintText.y = gameOverText.y + gameOverText.height + 16;
  }

  function setScore(value) {
    scoreText.text = String(value);
  }

  function setLives(value) {
    livesText.text = String(value);
    // Re-align right edge since width may change
    livesText.x = app.screen.width - livesText.width - 16;
  }

  function setForceCooldown(seconds) {
    if (seconds > 0) {
      forceText.text = seconds.toFixed(1) + 's';
    } else {
      forceText.text = 'Ready';
    }
    // Re-align right edge since width may change
    forceText.x = app.screen.width - forceText.width - 16;
    forceLabel.x = app.screen.width - forceLabel.width - 16;
  }

  const overlayAPI = {
    show() { overlay.visible = true; layout(); },
    hide() { overlay.visible = false; },
    layout,
  };

  // Initial layout
  layout();

  return { setScore, setLives, setForceCooldown, layout, overlay: overlayAPI };
}
