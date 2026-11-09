import { FIXED_STEP, VIEW_W, VIEW_H } from './config.js';
import { Game } from './game.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const game = new Game(canvas);
window.__CLAW_GAME__ = game;

let lastTime = performance.now();
let accumulator = 0;
const MAX_FRAME_TIME = 0.25;
const MAX_STEPS = 6;

function frame(now) {
  const elapsed = (now - lastTime) / 1000;
  lastTime = now;
  accumulator += Math.min(elapsed, MAX_FRAME_TIME);

  try {
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < MAX_STEPS) {
      game.update(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps++;
    }

    // If the tab stalled for a long time, drop the backlog instead of spiralling.
    if (steps === MAX_STEPS) accumulator = 0;

    game.render(accumulator / FIXED_STEP);
  } catch (error) {
    // Never let one bad frame kill the animation loop permanently.
    console.error('[Pirate Isle] Frame error:', error);
    accumulator = 0;
  } finally {
    game.input.endFrame();
    requestAnimationFrame(frame);
  }
}

requestAnimationFrame(frame);

// Pause automatically when the player tabs away mid-run.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
});

// Keep keyboard focus on the game and prevent the page from scrolling when the
// player uses the arrow keys or space bar.
window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  console.error('[Pirate Isle] Unhandled error:', event.error || event.message);
});
