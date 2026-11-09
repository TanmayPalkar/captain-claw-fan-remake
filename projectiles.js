import { rectsOverlap, randRange } from './utils.js';
import { isTouchingSolid } from './physics.js';

export class Projectile {
  constructor(options) {
    this.x = options.x;
    this.y = options.y;
    this.vx = options.vx || 0;
    this.vy = options.vy || 0;
    this.w = options.w || 10;
    this.h = options.h || 10;
    this.damage = options.damage || 10;
    this.owner = options.owner || 'enemy';
    this.type = options.type || 'bullet';
    this.life = options.life || 2.2;
    this.maxLife = this.life;
    this.gravity = options.gravity || 0;
    this.spin = 0;
    this.spinSpeed = options.spinSpeed || 0;
    this.dead = false;
    this.hitOnce = Boolean(options.hitOnce);
    this.color = options.color || '#ffd15a';
    this.trail = [];
    this.phase = Math.random() * Math.PI * 2;
  }

  update(dt, game) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }

    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.spin += this.spinSpeed * dt;

    if (this.type !== 'shockwave') {
      this.trail.push({ x: this.x, y: this.y, life: 0.16 });
      if (this.trail.length > 8) this.trail.shift();
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }

    if (this.type !== 'shockwave' && isTouchingSolid(game.level, this.x, this.y)) {
      this.dead = true;
      game.particles.hitSpark(this.x, this.y, this.owner === 'player' ? '#ffe08a' : '#ff9b66', 5, 0.55);
      return;
    }

    if (this.x < -100 || this.x > game.level.width + 100 || this.y > 820 || this.y < -150) {
      this.dead = true;
      return;
    }

    if (this.owner === 'player') {
      for (const enemy of game.enemies) {
        if (!enemy.alive || enemy.dying) continue;
        const bounds = enemy.getHurtBounds();
        if (rectsOverlap(this, bounds)) {
          const dir = this.vx >= 0 ? 1 : -1;
          game.damageEnemy(enemy, this.damage, this.x, dir, this.type === 'knife');
          this.dead = true;
          break;
        }
      }
    } else {
      const player = game.player;
      if (player && !player.dead) {
        const bounds = player.getHurtBounds();
        if (rectsOverlap(this, bounds)) {
          game.damagePlayer(this.damage, this.x, this.type === 'shockwave' ? 1 : 0);
          this.dead = true;
        }
      }
    }
  }

  draw(ctx, time) {
    if (this.dead) return;
    if (this.type === 'knife') {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.spin);
      ctx.fillStyle = '#f7e8bc';
      ctx.beginPath();
      ctx.moveTo(-15, -3);
      ctx.lineTo(8, -4);
      ctx.lineTo(17, 0);
      ctx.lineTo(8, 4);
      ctx.lineTo(-15, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6e4a22';
      ctx.fillRect(-18, -3, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, -2, 16, 2);
      ctx.restore();
      return;
    }

    if (this.type === 'shockwave') {
      const pulse = 0.65 + Math.sin(time * 16 + this.phase) * 0.2;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#8d3a23';
      ctx.beginPath();
      ctx.moveTo(this.x - 26, this.y + 22);
      ctx.lineTo(this.x - 10, this.y - 18 * pulse);
      ctx.lineTo(this.x + 2, this.y + 4);
      ctx.lineTo(this.x + 14, this.y - 25 * pulse);
      ctx.lineTo(this.x + 29, this.y + 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f28a3d';
      ctx.beginPath();
      ctx.moveTo(this.x - 18, this.y + 22);
      ctx.lineTo(this.x - 6, this.y - 9 * pulse);
      ctx.lineTo(this.x + 3, this.y + 7);
      ctx.lineTo(this.x + 12, this.y - 12 * pulse);
      ctx.lineTo(this.x + 20, this.y + 22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    if (this.type === 'cannonball') {
      ctx.save();
      ctx.fillStyle = '#1a1412';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#62534a';
      ctx.beginPath();
      ctx.arc(this.x - 3, this.y - 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#e9863f';
      ctx.beginPath();
      ctx.arc(this.x - this.vx * 0.025, this.y - this.vy * 0.025, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Powder shot with a small smoke trail.
    for (const t of this.trail) {
      ctx.save();
      ctx.globalAlpha = (t.life / 0.16) * 0.32;
      ctx.fillStyle = '#d4c1a0';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.shadowColor = '#ff9f48';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffd56b';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c7';
    ctx.beginPath();
    ctx.arc(this.x - 1, this.y - 1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class ProjectileSystem {
  constructor() {
    this.list = [];
  }

  clear() {
    this.list.length = 0;
  }

  spawn(options) {
    const projectile = new Projectile(options);
    this.list.push(projectile);
    return projectile;
  }

  spawnKnife(x, y, facing) {
    return this.spawn({
      x,
      y,
      vx: facing * 720,
      vy: -20,
      w: 26,
      h: 10,
      damage: 26,
      owner: 'player',
      type: 'knife',
      life: 1.1,
      spinSpeed: facing * 24,
      color: '#ffe08a',
    });
  }

  spawnBullet(x, y, targetX, targetY, speed = 360, damage = 10) {
    const angle = Math.atan2(targetY - y, targetX - x);
    return this.spawn({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 9,
      h: 9,
      damage,
      owner: 'enemy',
      type: 'bullet',
      life: 2.8,
    });
  }

  spawnCannonball(x, y, targetX, targetY, speed = 330, damage = 16) {
    const angle = Math.atan2(targetY - y, targetX - x);
    return this.spawn({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 20,
      h: 20,
      damage,
      owner: 'enemy',
      type: 'cannonball',
      life: 3.2,
      gravity: 260,
    });
  }

  spawnShockwave(x, y, direction, damage = 18) {
    return this.spawn({
      x,
      y,
      vx: direction * 330,
      vy: 0,
      w: 34,
      h: 50,
      damage,
      owner: 'enemy',
      type: 'shockwave',
      life: 1.7,
    });
  }

  update(dt, game) {
    for (const projectile of this.list) projectile.update(dt, game);
    this.list = this.list.filter((projectile) => !projectile.dead);
  }

  draw(ctx, camera, time) {
    for (const projectile of this.list) {
      if (projectile.x < camera.renderX - 100 || projectile.x > camera.renderX + 1380) continue;
      projectile.draw(ctx, time);
    }
  }
}
