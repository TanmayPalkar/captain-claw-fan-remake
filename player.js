import { GRAVITY, MAX_FALL_SPEED, PLAYER } from './config.js';
import { clamp, approach, rectsOverlap } from './utils.js';
import { moveActor } from './physics.js';

export class Player {
  constructor(x, feetY) {
    this.spawnX = x;
    this.spawnFeetY = feetY;
    this.w = PLAYER.width;
    this.h = PLAYER.height;
    this.x = x - this.w * 0.5;
    this.y = feetY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.standingPlatform = null;

    this.maxHealth = PLAYER.maxHealth;
    this.health = this.maxHealth;
    this.dead = false;
    this.deathTimer = 0;
    this.deathReason = '';
    this.invulnerableTimer = 0;
    this.hurtTimer = 0;
    this.landingTimer = 0;
    this.victory = false;
    this.victoryTimer = 0;

    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpHeld = false;
    this.wasOnGround = false;

    this.attackTimer = 0;
    this.attackDuration = 0.34;
    this.attackActive = false;
    this.attackBuffer = 0;
    this.queuedAttack = false;
    this.combo = 0;
    this.comboResetTimer = 0;
    this.attackId = 0;
    this.hitEnemies = new Set();
    this.throwTimer = 0;
    this.secondaryCooldown = 0;

    this.crouching = false;
    this.walkPhase = 0;
    this.animationTime = 0;
    this.landingSquash = 0;
    this.state = 'idle';
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
    return { x: this.x + 5, y: this.y + 6, w: this.w - 10, h: this.h - 7 };
  }

  getAttackBounds() {
    if (this.attackTimer <= 0) return null;
    const p = this.attackTimer / this.attackDuration;
    if (p < 0.17 || p > 0.64) return null;
    const reach = this.combo === 2 ? 70 : 56;
    return {
      x: this.facing > 0 ? this.x + this.w - 10 : this.x - reach + 10,
      y: this.y + (this.crouching ? 8 : 12),
      w: reach,
      h: this.h * (this.crouching ? 0.6 : 0.62),
    };
  }

  setCrouching(value, level) {
    if (value === this.crouching) return;
    if (value) {
      this.crouching = true;
      this.y += PLAYER.height - PLAYER.crouchHeight;
      this.h = PLAYER.crouchHeight;
    } else if (this.canStand(level)) {
      this.crouching = false;
      this.h = PLAYER.height;
      this.y -= PLAYER.height - PLAYER.crouchHeight;
    }
  }

  canStand(level) {
    const test = { x: this.x, y: this.y - (PLAYER.height - PLAYER.crouchHeight), w: this.w, h: PLAYER.height };
    for (const solid of level.getCollisionSolids()) {
      if (solid.active === false || solid.oneWay) continue;
      if (rectsOverlap(test, solid)) return false;
    }
    return true;
  }

  update(dt, level, game) {
    this.animationTime += dt;

    if (this.dead) {
      this.updateDeath(dt, level);
      return;
    }

    if (this.victory) {
      this.victoryTimer += dt;
      this.vx = approach(this.vx, 0, 900 * dt);
      this.vy += GRAVITY * dt;
      moveActor(this, level, dt);
      this.state = 'victory';
      return;
    }

    const input = game.input;
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.landingTimer = Math.max(0, this.landingTimer - dt);
    this.landingSquash = Math.max(0, this.landingSquash - dt * 4.5);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.comboResetTimer = Math.max(0, this.comboResetTimer - dt);
    this.throwTimer = Math.max(0, this.throwTimer - dt);
    this.secondaryCooldown = Math.max(0, this.secondaryCooldown - dt);

    if (this.comboResetTimer <= 0 && this.attackTimer <= 0) this.combo = 0;

    if (this.onGround) this.coyoteTimer = PLAYER.coyoteTime;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    const left = input.isDown('left');
    const right = input.isDown('right');
    const down = input.isDown('down') || input.isDown('crouch');
    const sprint = input.isDown('sprint');
    const moveDir = (right ? 1 : 0) - (left ? 1 : 0);

    if (input.consume('jump')) this.jumpBufferTimer = PLAYER.jumpBuffer;
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    if (input.consume('attack')) this.attackBuffer = 0.22;
    if (input.consume('secondary') && this.secondaryCooldown <= 0) {
      this.throwKnife(game);
    }

    if (this.hurtTimer <= 0) {
      const wantsCrouch = down && this.onGround && moveDir === 0;
      this.setCrouching(wantsCrouch, level);
    }

    let maxSpeed = this.crouching ? 92 : sprint ? PLAYER.sprintSpeed : PLAYER.maxRunSpeed;
    if (this.attackTimer > 0) maxSpeed *= 0.6;
    if (this.throwTimer > 0) maxSpeed *= 0.75;

    if (this.hurtTimer > 0) {
      this.vx = approach(this.vx, 0, 380 * dt);
    } else if (moveDir !== 0) {
      if (this.attackTimer <= 0) this.facing = moveDir;
      const accel = this.onGround ? PLAYER.acceleration : PLAYER.airAcceleration;
      this.vx = approach(this.vx, moveDir * maxSpeed, accel * dt);
    } else {
      const decel = this.onGround ? PLAYER.deceleration : PLAYER.airDeceleration;
      this.vx = approach(this.vx, 0, decel * dt);
    }

    if (
      this.jumpBufferTimer > 0 &&
      (this.coyoteTimer > 0 || this.onGround) &&
      this.hurtTimer <= 0
    ) {
      this.doJump(game);
    }

    if (!input.isDown('jump') && this.jumpHeld && this.vy < PLAYER.jumpCutVelocity) {
      this.vy = PLAYER.jumpCutVelocity;
      this.jumpHeld = false;
    }

    if (this.vy < 0 && input.isDown('jump')) {
      this.vy += GRAVITY * 0.82 * dt;
    } else {
      this.vy += GRAVITY * dt;
    }
    this.vy = Math.min(this.vy, MAX_FALL_SPEED);

    // Sword attack progression.
    if (this.attackTimer > 0) {
      this.attackTimer += dt;
      const progress = this.attackTimer / this.attackDuration;
      if (progress >= 0.17 && progress <= 0.64) {
        this.attackActive = true;
        // Called every active frame: hitEnemies guarantees each target is
        // struck once per swing while still letting new targets walk in.
        game.handleSwordHit(this);
      } else {
        this.attackActive = false;
      }
      if (progress >= 1) {
        this.attackTimer = 0;
        this.attackActive = false;
        if (this.queuedAttack && this.combo < 2) {
          this.queuedAttack = false;
          this.startAttack(game, true);
        } else {
          this.queuedAttack = false;
          this.comboResetTimer = 0.55;
        }
      }
    } else if (this.attackBuffer > 0 && this.hurtTimer <= 0) {
      this.attackBuffer = 0;
      this.startAttack(game, false);
    }

    if (this.attackTimer > 0 && this.attackBuffer > 0 && this.attackTimer > this.attackDuration * 0.5) {
      this.attackBuffer = 0;
      this.queuedAttack = true;
    }

    const fallSpeed = this.vy;
    this.wasOnGround = this.onGround;
    moveActor(this, level, dt);

    if (this.onGround && !this.wasOnGround && fallSpeed > 180) {
      this.landingTimer = 0.16;
      this.landingSquash = 1;
      game.particles.dust(this.centerX, this.feetY, 0, 7);
      game.audio.land();
      if (fallSpeed > 700) game.camera.shake(4, 0.12);
    }

    if (this.onGround) this.jumpHeld = false;

    if (this.x < 0) {
      this.x = 0;
      this.vx = Math.max(0, this.vx);
    }

    this.updateState(dt);
  }

  updateDeath(dt, level) {
    this.deathTimer += dt;
    this.vy += GRAVITY * 0.8 * dt;
    this.vy = Math.min(this.vy, MAX_FALL_SPEED);
    this.vx = approach(this.vx, 0, 90 * dt);
    moveActor(this, level, dt);
    this.animationTime += dt;
  }

  updateState(dt) {
    if (this.hurtTimer > 0) this.state = 'hurt';
    else if (this.attackTimer > 0) this.state = 'attack';
    else if (this.throwTimer > 0) this.state = 'throw';
    else if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
    else if (this.crouching) this.state = 'crouch';
    else if (this.landingTimer > 0) this.state = 'landing';
    else if (Math.abs(this.vx) > 255) this.state = 'run';
    else if (Math.abs(this.vx) > 18) this.state = 'walk';
    else this.state = 'idle';

    if (this.state === 'walk' || this.state === 'run') {
      this.walkPhase += Math.abs(this.vx) * 0.052;
    } else if (this.onGround) {
      this.walkPhase += dt * 2;
    }
  }

  doJump(game) {
    if (this.crouching) this.setCrouching(false, game.level);
    this.vy = PLAYER.jumpVelocity;
    this.onGround = false;
    this.standingPlatform = null;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpHeld = true;
    this.landingTimer = 0;
    game.audio.jump();
    game.particles.dust(this.centerX, this.feetY, 0, 4);
  }

  startAttack(game, chained) {
    this.combo = chained ? Math.min(2, this.combo + 1) : 0;
    this.attackTimer = 0.0001;
    this.hitEnemies.clear();
    this.attackId++;
    this.queuedAttack = false;
    this.attackActive = false;
    this.state = 'attack';
    game.audio.swing();
  }

  throwKnife(game) {
    this.secondaryCooldown = PLAYER.knifeCooldown;
    this.throwTimer = 0.25;
    const y = this.y + (this.crouching ? 18 : 30);
    game.projectiles.spawnKnife(this.centerX + this.facing * 28, y, this.facing);
    game.audio.knife();
    game.particles.hitSpark(this.centerX + this.facing * 25, y, '#d9c794', 4, 0.4);
  }

  takeDamage(amount, sourceX, game, reason = 'enemy') {
    if (this.dead || this.victory || this.invulnerableTimer > 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnerableTimer = PLAYER.invulnerableTime;
    this.hurtTimer = 0.3;
    this.attackTimer = 0;
    this.attackActive = false;
    this.throwTimer = 0;
    const dir = sourceX < this.centerX ? 1 : -1;
    this.vx = dir * PLAYER.knockbackX;
    this.vy = PLAYER.knockbackY;
    this.onGround = false;
    this.cameraShake = 6;
    game.camera.shake(7, 0.22);
    game.audio.hurt();
    game.particles.hitSpark(this.centerX, this.centerY, '#ff7f5f', 12, 0.8);
    game.hitStop = 0.045;
    if (this.health <= 0) {
      this.die(game, reason);
    }
    return true;
  }

  die(game, reason = 'enemy') {
    if (this.dead) return;
    this.dead = true;
    this.deathTimer = 0;
    this.deathReason = reason;
    this.vx = -this.facing * 90;
    this.vy = -420;
    this.attackTimer = 0;
    this.state = 'death';
    game.camera.shake(10, 0.4);
    game.audio.death();
    game.particles.deathBurst(this.centerX, this.centerY, '#d9792e', 26);
    game.onPlayerDeathStarted(reason);
  }

  respawn(x, feetY) {
    this.x = x - this.w * 0.5;
    this.y = feetY - PLAYER.height;
    this.w = PLAYER.width;
    this.h = PLAYER.height;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.health = this.maxHealth;
    this.dead = false;
    this.deathTimer = 0;
    this.victory = false;
    this.victoryTimer = 0;
    this.invulnerableTimer = 1.8;
    this.hurtTimer = 0;
    this.crouching = false;
    this.attackTimer = 0;
    this.throwTimer = 0;
    this.secondaryCooldown = 0;
    this.state = 'idle';
  }

  setVictory() {
    this.victory = true;
    this.victoryTimer = 0;
    this.vx = 0;
    this.vy = 0;
    this.attackTimer = 0;
    this.state = 'victory';
  }

  draw(ctx, time) {
    const x = this.x + this.w * 0.5;
    const feet = this.y + this.h;
    const flash = this.invulnerableTimer > 0 && Math.floor(time * 22) % 2 === 0;
    const alpha = flash ? 0.42 : 1;

    // Ground shadow
    ctx.save();
    ctx.globalAlpha = this.dead ? 0.12 : 0.28;
    ctx.fillStyle = '#07100c';
    ctx.beginPath();
    ctx.ellipse(x, feet + 2, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, feet);

    if (this.dead) {
      const progress = clamp(this.deathTimer / 0.65, 0, 1);
      ctx.rotate(progress * 1.45 * -this.facing);
      ctx.globalAlpha = Math.max(0.15, 1 - Math.max(0, this.deathTimer - 1.5) * 0.9);
    }

    ctx.scale(this.facing, 1);

    if (this.crouching) {
      ctx.scale(1, 0.67);
    } else if (this.landingSquash > 0) {
      ctx.scale(1 + this.landingSquash * 0.06, 1 - this.landingSquash * 0.12);
    }

    const breathe = Math.sin(this.animationTime * 3.1) * 0.8;
    const walk = this.state === 'walk' || this.state === 'run' ? this.walkPhase : 0;
    const stride = Math.sin(walk) * (this.state === 'run' ? 11 : 7);
    const armSwing = Math.sin(walk + Math.PI) * (this.state === 'run' ? 7 : 4);
    const bob = this.state === 'run' ? Math.abs(Math.sin(walk)) * -2.5 : breathe;

    this.drawTail(ctx, time, bob);
    this.drawLegs(ctx, stride, bob);
    this.drawTorso(ctx, bob, armSwing);
    this.drawHead(ctx, time, bob);
    this.drawSwordArm(ctx, time, bob);
    this.drawEffects(ctx, time, bob);
    ctx.restore();
  }

  drawTail(ctx, time, bob) {
    const sway = Math.sin(time * 2.2) * 7;
    ctx.save();
    ctx.translate(-10, -30 + bob);
    ctx.strokeStyle = '#9a4b18';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.quadraticCurveTo(-21, 3, -27, -14 + sway * 0.35);
    ctx.stroke();
    ctx.strokeStyle = '#d8792d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.quadraticCurveTo(-19, 2, -25, -14 + sway * 0.35);
    ctx.stroke();
    ctx.strokeStyle = '#6f3514';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-25, -14 + sway * 0.35);
    ctx.lineTo(-28, -22 + sway * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  drawLegs(ctx, stride, bob) {
    const jump = this.state === 'jump' || this.state === 'fall';
    const leftLift = jump ? -7 : Math.max(0, stride);
    const rightLift = jump ? -3 : Math.max(0, -stride);
    ctx.save();
    ctx.translate(0, bob);

    // Back leg
    ctx.fillStyle = '#1b2832';
    ctx.fillRect(-13 + stride * 0.25, -27 - leftLift, 11, 21);
    ctx.fillStyle = '#5a3118';
    ctx.fillRect(-16 + stride * 0.3, -10 - leftLift, 17, 10);
    ctx.fillStyle = '#8a5125';
    ctx.fillRect(-15 + stride * 0.3, -11 - leftLift, 15, 3);

    // Front leg
    ctx.fillStyle = '#263642';
    ctx.fillRect(2 - stride * 0.25, -27 - rightLift, 12, 21);
    ctx.fillStyle = '#6b3b1b';
    ctx.fillRect(1 - stride * 0.3, -10 - rightLift, 18, 10);
    ctx.fillStyle = '#9e602c';
    ctx.fillRect(2 - stride * 0.3, -11 - rightLift, 16, 3);
    ctx.fillStyle = '#2a170b';
    ctx.fillRect(1 - stride * 0.3, -2 - rightLift, 18, 3);
    ctx.fillRect(-16 + stride * 0.3, -2 - leftLift, 17, 3);
    ctx.restore();
  }

  drawTorso(ctx, bob, armSwing) {
    ctx.save();
    ctx.translate(0, bob);

    // Coat silhouette
    ctx.fillStyle = '#132a33';
    ctx.beginPath();
    ctx.moveTo(-17, -55);
    ctx.lineTo(15, -55);
    ctx.lineTo(20, -33);
    ctx.lineTo(14, -22);
    ctx.lineTo(-15, -22);
    ctx.lineTo(-20, -34);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1f4550';
    ctx.beginPath();
    ctx.moveTo(-13, -53);
    ctx.lineTo(12, -53);
    ctx.lineTo(15, -34);
    ctx.lineTo(10, -25);
    ctx.lineTo(-11, -25);
    ctx.lineTo(-15, -35);
    ctx.closePath();
    ctx.fill();

    // Cream shirt
    ctx.fillStyle = '#d7c398';
    ctx.beginPath();
    ctx.moveTo(-7, -52);
    ctx.lineTo(8, -52);
    ctx.lineTo(6, -37);
    ctx.lineTo(-5, -37);
    ctx.closePath();
    ctx.fill();

    // Red sash
    ctx.fillStyle = '#9d2a22';
    ctx.fillRect(-15, -37, 30, 7);
    ctx.fillStyle = '#c4432e';
    ctx.fillRect(-13, -36, 26, 2);
    ctx.fillStyle = '#6b1715';
    ctx.fillRect(4, -31, 6, 13);

    // Gold buckles and buttons
    ctx.fillStyle = '#e6b74d';
    ctx.fillRect(-4, -49, 3, 3);
    ctx.fillRect(2, -49, 3, 3);
    ctx.fillRect(-5, -35, 10, 4);
    ctx.fillStyle = '#7b5118';
    ctx.fillRect(-2, -34, 4, 2);

    // Back arm
    ctx.save();
    ctx.translate(-12, -50);
    ctx.rotate(-0.28 + armSwing * 0.015);
    ctx.fillStyle = '#1a3943';
    ctx.fillRect(-5, 0, 9, 19);
    ctx.fillStyle = '#d8792d';
    ctx.fillRect(-4, 17, 8, 7);
    ctx.restore();

    // Neck scarf
    ctx.fillStyle = '#b6372a';
    ctx.fillRect(-8, -58, 17, 5);
    ctx.fillStyle = '#e36c47';
    ctx.fillRect(-5, -57, 11, 2);
    ctx.restore();
  }

  drawHead(ctx, time, bob) {
    ctx.save();
    ctx.translate(1, -68 + bob);

    // Ears
    ctx.fillStyle = '#b85d21';
    ctx.beginPath();
    ctx.moveTo(-13, -6);
    ctx.lineTo(-17, -20);
    ctx.lineTo(-5, -12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, -7);
    ctx.lineTo(14, -21);
    ctx.lineTo(18, -10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8a06a';
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.lineTo(-14, -15);
    ctx.lineTo(-8, -11);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, -8);
    ctx.lineTo(13, -16);
    ctx.lineTo(16, -10);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = '#c96d26';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e28a3d';
    ctx.beginPath();
    ctx.ellipse(-2, -2, 13, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle
    ctx.fillStyle = '#f1d3a0';
    ctx.beginPath();
    ctx.ellipse(6, 6, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5b980';
    ctx.beginPath();
    ctx.ellipse(7, 8, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye patch / eye
    ctx.fillStyle = '#24140a';
    ctx.fillRect(-4, -3, 10, 6);
    ctx.fillStyle = '#f9f0c9';
    ctx.fillRect(-1, -2, 5, 4);
    ctx.fillStyle = '#1a120b';
    ctx.fillRect(1, -1, 2, 3);
    ctx.fillStyle = '#d96d2d';
    ctx.fillRect(-6, -6, 7, 2);

    // Nose and mouth
    ctx.fillStyle = '#30170c';
    ctx.beginPath();
    ctx.moveTo(9, 4);
    ctx.lineTo(14, 5);
    ctx.lineTo(10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5b3218';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, 9);
    ctx.lineTo(9, 12);
    ctx.moveTo(9, 12);
    ctx.lineTo(5, 13);
    ctx.moveTo(9, 12);
    ctx.lineTo(13, 13);
    ctx.stroke();

    // Whiskers
    ctx.strokeStyle = 'rgba(247, 229, 188, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(13, 7);
    ctx.lineTo(21, 5);
    ctx.moveTo(13, 9);
    ctx.lineTo(22, 9);
    ctx.moveTo(12, 11);
    ctx.lineTo(20, 13);
    ctx.stroke();

    // Pirate hat
    ctx.fillStyle = '#17130f';
    ctx.beginPath();
    ctx.moveTo(-19, -8);
    ctx.quadraticCurveTo(-11, -18, 0, -18);
    ctx.quadraticCurveTo(12, -18, 20, -8);
    ctx.lineTo(15, -3);
    ctx.quadraticCurveTo(0, -10, -15, -3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b241c';
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.quadraticCurveTo(-6, -15, 2, -14);
    ctx.lineTo(8, -11);
    ctx.lineTo(0, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d7a945';
    ctx.fillRect(-14, -7, 29, 2);
    // Skull emblem
    ctx.fillStyle = '#e9dbb8';
    ctx.fillRect(-2, -14, 6, 5);
    ctx.fillStyle = '#2a1c0d';
    ctx.fillRect(-1, -13, 1, 1);
    ctx.fillRect(2, -13, 1, 1);
    ctx.fillRect(-1, -11, 4, 1);
    ctx.restore();
  }

  drawSwordArm(ctx, time, bob) {
    let angle = -0.5;
    let armX = 13;
    let armY = -49 + bob;

    if (this.attackTimer > 0) {
      const p = clamp(this.attackTimer / this.attackDuration, 0, 1);
      const swing = Math.sin(clamp((p - 0.08) / 0.6, 0, 1) * Math.PI);
      if (this.combo === 2) {
        angle = -1.6 + swing * 3.1;
      } else if (this.combo === 1) {
        angle = 0.7 - swing * 2.4;
      } else {
        angle = -0.9 + swing * 2.2;
      }
      armX += swing * 5;
      armY -= swing * 2;
    } else if (this.throwTimer > 0) {
      angle = 0.1;
      armX += 6;
    } else if (this.state === 'run') {
      angle = -0.3 + Math.sin(this.walkPhase + Math.PI) * 0.22;
    } else if (this.victory) {
      angle = -2.15;
      armY -= 3;
    }

    ctx.save();
    ctx.translate(armX, armY);
    ctx.rotate(angle);
    // Arm
    ctx.fillStyle = '#244b55';
    ctx.fillRect(-4, -4, 20, 9);
    ctx.fillStyle = '#c96d26';
    ctx.fillRect(12, -4, 8, 8);
    ctx.fillStyle = '#e6b74d';
    ctx.fillRect(10, -5, 4, 10);

    // Sword
    ctx.save();
    ctx.translate(18, 0);
    ctx.rotate(0.1);
    ctx.fillStyle = '#5d3a1c';
    ctx.fillRect(-2, -3, 13, 6);
    ctx.fillStyle = '#e8b84f';
    ctx.fillRect(10, -7, 4, 14);
    ctx.fillRect(13, -2, 4, 4);
    ctx.fillStyle = '#d7e1e2';
    ctx.beginPath();
    ctx.moveTo(17, -3);
    ctx.lineTo(45, -2);
    ctx.lineTo(50, 0);
    ctx.lineTo(45, 2);
    ctx.lineTo(17, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(19, -2, 23, 1);
    ctx.fillStyle = '#8f9d9f';
    ctx.fillRect(17, 2, 29, 1);
    ctx.restore();
    ctx.restore();
  }

  drawEffects(ctx, time, bob) {
    if (this.attackTimer <= 0) return;
    const p = this.attackTimer / this.attackDuration;
    if (p < 0.12 || p > 0.72) return;
    const alpha = Math.sin(((p - 0.12) / 0.6) * Math.PI) * 0.55;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.combo === 2 ? '#ffe69b' : '#eaf7f4';
    ctx.lineWidth = this.combo === 2 ? 7 : 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (this.combo === 2) {
      ctx.arc(10, -40 + bob, 45, -1.9, 1.15);
    } else if (this.combo === 1) {
      ctx.arc(11, -43 + bob, 41, 0.7, -2.1, true);
    } else {
      ctx.arc(10, -43 + bob, 41, -1.6, 0.9);
    }
    ctx.stroke();
    ctx.restore();
  }
}
