const ACTION_MAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'KeyW', 'ArrowUp'],
  attack: ['KeyX'],
  secondary: ['KeyC'],
  crouch: ['ArrowDown', 'KeyS'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'NumpadEnter'],
};

const GAME_KEYS = new Set(Object.values(ACTION_MAP).flat());

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();

    this.onKeyDown = (event) => {
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      if (event.repeat) return;
      this.down.add(event.code);
      this.pressed.add(event.code);
    };

    this.onKeyUp = (event) => {
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      this.down.delete(event.code);
      this.released.add(event.code);
    };

    this.onBlur = () => {
      this.down.clear();
    };

    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.onBlur);
  }

  isDown(action) {
    const keys = ACTION_MAP[action];
    if (!keys) return false;
    return keys.some((key) => this.down.has(key));
  }

  wasPressed(action) {
    const keys = ACTION_MAP[action];
    if (!keys) return false;
    return keys.some((key) => this.pressed.has(key));
  }

  wasReleased(action) {
    const keys = ACTION_MAP[action];
    if (!keys) return false;
    return keys.some((key) => this.released.has(key));
  }

  consume(action) {
    const keys = ACTION_MAP[action];
    if (!keys) return false;
    let found = false;
    for (const key of keys) {
      if (this.pressed.has(key)) {
        this.pressed.delete(key);
        found = true;
      }
    }
    return found;
  }

  anyDown(...actions) {
    return actions.some((action) => this.isDown(action));
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }
}
