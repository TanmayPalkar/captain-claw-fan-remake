import { clamp, circleRectOverlap, dist2, hash2, easeOutCubic } from './utils.js';
import { SCORE } from './config.js';

export class Collectible {
  constructor(spec) {
    this.id = spec.id;
    this.type = spec.type;
    this.x = spec.x;
    this.y = spec.y;
    this.baseX = spec.x;
    this.baseY = spec.y;
    this.value = spec.value || 0;
    this.hidden = Boolean(spec.hidden);
    this.reveal = this.hidden ? 0 : 1;
    this.collected = false;
    this.opening = false;
    this.openTimer = 0;
    this.phase = hash2(spec.x, spec.y, 17) * Math.PI * 2;
    this.bob = 0;
    this.sparkleTimer = Math.random() * 1.5;
    this.radius = this.type === 'coin' ? 12 : this.type === 'gem' ? 15 : 15;
  }

  get bounds() {
    if (this.type === 'chest') {
      return { x: this.x - 27, y: this.y - 22, w: 54, h: 40 };
    }
    if (this.type === 'idol') {
      return { x: this.x - 16, y: this.y - 27, w: 32, h: 50 };
    }
    if (this.type === 'food') {
      return { x: this.x - 14, y: this.y - 15, w: 28, h: 30 };
    }
    return { x: this.x - 15, y: this.y - 15, w: 30, h: 30 };
  }

  update(dt, player, game) {
    this.bob = Math.sin(game.time * 3.4 + this.phase) * 4;
    this.sparkleTimer -= dt;

    if (this.collected) {
      if (this.opening) {
        this.openTimer += dt;
        if (this.openTimer > 0.8) this.opening = false;
      }
      return;
    }

    if (this.sparkleTimer <= 0) {
      this.sparkleTimer = 0.7 + Math.random() * 1.5;
      if (this.type === 'gem' || this.type === 'idol') {
        game.particles.sparkle(this.x + (Math.random() - 0.5) * 22, this.y - 8 + (Math.random() - 0.5) * 16, this.type === 'gem' ? '#7df5e0' : '#ffe082');
      }
    }

    if (!player || player.dead) return;

    if (this.hidden) {
      const near = Math.abs(player.x + player.w * 0.5 - this.x) < 150;
      const target = near ? 1 : 0;
      this.reveal += (target - this.reveal) * Math.min(1, dt * 6);
      if (near && this.reveal > 0.92 && this.sparkleTimer <= 0) {
        this.sparkleTimer = 0.9;
        game.particles.sparkle(this.x, this.y - 16, '#ffd97a');
      }
    }

    const pCenterX = player.x + player.w * 0.5;
    const pCenterY = player.y + player.h * 0.5;

    if (this.type === 'coin') {
      const dx = pCenterX - this.x;
      const dy = pCenterY - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 120 * 120) {
        const pull = 1 - Math.min(1, Math.sqrt(d2) / 120);
        this.x += dx * pull * dt * 9;
        this.y += dy * pull * dt * 9;
      }
    }

    const bounds = this.bounds;
    const playerBounds = { x: player.x, y: player.y, w: player.w, h: player.h };
    const touching =
      this.type === 'coin' || this.type === 'gem'
        ? circleRectOverlap(this.x, this.y, this.radius + 8, playerBounds)
        : this.x + bounds.w * 0.5 > player.x &&
          this.x - bounds.w * 0.5 < player.x + player.w &&
          this.y + bounds.h * 0.5 > player.y &&
          this.y - bounds.h * 0.5 < player.y + player.h;

    if (touching) {
      this.open(game);
    }
  }

  open(game) {
    if (this.collected) return;
    this.collected = true;
    if (this.type === 'chest') {
      this.opening = true;
      this.openTimer = 0;
    }
    game.collectItem(this);
  }

  draw(ctx, time) {
    if (this.collected && this.type !== 'chest') return;
    const bob = this.collected ? 0 : this.bob;

    ctx.save();
    if (this.hidden) ctx.globalAlpha = 0.14 + this.reveal * 0.86;
    if (this.type === 'coin') this.drawCoin(ctx, time, bob);
    else if (this.type === 'gem') this.drawGem(ctx, time, bob);
    else if (this.type === 'food') this.drawFood(ctx, time, bob);
    else if (this.type === 'chest') this.drawChest(ctx, time);
    else if (this.type === 'idol') this.drawIdol(ctx, time, bob);
    ctx.restore();
  }

  drawShadow(ctx, width = 24) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#07100c';
    ctx.beginPath();
    ctx.ellipse(this.x, this.baseY + 19, width * 0.65, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCoin(ctx, time, bob) {
    const spin = Math.cos(time * 4.5 + this.phase);
    const width = Math.max(3.5, Math.abs(spin) * 12);
    const x = this.x;
    const y = this.y + bob;

    this.drawShadow(ctx, 18);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(width / 12, 1);
    ctx.fillStyle = '#a96318';
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd45e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe99a';
    ctx.beginPath();
    ctx.ellipse(-2, -3, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b26c18';
    ctx.fillRect(-1.5, -6, 3, 12);
    ctx.fillRect(-5, -1.5, 10, 3);
    ctx.restore();
  }

  drawGem(ctx, time, bob) {
    const x = this.x;
    const y = this.y + bob + Math.sin(time * 2 + this.phase) * 2;
    this.drawShadow(ctx, 20);
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#5df3da';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#1a8f8d';
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(13, -4);
    ctx.lineTo(9, 11);
    ctx.lineTo(0, 17);
    ctx.lineTo(-9, 11);
    ctx.lineTo(-13, -4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#69ead8';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(9, -3);
    ctx.lineTo(0, 9);
    ctx.lineTo(-9, -3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9fff6';
    ctx.beginPath();
    ctx.moveTo(-2, -10);
    ctx.lineTo(4, -4);
    ctx.lineTo(-1, 1);
    ctx.lineTo(-6, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2aac9f';
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(9, -3);
    ctx.lineTo(13, -4);
    ctx.lineTo(9, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawFood(ctx, time, bob) {
    const x = this.x;
    const y = this.y + bob;
    this.drawShadow(ctx, 22);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35 + Math.sin(time * 2 + this.phase) * 0.05);
    ctx.fillStyle = '#7f3d16';
    ctx.beginPath();
    ctx.ellipse(-2, 2, 13, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c1782f';
    ctx.beginPath();
    ctx.ellipse(-3, 0, 10, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e7b96f';
    ctx.beginPath();
    ctx.ellipse(-6, -3, 5, 3.5, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f0e4c4';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(7, 6);
    ctx.lineTo(14, 12);
    ctx.stroke();
    ctx.fillStyle = '#f8efd9';
    ctx.beginPath();
    ctx.arc(15, 13, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawChest(ctx, time) {
    const x = this.x;
    const y = this.y;
    this.drawShadow(ctx, 38);
    const openProgress = this.opening ? clamp(this.openTimer / 0.35, 0, 1) : this.collected ? 1 : 0;
    const lidAngle = -easeOutCubic(openProgress) * 1.15;

    ctx.save();
    ctx.translate(x, y);

    // Chest body
    ctx.fillStyle = '#2b1509';
    ctx.fillRect(-27, -4, 54, 26);
    ctx.fillStyle = '#6f3d18';
    ctx.fillRect(-25, -2, 50, 22);
    ctx.fillStyle = '#8f5525';
    ctx.fillRect(-23, 0, 46, 8);
    ctx.fillStyle = '#3b1e0c';
    ctx.fillRect(-27, 15, 54, 5);

    // Iron bands
    ctx.fillStyle = '#4c4032';
    ctx.fillRect(-21, -3, 5, 24);
    ctx.fillRect(16, -3, 5, 24);
    ctx.fillStyle = '#7b6b50';
    ctx.fillRect(-21, -3, 2, 24);
    ctx.fillRect(16, -3, 2, 24);

    // Lock
    ctx.fillStyle = '#d3a442';
    ctx.fillRect(-5, 7, 10, 10);
    ctx.fillStyle = '#6b4515';
    ctx.fillRect(-2, 10, 4, 5);

    // Lid
    ctx.save();
    ctx.translate(0, -4);
    ctx.rotate(lidAngle);
    ctx.fillStyle = '#2b1509';
    ctx.fillRect(-27, -15, 54, 18);
    ctx.fillStyle = '#7b451c';
    ctx.fillRect(-25, -13, 50, 14);
    ctx.fillStyle = '#a4682f';
    ctx.fillRect(-23, -12, 46, 6);
    ctx.fillStyle = '#4c4032';
    ctx.fillRect(-21, -15, 5, 17);
    ctx.fillRect(16, -15, 5, 17);
    ctx.fillStyle = '#7b6b50';
    ctx.fillRect(-21, -15, 2, 17);
    ctx.fillRect(16, -15, 2, 17);
    ctx.restore();

    if (openProgress > 0.35) {
      const glow = 0.6 + Math.sin(time * 8) * 0.2;
      ctx.globalAlpha = glow;
      const gradient = ctx.createRadialGradient(0, -8, 1, 0, -8, 38);
      gradient.addColorStop(0, 'rgba(255, 235, 150, 0.9)');
      gradient.addColorStop(0.5, 'rgba(255, 192, 71, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 166, 34, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(-42, -50, 84, 58);
    }

    ctx.restore();
  }

  drawIdol(ctx, time, bob) {
    const x = this.x;
    const y = this.y + bob;
    this.drawShadow(ctx, 24);
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#ffca58';
    ctx.shadowBlur = 15;
    // Base
    ctx.fillStyle = '#72501e';
    ctx.fillRect(-16, 18, 32, 8);
    ctx.fillStyle = '#e5b84f';
    ctx.fillRect(-13, 16, 26, 6);
    // Cat idol body
    ctx.fillStyle = '#b47b27';
    ctx.fillRect(-11, -4, 22, 22);
    ctx.fillStyle = '#e8bd55';
    ctx.fillRect(-8, -2, 16, 17);
    // Head
    ctx.fillStyle = '#e8bd55';
    ctx.beginPath();
    ctx.arc(0, -14, 12, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.moveTo(-11, -20);
    ctx.lineTo(-7, -33);
    ctx.lineTo(-1, -23);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(11, -20);
    ctx.lineTo(7, -33);
    ctx.lineTo(1, -23);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // Face
    ctx.fillStyle = '#63400f';
    ctx.fillRect(-6, -17, 3, 3);
    ctx.fillRect(3, -17, 3, 3);
    ctx.fillRect(-2, -10, 4, 3);
    // Collar
    ctx.fillStyle = '#9b2b22';
    ctx.fillRect(-10, 1, 20, 4);
    // Arms
    ctx.fillStyle = '#d6a53c';
    ctx.fillRect(-14, 4, 4, 12);
    ctx.fillRect(10, 4, 4, 12);
    ctx.restore();
  }
}

export function createCollectible(spec) {
  return new Collectible(spec);
}
