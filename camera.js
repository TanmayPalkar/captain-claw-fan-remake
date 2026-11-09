import { VIEW_W, VIEW_H } from './config.js';
import { clamp, damp } from './utils.js';

export class Camera {
  constructor(levelWidth) {
    this.x = 0;
    this.y = 0;
    this.levelWidth = levelWidth;
    this.shakeTime = 0;
    this.shakeMagnitude = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.lookAhead = 0;
  }

  reset(levelWidth, x = 0) {
    this.levelWidth = levelWidth;
    this.x = clamp(x, 0, Math.max(0, levelWidth - VIEW_W));
    this.y = 0;
    this.shakeTime = 0;
    this.shakeMagnitude = 0;
    this.lookAhead = 0;
  }

  update(player, dt) {
    const desiredLook = player.facing * 92 + clamp(player.vx * 0.16, -70, 70);
    this.lookAhead = damp(this.lookAhead, desiredLook, 3.2, dt);
    const targetX = player.x + player.w * 0.5 - VIEW_W * 0.5 + this.lookAhead;
    this.x = damp(this.x, targetX, 6.2, dt);
    this.x = clamp(this.x, 0, Math.max(0, this.levelWidth - VIEW_W));
    this.y = 0;

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const strength = this.shakeMagnitude * clamp(this.shakeTime * 5, 0, 1);
      this.shakeX = (Math.random() * 2 - 1) * strength;
      this.shakeY = (Math.random() * 2 - 1) * strength * 0.65;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  snapTo(player) {
    this.x = clamp(player.x + player.w * 0.5 - VIEW_W * 0.5, 0, Math.max(0, this.levelWidth - VIEW_W));
    this.y = 0;
    this.lookAhead = player.facing * 92;
  }

  shake(magnitude = 7, duration = 0.18) {
    if (magnitude >= this.shakeMagnitude || this.shakeTime <= 0) {
      this.shakeMagnitude = magnitude;
      this.shakeTime = Math.max(this.shakeTime, duration);
    }
  }

  get renderX() {
    return Math.floor(this.x + this.shakeX);
  }

  get renderY() {
    return Math.floor(this.y + this.shakeY);
  }

  toScreenX(worldX) {
    return worldX - this.renderX;
  }

  toScreenY(worldY) {
    return worldY - this.renderY;
  }
}

export { VIEW_W, VIEW_H };
