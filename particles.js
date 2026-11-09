import { randRange, randInt, pick, clamp } from './utils.js';

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.maxParticles = 700;
  }

  clear() {
    this.particles.length = 0;
    this.texts.length = 0;
  }

  add(particle) {
    if (this.particles.length >= this.maxParticles) this.particles.shift();
    this.particles.push(particle);
  }

  dust(x, y, direction = 0, amount = 6) {
    for (let i = 0; i < amount; i++) {
      this.add({
        x: x + randRange(-12, 12),
        y: y - randRange(0, 5),
        vx: randRange(-45, 45) + direction * randRange(20, 70),
        vy: randRange(-95, -25),
        life: randRange(0.25, 0.55),
        maxLife: 0.55,
        size: randRange(3, 8),
        color: pick(['#b59b70', '#d8c18c', '#8f7650']),
        gravity: 120,
        drag: 2.2,
        shape: 'circle',
        alpha: 0.7,
      });
    }
  }

  hitSpark(x, y, color = '#ffe38a', amount = 12, power = 1) {
    for (let i = 0; i < amount; i++) {
      const angle = randRange(-Math.PI, Math.PI);
      const speed = randRange(90, 330) * power;
      this.add({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: randRange(0.12, 0.38),
        maxLife: 0.38,
        size: randRange(2, 5),
        color: Math.random() < 0.35 ? '#ffffff' : color,
        gravity: 780,
        drag: 1.6,
        shape: 'spark',
        alpha: 1,
      });
    }
    for (let i = 0; i < 4; i++) {
      this.add({
        x,
        y,
        vx: randRange(-25, 25),
        vy: randRange(-60, 20),
        life: randRange(0.25, 0.5),
        maxLife: 0.5,
        size: randRange(5, 11),
        color: 'rgba(255, 238, 178, 0.5)',
        gravity: -30,
        drag: 2,
        shape: 'circle',
        alpha: 0.5,
        glow: true,
      });
    }
  }

  coinBurst(x, y, color = '#ffd75c', amount = 10) {
    for (let i = 0; i < amount; i++) {
      this.add({
        x,
        y,
        vx: randRange(-180, 180),
        vy: randRange(-300, -80),
        life: randRange(0.4, 0.8),
        maxLife: 0.8,
        size: randRange(3, 6),
        color,
        gravity: 900,
        drag: 0.6,
        shape: 'star',
        alpha: 1,
        glow: true,
        rotation: randRange(0, 6.28),
        rotSpeed: randRange(-7, 7),
      });
    }
  }

  gemBurst(x, y, color = '#68f0d6') {
    this.coinBurst(x, y, color, 16);
    for (let i = 0; i < 7; i++) {
      this.add({
        x,
        y,
        vx: randRange(-120, 120),
        vy: randRange(-240, -60),
        life: randRange(0.5, 1),
        maxLife: 1,
        size: randRange(4, 9),
        color: 'rgba(167, 255, 240, 0.65)',
        gravity: 180,
        drag: 1.3,
        shape: 'circle',
        alpha: 0.6,
        glow: true,
      });
    }
  }

  splash(x, y, amount = 18) {
    for (let i = 0; i < amount; i++) {
      this.add({
        x: x + randRange(-28, 28),
        y,
        vx: randRange(-150, 150),
        vy: randRange(-380, -120),
        life: randRange(0.4, 0.9),
        maxLife: 0.9,
        size: randRange(2, 6),
        color: pick(['#b6ecdf', '#64b9b2', '#e5fbf5', '#2d7d7f']),
        gravity: 880,
        drag: 0.4,
        shape: 'circle',
        alpha: 0.9,
      });
    }
  }

  embers(x, y, amount = 1) {
    for (let i = 0; i < amount; i++) {
      this.add({
        x: x + randRange(-8, 8),
        y: y + randRange(-4, 4),
        vx: randRange(-14, 14),
        vy: randRange(-65, -22),
        life: randRange(0.5, 1.2),
        maxLife: 1.2,
        size: randRange(1.5, 3.5),
        color: pick(['#ffc45c', '#ff8138', '#ff5b2e']),
        gravity: -12,
        drag: 0.7,
        shape: 'spark',
        alpha: 0.9,
        glow: true,
      });
    }
  }

  leaves(x, y, amount = 3) {
    for (let i = 0; i < amount; i++) {
      this.add({
        x: x + randRange(-50, 50),
        y: y + randRange(-100, 20),
        vx: randRange(-20, 45),
        vy: randRange(-20, 30),
        life: randRange(1.4, 3),
        maxLife: 3,
        size: randRange(3, 6),
        color: pick(['#7ca453', '#4f783f', '#a1b868', '#d1bd61']),
        gravity: 22,
        drag: 0.5,
        shape: 'leaf',
        alpha: 0.75,
        rotation: randRange(0, 6.28),
        rotSpeed: randRange(-3, 3),
        sway: randRange(0.5, 2),
      });
    }
  }

  deathBurst(x, y, color = '#d8b06b', amount = 18) {
    for (let i = 0; i < amount; i++) {
      const angle = randRange(-Math.PI, Math.PI);
      const speed = randRange(50, 230);
      this.add({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: randRange(0.4, 0.9),
        maxLife: 0.9,
        size: randRange(3, 8),
        color: Math.random() < 0.2 ? '#f7e4b1' : color,
        gravity: 700,
        drag: 0.9,
        shape: Math.random() < 0.5 ? 'spark' : 'circle',
        alpha: 1,
        glow: Math.random() < 0.4,
      });
    }
  }

  bossBurst(x, y) {
    this.deathBurst(x, y, '#c14d31', 34);
    this.coinBurst(x, y - 20, '#ffd15a', 26);
    this.hitSpark(x, y - 40, '#ff9d4d', 24, 1.5);
  }

  sparkle(x, y, color = '#ffe68a') {
    this.add({
      x,
      y,
      vx: randRange(-10, 10),
      vy: randRange(-40, -10),
      life: randRange(0.3, 0.7),
      maxLife: 0.7,
      size: randRange(2, 4),
      color,
      gravity: -20,
      drag: 1.5,
      shape: 'star',
      alpha: 0.9,
      glow: true,
      rotation: randRange(0, 6.28),
      rotSpeed: randRange(-5, 5),
    });
  }

  floatingText(x, y, text, color = '#ffe38a', size = 18) {
    this.texts.push({
      x,
      y,
      text,
      color,
      size,
      life: 1.05,
      maxLife: 1.05,
      vy: -58,
      vx: randRange(-6, 6),
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity || 0) * dt;
      if (p.drag) {
        const factor = Math.max(0, 1 - p.drag * dt);
        p.vx *= factor;
        p.vy *= factor;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rotation !== undefined) p.rotation += (p.rotSpeed || 0) * dt;
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.x += t.vx * dt;
      t.vy += 26 * dt;
    }
  }

  draw(ctx, camera) {
    const left = camera.renderX - 80;
    const right = camera.renderX + 1360;
    ctx.save();
    for (const p of this.particles) {
      if (p.x < left || p.x > right) continue;
      const alpha = clamp(p.life / p.maxLife, 0, 1) * (p.alpha ?? 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }

      if (p.shape === 'spark') {
        const len = Math.max(2, p.size * 1.8);
        const speed = Math.hypot(p.vx, p.vy) || 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillRect(-len * 0.5, -p.size * 0.25, len, Math.max(1.5, p.size * 0.5));
        ctx.restore();
      } else if (p.shape === 'star') {
        drawStar(ctx, p.x, p.y, p.size, p.rotation || 0);
      } else if (p.shape === 'leaf') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;

    for (const t of this.texts) {
      const alpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = Math.min(1, alpha * 1.8);
      ctx.font = `700 ${t.size}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(18, 10, 5, 0.9)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}

function drawStar(ctx, x, y, size, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = i % 2 === 0 ? size : size * 0.32;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
