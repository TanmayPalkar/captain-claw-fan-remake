import { ENEMY_TYPES, GRAVITY, MAX_FALL_SPEED } from './config.js';
import { approach, clamp, sign, rectsOverlap } from './utils.js';
import { moveActor, hasGroundAhead } from './physics.js';

let enemyId = 0;

export class Enemy {
  constructor(spec, level) {
    const config = ENEMY_TYPES[spec.type];
    this.id = ++enemyId;
    this.type = spec.type;
    this.config = config;
    this.name = config.name;
    this.w = config.width;
    this.h = config.height;
    this.x = spec.x - this.w * 0.5;
    this.y = spec.feetY - this.h;
    this.spawnX = this.x;
    this.spawnY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.facing = spec.facing || -1;
    this.health = config.health;
    this.maxHealth = config.health;
    this.damage = config.damage;
    this.speed = config.speed;
    this.detectRange = config.detectRange;
    this.attackRange = config.attackRange;
    this.attackWindup = config.attackWindup;
    this.attackRecover = config.attackRecover;
    this.attackCooldownMax = config.attackCooldown;
    this.attackCooldown = 0.3 + Math.random() * 0.5;
    this.attackTimer = 0;
    this.state = 'idle';
    this.stateTimer = 0.5 + Math.random() * 0.6;
    this.alive = true;
    this.dying = false;
    this.deathTimer = 0;
    this.hurtTimer = 0;
    this.hitFlash = 0;
    this.onGround = false;
    this.standingPlatform = null;
    this.patrolLeft = spec.patrolLeft;
    this.patrolRight = spec.patrolRight;
    this.dormant = Boolean(spec.dormant);
    this.activated = !spec.dormant;
    this.animationTime = Math.random() * 4;
    this.walkPhase = 0;
    this.isBoss = Boolean(spec.isBoss);
    this.contactCooldown = 0;
    this.deathDirection = -this.facing;
    this.level = level;
  }

  get centerX() {
    return this.x + this.w * 0.5;
  }

  get centerY() {
    return this.y + this.h * 0.5;
  }

  get feetY() {
    return this.y + this.h;
  }

  getHurtBounds() {
    return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 6 };
  }

  reset() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.health = this.maxHealth;
    this.alive = true;
    this.dying = false;
    this.deathTimer = 0;
    this.hurtTimer = 0;
    this.hitFlash = 0;
    this.state = this.activated ? 'idle' : 'idle';
    this.stateTimer = 0.5;
    this.attackTimer = 0;
    this.attackCooldown = 0.5;
    this.contactCooldown = 0;
  }

  update(dt, player, level, game) {
    this.animationTime += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.contactCooldown = Math.max(0, this.contactCooldown - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    if (!this.alive) return;

    if (this.dying) {
      this.deathTimer += dt;
      this.vx = approach(this.vx, 0, 110 * dt);
      this.vy += GRAVITY * dt;
      moveActor(this, level, dt);
      if (this.deathTimer > 1.25) this.alive = false;
      return;
    }

    if (this.hurtTimer > 0) {
      this.vx = approach(this.vx, 0, 240 * dt);
      this.applyPhysics(dt, level);
      return;
    }

    if (this.dormant) {
      // Bosses wake only through their scripted arena trigger, never by proximity.
      const dx = player ? player.centerX - this.centerX : 9999;
      if (!this.isBoss && player && !player.dead && Math.abs(dx) < this.detectRange * 0.55) {
        this.dormant = false;
        this.activated = true;
      } else {
        this.vx = approach(this.vx, 0, 400 * dt);
        this.applyPhysics(dt, level);
        return;
      }
    }

    this.updateAI(dt, player, level, game);
    this.applyPhysics(dt, level);
    this.updateAnimation(dt);
  }

  updateAI(dt, player, level, game) {
    const dx = player ? player.centerX - this.centerX : 0;
    const dy = player ? player.centerY - this.centerY : 0;
    const sees =
      player &&
      !player.dead &&
      Math.abs(dx) < this.detectRange &&
      Math.abs(dy) < 160;

    if (this.state === 'windup') {
      this.attackTimer -= dt;
      this.vx = approach(this.vx, 0, 1200 * dt);
      if (player) this.facing = dx >= 0 ? 1 : -1;
      if (this.attackTimer <= 0) {
        this.performAttack(game, player);
        this.state = 'recover';
        this.attackTimer = this.attackRecover;
        this.attackCooldown = this.attackCooldownMax;
      }
      return;
    }

    if (this.state === 'recover') {
      this.attackTimer -= dt;
      this.vx = approach(this.vx, 0, 1000 * dt);
      if (this.attackTimer <= 0) this.state = sees ? 'chase' : 'patrol';
      return;
    }

    if (this.state === 'idle') {
      this.stateTimer -= dt;
      this.vx = approach(this.vx, 0, 700 * dt);
      if (this.stateTimer <= 0) this.state = 'patrol';
      if (sees) this.state = 'chase';
      return;
    }

    if (!sees) {
      this.state = 'patrol';
      this.patrolMovement(dt, level);
      return;
    }

    this.state = 'chase';
    this.facing = dx >= 0 ? 1 : -1;
    const distance = Math.abs(dx);

    if (distance > this.attackRange - 8) {
      const direction = sign(dx) || this.facing;
      const canAdvance = !this.onGround || hasGroundAhead(level, this, direction, 14);
      if (canAdvance) {
        this.vx = approach(this.vx, direction * this.speed, 900 * dt);
      } else {
        this.vx = approach(this.vx, 0, 1100 * dt);
      }
    } else {
      this.vx = approach(this.vx, 0, 1200 * dt);
      if (this.attackCooldown <= 0) {
        this.state = 'windup';
        this.attackTimer = this.attackWindup;
        this.vx = 0;
      }
    }
  }

  patrolMovement(dt, level) {
    if (this.x < this.patrolLeft + 4) this.facing = 1;
    else if (this.x + this.w > this.patrolRight - 4) this.facing = -1;

    if (this.onGround && !hasGroundAhead(level, this, this.facing, 12)) {
      this.facing *= -1;
      this.vx = approach(this.vx, 0, 900 * dt);
      return;
    }

    this.vx = approach(this.vx, this.facing * this.speed * 0.42, 600 * dt);
  }

  performAttack(game, player) {
    game.audio.swing();
    if (!player || player.dead) return;
    const dx = player.centerX - this.centerX;
    const dy = player.centerY - this.centerY;
    if (Math.abs(dx) < this.attackRange + 26 && Math.abs(dy) < this.h * 0.7 + 20) {
      game.damagePlayer(this.damage, this.centerX, 0);
      game.particles.hitSpark(this.centerX + this.facing * 30, this.centerY, '#ffc77b', 8, 0.7);
    }
  }

  applyPhysics(dt, level) {
    this.vy += GRAVITY * dt;
    this.vy = Math.min(this.vy, MAX_FALL_SPEED);
    moveActor(this, level, dt);
    if (this.x < 8) {
      this.x = 8;
      this.vx = Math.max(0, this.vx);
    }
  }

  updateAnimation(dt) {
    this.walkPhase += Math.abs(this.vx) * dt * 0.055;
  }

  takeDamage(amount, sourceX, direction, game, isKnife = false) {
    if (!this.alive || this.dying || this.hurtTimer > 0.1) return false;
    this.health -= amount;
    this.hurtTimer = 0.18;
    this.hitFlash = 0.13;
    this.state = 'hurt';
    this.vx = direction * (this.type === 'heavy' || this.isBoss ? 65 : 140);
    this.vy = -80;
    game.audio.enemyHit();
    game.particles.hitSpark(this.centerX, this.centerY, '#ffd48a', 8, 0.7);
    if (isKnife) game.particles.hitSpark(this.centerX, this.centerY, '#bff6ee', 4, 0.5);
    if (this.health <= 0) {
      this.die(game, direction);
    }
    return true;
  }

  die(game, direction) {
    if (this.dying) return;
    this.dying = true;
    this.deathTimer = 0;
    this.state = 'death';
    this.vx = direction * 120;
    this.vy = -280;
    this.deathDirection = direction;
    game.particles.deathBurst(this.centerX, this.centerY, this.config.color, 18);
    game.audio.hit();
    game.camera.shake(4, 0.18);
    game.onEnemyKilled(this);
  }

  draw(ctx, time) {
    if (!this.alive) return;
    const fade = this.dying ? clamp(1 - this.deathTimer / 1.25, 0, 1) : 1;
    const alpha = fade * (this.hurtTimer > 0 && Math.floor(time * 30) % 2 === 0 ? 0.72 : 1);

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.24 * fade;
    ctx.fillStyle = '#07100c';
    ctx.beginPath();
    ctx.ellipse(this.centerX, this.feetY + 2, this.w * 0.55, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.centerX, this.feetY);
    ctx.scale(this.facing, 1);
    if (this.dying) {
      const p = clamp(this.deathTimer / 0.6, 0, 1);
      ctx.rotate(-p * 1.3);
    }
    if (this.hitFlash > 0) ctx.filter = 'brightness(2.2) saturate(0.35)';

    if (this.type === 'pirate') this.drawPirate(ctx, time);
    else if (this.type === 'ranged') this.drawRanged(ctx, time);
    else if (this.type === 'heavy') this.drawHeavy(ctx, time);
    else if (this.type === 'boss') this.drawBoss(ctx, time);

    ctx.filter = 'none';
    ctx.restore();

    if (!this.dying && this.type !== 'boss') this.drawHealthBar(ctx);
    if (!this.dying && this.state === 'windup') this.drawTelegraph(ctx, time);
  }

  drawHealthBar(ctx) {
    if (this.health >= this.maxHealth) return;
    const width = this.type === 'heavy' ? 54 : 44;
    const x = this.centerX - width * 0.5;
    const y = this.y - 13;
    ctx.save();
    ctx.fillStyle = 'rgba(12, 7, 4, 0.82)';
    ctx.fillRect(x - 1, y - 1, width + 2, 7);
    ctx.fillStyle = '#47211a';
    ctx.fillRect(x, y, width, 5);
    ctx.fillStyle = this.type === 'heavy' ? '#e0693b' : '#d94a36';
    ctx.fillRect(x, y, width * clamp(this.health / this.maxHealth, 0, 1), 5);
    ctx.fillStyle = 'rgba(255, 228, 166, 0.5)';
    ctx.fillRect(x, y, width * clamp(this.health / this.maxHealth, 0, 1), 1);
    ctx.restore();
  }

  drawTelegraph(ctx, time) {
    const pulse = 0.65 + Math.sin(time * 18) * 0.35;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffb24d';
    ctx.font = '700 19px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#281006';
    ctx.lineWidth = 4;
    ctx.strokeText('!', this.centerX, this.y - 20);
    ctx.fillText('!', this.centerX, this.y - 20);
    ctx.restore();
  }

  drawPirate(ctx, time) {
    const walk = this.state === 'chase' || this.state === 'patrol' ? this.walkPhase : 0;
    const stride = Math.sin(walk) * 6;
    const bob = Math.sin(time * 3.2 + this.animationTime) * 1;
    const windup = this.state === 'windup';
    const attacking = this.state === 'recover' || this.state === 'hurt';

    ctx.save();
    ctx.translate(0, bob);

    // Back leg
    ctx.fillStyle = '#26201b';
    ctx.fillRect(-10 + stride * 0.25, -23, 9, 18);
    ctx.fillStyle = '#4b2c17';
    ctx.fillRect(-12 + stride * 0.3, -7, 14, 7);
    // Front leg
    ctx.fillStyle = '#34302a';
    ctx.fillRect(2 - stride * 0.25, -23, 9, 18);
    ctx.fillStyle = '#5a351b';
    ctx.fillRect(1 - stride * 0.3, -7, 15, 7);

    // Torso
    ctx.fillStyle = '#2e2117';
    ctx.beginPath();
    ctx.moveTo(-14, -48);
    ctx.lineTo(13, -48);
    ctx.lineTo(17, -26);
    ctx.lineTo(10, -21);
    ctx.lineTo(-12, -21);
    ctx.lineTo(-16, -28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6c3423';
    ctx.beginPath();
    ctx.moveTo(-10, -46);
    ctx.lineTo(10, -46);
    ctx.lineTo(13, -27);
    ctx.lineTo(-11, -27);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b9a477';
    ctx.fillRect(-5, -45, 10, 12);
    ctx.fillStyle = '#8d6a3c';
    ctx.fillRect(-10, -34, 20, 4);
    ctx.fillStyle = '#d4b85d';
    ctx.fillRect(-3, -33, 6, 3);

    // Back arm
    ctx.save();
    ctx.translate(-12, -44);
    ctx.rotate(-0.15);
    ctx.fillStyle = '#713d27';
    ctx.fillRect(-4, 0, 7, 16);
    ctx.fillStyle = '#d18a5a';
    ctx.fillRect(-4, 14, 7, 6);
    ctx.restore();

    // Head
    ctx.save();
    ctx.translate(0, -55);
    ctx.fillStyle = '#c77d4c';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5aa79';
    ctx.beginPath();
    ctx.ellipse(4, 3, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bandana
    ctx.fillStyle = '#9f2c23';
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.quadraticCurveTo(0, -13, 12, -4);
    ctx.lineTo(10, 0);
    ctx.quadraticCurveTo(0, -6, -10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ca4b31';
    ctx.fillRect(-10, -4, 20, 2);
    ctx.fillStyle = '#9f2c23';
    ctx.beginPath();
    ctx.moveTo(-10, -1);
    ctx.lineTo(-18, 4);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fill();
    // Eye / beard
    ctx.fillStyle = '#1a110b';
    ctx.fillRect(-5, -1, 4, 3);
    ctx.fillRect(3, -1, 4, 3);
    ctx.fillStyle = '#5b3520';
    ctx.fillRect(-3, 7, 9, 5);
    ctx.fillStyle = '#2a180d';
    ctx.fillRect(1, 6, 3, 2);
    ctx.restore();

    // Sword arm
    let angle = -0.2;
    if (windup) angle = -1.2;
    else if (attacking) angle = 0.35;
    else if (walk) angle = -0.25 + Math.sin(walk + Math.PI) * 0.2;
    ctx.save();
    ctx.translate(13, -43);
    ctx.rotate(angle);
    ctx.fillStyle = '#7a422a';
    ctx.fillRect(-2, -3, 15, 7);
    ctx.fillStyle = '#d18a5a';
    ctx.fillRect(10, -4, 6, 8);
    ctx.fillStyle = '#d4a13d';
    ctx.fillRect(12, -6, 4, 12);
    ctx.fillStyle = '#c6d2d2';
    ctx.beginPath();
    ctx.moveTo(16, -3);
    ctx.lineTo(38, -2);
    ctx.lineTo(42, 0);
    ctx.lineTo(38, 2);
    ctx.lineTo(16, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(18, -2, 17, 1);
    ctx.restore();

    // Sash tail
    ctx.fillStyle = '#8d2a22';
    ctx.fillRect(-13, -25, 5, 12);
    ctx.restore();
  }

  drawRanged(ctx, time) {
    const walk = this.state === 'chase' || this.state === 'patrol' ? this.walkPhase : 0;
    const stride = Math.sin(walk) * 5;
    const bob = Math.sin(time * 3 + this.animationTime) * 1;
    const aiming = this.state === 'windup' || this.state === 'recover';

    ctx.save();
    ctx.translate(0, bob);

    // Legs
    ctx.fillStyle = '#222b31';
    ctx.fillRect(-9 + stride * 0.25, -22, 8, 17);
    ctx.fillStyle = '#3c2b1b';
    ctx.fillRect(-11 + stride * 0.3, -7, 13, 7);
    ctx.fillStyle = '#2c3840';
    ctx.fillRect(2 - stride * 0.25, -22, 8, 17);
    ctx.fillStyle = '#4b3520';
    ctx.fillRect(1 - stride * 0.3, -7, 14, 7);

    // Coat
    ctx.fillStyle = '#1b2f38';
    ctx.beginPath();
    ctx.moveTo(-13, -47);
    ctx.lineTo(12, -47);
    ctx.lineTo(16, -25);
    ctx.lineTo(8, -19);
    ctx.lineTo(-11, -19);
    ctx.lineTo(-16, -26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#315463';
    ctx.beginPath();
    ctx.moveTo(-9, -45);
    ctx.lineTo(9, -45);
    ctx.lineTo(12, -27);
    ctx.lineTo(-11, -27);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c5b17e';
    ctx.fillRect(-4, -44, 9, 12);
    ctx.fillStyle = '#8b3a27';
    ctx.fillRect(-11, -34, 22, 4);

    // Head with tricorn
    ctx.save();
    ctx.translate(0, -54);
    ctx.fillStyle = '#c98555';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5ae7e';
    ctx.beginPath();
    ctx.ellipse(4, 3, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#182229';
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.quadraticCurveTo(0, -16, 14, -4);
    ctx.lineTo(10, 1);
    ctx.quadraticCurveTo(0, -5, -10, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d0a446';
    ctx.fillRect(-10, -4, 20, 2);
    ctx.fillStyle = '#1b110a';
    ctx.fillRect(-5, 0, 4, 3);
    ctx.fillRect(3, 0, 4, 3);
    ctx.fillStyle = '#54321c';
    ctx.fillRect(-2, 7, 7, 3);
    ctx.restore();

    // Musket arm
    ctx.save();
    ctx.translate(12, -42);
    ctx.rotate(aiming ? 0 : -0.28);
    ctx.fillStyle = '#315463';
    ctx.fillRect(-3, -3, 13, 7);
    ctx.fillStyle = '#c98555';
    ctx.fillRect(8, -4, 6, 8);
    ctx.fillStyle = '#4a2d16';
    ctx.fillRect(12, -3, 29, 6);
    ctx.fillStyle = '#9a7a48';
    ctx.fillRect(34, -2, 10, 4);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(20, 3, 9, 3);
    ctx.restore();

    ctx.restore();
  }

  drawHeavy(ctx, time) {
    const walk = this.state === 'chase' || this.state === 'patrol' ? this.walkPhase : 0;
    const stride = Math.sin(walk) * 4;
    const bob = Math.sin(time * 2.5 + this.animationTime) * 1;
    const windup = this.state === 'windup';
    const attacking = this.state === 'recover' || this.state === 'hurt';

    ctx.save();
    ctx.translate(0, bob);

    // Legs
    ctx.fillStyle = '#2c211c';
    ctx.fillRect(-17 + stride * 0.2, -31, 14, 25);
    ctx.fillRect(4 - stride * 0.2, -31, 14, 25);
    ctx.fillStyle = '#4a301d';
    ctx.fillRect(-20 + stride * 0.25, -8, 19, 8);
    ctx.fillRect(2 - stride * 0.25, -8, 20, 8);
    ctx.fillStyle = '#6e4a2b';
    ctx.fillRect(-20 + stride * 0.25, -9, 19, 2);
    ctx.fillRect(2 - stride * 0.25, -9, 20, 2);

    // Huge torso
    ctx.fillStyle = '#21191a';
    ctx.beginPath();
    ctx.moveTo(-26, -71);
    ctx.lineTo(23, -71);
    ctx.lineTo(30, -41);
    ctx.lineTo(20, -28);
    ctx.lineTo(-20, -28);
    ctx.lineTo(-30, -42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6e3036';
    ctx.beginPath();
    ctx.moveTo(-21, -68);
    ctx.lineTo(19, -68);
    ctx.lineTo(25, -42);
    ctx.lineTo(16, -33);
    ctx.lineTo(-17, -33);
    ctx.lineTo(-25, -43);
    ctx.closePath();
    ctx.fill();
    // Breastplate
    ctx.fillStyle = '#4f5355';
    ctx.beginPath();
    ctx.moveTo(-17, -66);
    ctx.lineTo(15, -66);
    ctx.lineTo(18, -43);
    ctx.lineTo(8, -36);
    ctx.lineTo(-12, -36);
    ctx.lineTo(-18, -45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7f8687';
    ctx.fillRect(-12, -61, 5, 19);
    ctx.fillRect(7, -61, 4, 18);
    ctx.fillStyle = '#d0a142';
    ctx.fillRect(-3, -58, 6, 15);

    // Shoulder armor
    ctx.fillStyle = '#393b3e';
    ctx.beginPath();
    ctx.ellipse(-23, -62, 12, 9, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(22, -62, 12, 9, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.save();
    ctx.translate(0, -79);
    ctx.fillStyle = '#b36b43';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d99a68';
    ctx.beginPath();
    ctx.ellipse(4, 3, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Helmet
    ctx.fillStyle = '#33373a';
    ctx.beginPath();
    ctx.moveTo(-13, -3);
    ctx.quadraticCurveTo(0, -18, 13, -3);
    ctx.lineTo(10, 3);
    ctx.quadraticCurveTo(0, -5, -10, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d1a341';
    ctx.fillRect(-12, -3, 24, 2);
    ctx.fillStyle = '#1a110b';
    ctx.fillRect(-5, 0, 4, 3);
    ctx.fillRect(3, 0, 4, 3);
    ctx.fillStyle = '#5a3520';
    ctx.fillRect(-4, 7, 10, 5);
    // Helmet plume
    ctx.fillStyle = '#a72b24';
    ctx.beginPath();
    ctx.moveTo(-2, -13);
    ctx.quadraticCurveTo(-7, -25, 5, -20);
    ctx.quadraticCurveTo(2, -15, 4, -12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Axe arm
    let angle = -0.25;
    if (windup) angle = -1.55;
    else if (attacking) angle = 0.55;
    ctx.save();
    ctx.translate(21, -59);
    ctx.rotate(angle);
    ctx.fillStyle = '#5c3823';
    ctx.fillRect(-4, -3, 22, 8);
    ctx.fillStyle = '#b36b43';
    ctx.fillRect(16, -4, 7, 10);
    // Handle
    ctx.fillStyle = '#4a2b16';
    ctx.fillRect(21, -4, 40, 7);
    ctx.fillStyle = '#8d5a2c';
    ctx.fillRect(21, -3, 39, 2);
    // Axe head
    ctx.fillStyle = '#646c6e';
    ctx.beginPath();
    ctx.moveTo(52, -16);
    ctx.lineTo(69, -22);
    ctx.lineTo(73, -5);
    ctx.lineTo(57, 7);
    ctx.lineTo(52, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9fa8a9';
    ctx.beginPath();
    ctx.moveTo(64, -19);
    ctx.lineTo(69, -21);
    ctx.lineTo(72, -6);
    ctx.lineTo(64, 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  drawBoss(ctx, time) {
    const walk = this.state === 'chase' || this.state === 'dash' ? this.walkPhase : 0;
    const stride = Math.sin(walk) * 8;
    const bob = Math.sin(time * 2.2 + this.animationTime) * 1.5;
    const windup = this.state === 'windup';
    const attacking = this.state === 'recover';

    ctx.save();
    ctx.translate(0, bob);

    // Tail
    ctx.strokeStyle = '#191417';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, -40);
    ctx.quadraticCurveTo(-55, -33, -50, -78);
    ctx.stroke();
    ctx.strokeStyle = '#2d2228';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-18, -40);
    ctx.quadraticCurveTo(-51, -34, -48, -76);
    ctx.stroke();

    // Legs
    ctx.fillStyle = '#191417';
    ctx.fillRect(-25 + stride * 0.2, -42, 20, 34);
    ctx.fillRect(6 - stride * 0.2, -42, 21, 34);
    ctx.fillStyle = '#3d2112';
    ctx.fillRect(-30 + stride * 0.25, -12, 28, 12);
    ctx.fillRect(3 - stride * 0.25, -12, 30, 12);
    ctx.fillStyle = '#b5863b';
    ctx.fillRect(-29 + stride * 0.25, -13, 26, 3);
    ctx.fillRect(4 - stride * 0.25, -13, 28, 3);

    // Torso
    ctx.fillStyle = '#1b1216';
    ctx.beginPath();
    ctx.moveTo(-38, -98);
    ctx.lineTo(36, -98);
    ctx.lineTo(45, -50);
    ctx.lineTo(27, -38);
    ctx.lineTo(-29, -38);
    ctx.lineTo(-44, -52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#76252b';
    ctx.beginPath();
    ctx.moveTo(-31, -94);
    ctx.lineTo(30, -94);
    ctx.lineTo(38, -53);
    ctx.lineTo(23, -43);
    ctx.lineTo(-26, -43);
    ctx.lineTo(-38, -55);
    ctx.closePath();
    ctx.fill();
    // Coat lapels
    ctx.fillStyle = '#351c24';
    ctx.beginPath();
    ctx.moveTo(-16, -92);
    ctx.lineTo(0, -59);
    ctx.lineTo(16, -92);
    ctx.lineTo(7, -94);
    ctx.lineTo(0, -72);
    ctx.lineTo(-7, -94);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d3b260';
    ctx.fillRect(-2, -88, 4, 33);
    ctx.fillStyle = '#e2c46f';
    ctx.fillRect(-18, -71, 36, 5);
    ctx.fillStyle = '#3b2414';
    ctx.fillRect(-7, -69, 14, 8);
    ctx.fillStyle = '#f0cc67';
    ctx.fillRect(-3, -67, 6, 4);

    // Shoulders
    ctx.fillStyle = '#23161b';
    ctx.beginPath();
    ctx.ellipse(-37, -88, 18, 15, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(35, -88, 18, 15, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4d2d1d';
    ctx.beginPath();
    ctx.ellipse(-35, -90, 14, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(33, -90, 14, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.save();
    ctx.translate(0, -112);
    // Ears
    ctx.fillStyle = '#24181e';
    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.lineTo(-23, -29);
    ctx.lineTo(-7, -17);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(17, -6);
    ctx.lineTo(22, -29);
    ctx.lineTo(7, -17);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4f2b29';
    ctx.beginPath();
    ctx.moveTo(-16, -9);
    ctx.lineTo(-19, -23);
    ctx.lineTo(-10, -16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(15, -9);
    ctx.lineTo(19, -23);
    ctx.lineTo(10, -16);
    ctx.closePath();
    ctx.fill();
    // Face
    ctx.fillStyle = '#2b1b22';
    ctx.beginPath();
    ctx.ellipse(0, 0, 23, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#493038';
    ctx.beginPath();
    ctx.ellipse(-2, -1, 19, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b98253';
    ctx.beginPath();
    ctx.ellipse(7, 7, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#ff5a38';
    ctx.fillRect(-10, -5, 8, 5);
    ctx.fillRect(5, -5, 8, 5);
    ctx.fillStyle = '#ffe18e';
    ctx.fillRect(-7, -4, 3, 3);
    ctx.fillRect(8, -4, 3, 3);
    // Scar
    ctx.strokeStyle = '#7c3230';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(1, -13);
    ctx.lineTo(-3, 3);
    ctx.stroke();
    // Nose/mouth
    ctx.fillStyle = '#1c0f12';
    ctx.beginPath();
    ctx.moveTo(10, 4);
    ctx.lineTo(18, 5);
    ctx.lineTo(12, 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3b2020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 10);
    ctx.lineTo(9, 14);
    ctx.moveTo(9, 14);
    ctx.lineTo(3, 15);
    ctx.moveTo(9, 14);
    ctx.lineTo(15, 15);
    ctx.stroke();
    // Beard
    ctx.fillStyle = '#171016';
    ctx.beginPath();
    ctx.moveTo(-9, 12);
    ctx.quadraticCurveTo(0, 31, 13, 13);
    ctx.quadraticCurveTo(4, 22, -9, 12);
    ctx.fill();
    // Hat
    ctx.fillStyle = '#0d0a0b';
    ctx.beginPath();
    ctx.moveTo(-27, -9);
    ctx.quadraticCurveTo(-15, -31, 0, -28);
    ctx.quadraticCurveTo(17, -31, 28, -9);
    ctx.lineTo(20, 0);
    ctx.quadraticCurveTo(0, -10, -20, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d6a744';
    ctx.fillRect(-20, -8, 40, 3);
    ctx.fillStyle = '#e8dbb5';
    ctx.fillRect(-4, -22, 8, 7);
    ctx.fillStyle = '#2a1a0d';
    ctx.fillRect(-2, -20, 2, 2);
    ctx.fillRect(2, -20, 2, 2);
    ctx.fillRect(-2, -17, 5, 2);
    ctx.restore();

    // Anchor hammer arm
    let angle = -0.3;
    if (windup) angle = -1.7;
    else if (attacking) angle = 0.65;
    ctx.save();
    ctx.translate(34, -80);
    ctx.rotate(angle);
    ctx.fillStyle = '#76252b';
    ctx.fillRect(-6, -6, 30, 13);
    ctx.fillStyle = '#3b1a1e';
    ctx.fillRect(18, -8, 10, 17);
    // Handle
    ctx.fillStyle = '#4a2b16';
    ctx.fillRect(25, -5, 56, 9);
    ctx.fillStyle = '#a96f32';
    ctx.fillRect(26, -4, 52, 2);
    // Anchor head
    ctx.strokeStyle = '#747d80';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(76, -23);
    ctx.lineTo(76, 21);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(76, 0, 26, -0.1, Math.PI + 0.1);
    ctx.stroke();
    ctx.fillStyle = '#9ba4a5';
    ctx.beginPath();
    ctx.moveTo(76, -32);
    ctx.lineTo(88, -20);
    ctx.lineTo(76, -14);
    ctx.lineTo(64, -20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}

export class RangedEnemy extends Enemy {
  updateAI(dt, player, level, game) {
    const dx = player ? player.centerX - this.centerX : 0;
    const dy = player ? player.centerY - this.centerY : 0;
    const sees =
      player &&
      !player.dead &&
      Math.abs(dx) < this.detectRange &&
      Math.abs(dy) < 170;

    if (this.state === 'windup') {
      this.attackTimer -= dt;
      this.vx = approach(this.vx, 0, 1200 * dt);
      if (player) this.facing = dx >= 0 ? 1 : -1;
      if (this.attackTimer <= 0) {
        this.fire(game, player);
        this.state = 'recover';
        this.attackTimer = this.attackRecover;
        this.attackCooldown = this.attackCooldownMax;
      }
      return;
    }

    if (this.state === 'recover') {
      this.attackTimer -= dt;
      this.vx = approach(this.vx, 0, 1200 * dt);
      if (this.attackTimer <= 0) this.state = sees ? 'chase' : 'patrol';
      return;
    }

    if (!sees) {
      this.state = 'patrol';
      this.patrolMovement(dt, level);
      return;
    }

    this.state = 'chase';
    this.facing = dx >= 0 ? 1 : -1;
    const distance = Math.abs(dx);
    if (distance < 190) {
      const dir = -sign(dx);
      if (!this.onGround || hasGroundAhead(level, this, dir, 12)) {
        this.vx = approach(this.vx, dir * this.speed, 900 * dt);
      } else {
        this.vx = approach(this.vx, 0, 1000 * dt);
      }
    } else if (distance > 360) {
      const dir = sign(dx);
      if (!this.onGround || hasGroundAhead(level, this, dir, 12)) {
        this.vx = approach(this.vx, dir * this.speed, 900 * dt);
      } else {
        this.vx = approach(this.vx, 0, 1000 * dt);
      }
    } else {
      this.vx = approach(this.vx, 0, 1100 * dt);
    }

    if (this.attackCooldown <= 0 && distance < this.attackRange && Math.abs(dy) < 150) {
      this.state = 'windup';
      this.attackTimer = this.attackWindup;
      this.vx = 0;
    }
  }

  fire(game, player) {
    if (!player || player.dead) return;
    const gunX = this.centerX + this.facing * 28;
    const gunY = this.y + 25;
    game.projectiles.spawnBullet(gunX, gunY, player.centerX, player.centerY, 350, this.damage);
    game.audio.shoot();
    game.particles.hitSpark(gunX, gunY, '#ffd278', 7, 0.65);
    game.particles.embers(gunX, gunY, 4);
  }
}

export class HeavyEnemy extends Enemy {
  performAttack(game, player) {
    game.audio.swing();
    game.audio.land();
    game.camera.shake(5, 0.16);
    game.particles.dust(this.centerX, this.feetY, 0, 10);
    if (!player || player.dead) return;
    const dx = player.centerX - this.centerX;
    const dy = player.centerY - this.centerY;
    if (Math.abs(dx) < this.attackRange + 34 && Math.abs(dy) < this.h * 0.8) {
      game.damagePlayer(this.damage, this.centerX, 0);
    }
    game.projectiles.spawnShockwave(this.centerX - 12, this.feetY - 24, -1, 14);
    game.projectiles.spawnShockwave(this.centerX + 12, this.feetY - 24, 1, 14);
  }
}

export class BossEnemy extends Enemy {
  constructor(spec, level) {
    super({ ...spec, isBoss: true }, level);
    this.isBoss = true;
    this.activated = false;
    this.dormant = true;
    this.phase = 1;
    this.patternIndex = 0;
    this.attackType = '';
    this.dashTimer = 0;
    this.bossStateTimer = 0;
    this.hasRoared = false;
  }

  activate(game) {
    if (this.activated) return;
    this.activated = true;
    this.dormant = false;
    this.state = 'intro';
    this.attackTimer = 1.45;
    this.vx = 0;
    game.audio.roar();
    game.camera.shake(11, 0.75);
    game.particles.deathBurst(this.centerX, this.centerY, '#c14d31', 24);
    game.ui.showBossBar(this.name);
    game.ui.toast('IRONJAW: “No cat takes my hoard!”', 3.2);
  }

  updateAI(dt, player, level, game) {
    if (!this.activated) {
      this.vx = approach(this.vx, 0, 800 * dt);
      return;
    }

    if (this.state === 'intro') {
      this.attackTimer -= dt;
      this.vx = 0;
      if (player) this.facing = player.centerX >= this.centerX ? 1 : -1;
      if (this.attackTimer <= 0) {
        this.state = 'chase';
        this.attackCooldown = 0.6;
      }
      return;
    }

    if (this.state === 'windup') {
      this.attackTimer -= dt;
      this.vx = approach(this.vx, 0, 1600 * dt);
      if (player) this.facing = player.centerX >= this.centerX ? 1 : -1;
      if (this.attackTimer <= 0) this.executeAttack(game, player);
      return;
    }

    if (this.state === 'dash') {
      this.dashTimer -= dt;
      this.vx = this.facing * (this.phase === 2 ? 660 : 560);
      if (this.dashTimer <= 0) {
        this.state = 'recover';
        this.attackTimer = this.phase === 2 ? 0.34 : 0.46;
        this.attackCooldown = this.phase === 2 ? 0.8 : 1.1;
      }
      return;
    }

    if (this.state === 'recover') {
      this.attackTimer -= dt;
      this.vx = approach(this.vx, 0, 1800 * dt);
      if (this.attackTimer <= 0) this.state = 'chase';
      return;
    }

    if (!player || player.dead) {
      this.vx = approach(this.vx, 0, 900 * dt);
      this.state = 'chase';
      return;
    }

    this.state = 'chase';
    const dx = player.centerX - this.centerX;
    this.facing = dx >= 0 ? 1 : -1;
    const distance = Math.abs(dx);

    if (distance > 160) {
      this.vx = approach(this.vx, this.facing * this.speed, 900 * dt);
    } else {
      this.vx = approach(this.vx, 0, 1400 * dt);
    }

    if (this.attackCooldown <= 0) {
      this.chooseAttack(distance, game, player);
    }
  }

  chooseAttack(distance, game, player) {
    this.patternIndex = (this.patternIndex + 1) % 4;
    if (distance > 300) {
      this.attackType = this.patternIndex % 2 === 0 ? 'cannon' : 'dash';
    } else if (distance > 150) {
      this.attackType = this.patternIndex === 0 ? 'slam' : 'dash';
    } else {
      this.attackType = this.patternIndex === 2 ? 'cannon' : 'slam';
    }

    this.state = 'windup';
    this.attackTimer =
      this.attackType === 'slam'
        ? this.phase === 2 ? 0.48 : 0.64
        : this.attackType === 'dash'
          ? this.phase === 2 ? 0.3 : 0.44
          : 0.52;
    this.vx = 0;
    if (this.attackType === 'cannon') {
      game.particles.hitSpark(this.centerX + this.facing * 42, this.y + 30, '#ff8f4a', 8, 0.5);
    }
  }

  executeAttack(game, player) {
    if (this.attackType === 'dash') {
      this.state = 'dash';
      this.dashTimer = this.phase === 2 ? 0.5 : 0.58;
      game.audio.roar();
      game.particles.dust(this.centerX, this.feetY, this.facing, 12);
      return;
    }

    if (this.attackType === 'cannon') {
      if (!player || player.dead) return;
      for (let i = -1; i <= 1; i++) {
        game.projectiles.spawnCannonball(
          this.centerX + this.facing * 40,
          this.y + 28,
          player.centerX + i * 55,
          player.centerY + i * 10,
          this.phase === 2 ? 390 : 340,
          16
        );
      }
      game.audio.shoot();
      game.camera.shake(5, 0.18);
      game.particles.embers(this.centerX + this.facing * 44, this.y + 28, 12);
      this.state = 'recover';
      this.attackTimer = this.phase === 2 ? 0.38 : 0.55;
      this.attackCooldown = this.phase === 2 ? 1.2 : 1.7;
      return;
    }

    // Ground slam
    game.audio.land();
    game.audio.hit();
    game.camera.shake(10, 0.35);
    game.particles.dust(this.centerX, this.feetY, 0, 18);
    game.particles.hitSpark(this.centerX, this.feetY - 20, '#ff9a4a', 18, 1.1);
    if (player && !player.dead) {
      const dx = player.centerX - this.centerX;
      if (Math.abs(dx) < 180 && player.y + player.h > this.feetY - 80) {
        game.damagePlayer(this.damage, this.centerX, 0);
      }
    }
    game.projectiles.spawnShockwave(this.centerX - 18, this.feetY - 24, -1, 18);
    game.projectiles.spawnShockwave(this.centerX + 18, this.feetY - 24, 1, 18);
    if (this.phase === 2) {
      game.projectiles.spawnShockwave(this.centerX - 40, this.feetY - 24, -1, 16);
      game.projectiles.spawnShockwave(this.centerX + 40, this.feetY - 24, 1, 16);
    }
    this.state = 'recover';
    this.attackTimer = this.phase === 2 ? 0.38 : 0.58;
    this.attackCooldown = this.phase === 2 ? 0.9 : 1.35;
  }

  takeDamage(amount, sourceX, direction, game, isKnife = false) {
    if (!this.activated || this.state === 'intro') return false;
    const before = this.health;
    const hit = super.takeDamage(amount, sourceX, direction, game, isKnife);
    if (hit && this.phase === 1 && this.health <= this.maxHealth * 0.5) {
      this.phase = 2;
      this.speed += 28;
      this.attackCooldownMax *= 0.72;
      game.camera.shake(9, 0.5);
      game.audio.roar();
      game.particles.deathBurst(this.centerX, this.centerY, '#e05832', 22);
      game.ui.toast('IRONJAW IS ENRAGED!', 2.4);
    }
    return hit;
  }

  update(dt, player, level, game) {
    super.update(dt, player, level, game);
    if (!this.alive) return;
    this.x = clamp(this.x, this.patrolLeft, this.patrolRight - this.w);
  }

  drawBoss(ctx, time) {
    super.drawBoss(ctx, time);
  }
}

export function createEnemy(spec, level) {
  if (spec.type === 'ranged') return new RangedEnemy(spec, level);
  if (spec.type === 'heavy') return new HeavyEnemy(spec, level);
  if (spec.type === 'boss') return new BossEnemy(spec, level);
  return new Enemy(spec, level);
}

export function createBoss(spec, level) {
  return new BossEnemy(spec, level);
}
