import {
  VIEW_W,
  VIEW_H,
  PLAYER,
  SCORE,
} from './config.js';
import { clamp, rectsOverlap, formatScore } from './utils.js';
import { Input } from './input.js';
import { AudioSystem } from './audio.js';
import { Camera } from './camera.js';
import { Background } from './background.js';
import { WorldRenderer } from './world.js';
import { ParticleSystem } from './particles.js';
import { ProjectileSystem } from './projectiles.js';
import { Player } from './player.js';
import { createEnemy, createBoss } from './enemies.js';
import { createCollectible } from './collectibles.js';
import { createLevel } from './level.js';
import { UI } from './ui.js';

let dropId = 0;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.input = new Input();
    this.audio = new AudioSystem();
    this.background = new Background();
    this.world = new WorldRenderer();
    this.particles = new ParticleSystem();
    this.projectiles = new ProjectileSystem();
    this.time = 0;
    this.mode = 'menu';
    this.hitStop = 0;
    this.ui = new UI({
      onStart: () => this.startGame(),
      onResume: () => this.resume(),
      onRestart: () => this.startGame(),
      onQuit: () => this.quitToMenu(),
      onToggleSound: () => this.toggleSound(),
      onClick: () => {
        this.audio.unlock();
        this.audio.click();
      },
    });
    this.ui.setSoundLabel(this.audio.enabled);

    this.setupWorld();
    this.ui.showMenu();
  }

  setupWorld() {
    this.level = createLevel();
    this.level.update(0);
    this.player = new Player(this.level.spawn.x, this.level.spawn.y);
    this.enemies = this.level.enemySpawns.map((spawn) => createEnemy(spawn, this.level));
    this.boss = createBoss(this.level.bossSpawn, this.level);
    this.enemies.push(this.boss);
    this.collectibles = this.level.collectibleSpawns.map((spec) => createCollectible(spec));
    this.projectiles.clear();
    this.particles.clear();

    this.score = 0;
    this.lives = 3;
    this.loot = 0;
    this.kills = 0;
    this.elapsed = 0;
    this.checkpoint = { x: this.level.spawn.x, y: this.level.spawn.y, name: 'Landing' };
    this.checkpointObject = null;
    this.deathHandled = false;
    this.bossDefeated = false;
    this.bossBarTimer = 0;
    this.gateTimer = 0;
    this.completionStarted = false;
    this.sectionName = this.level.getSectionAt(this.player.centerX).name;

    this.camera = new Camera(this.level.width);
    this.camera.x = 0;
    this.camera.snapTo(this.player);
  }

  startGame() {
    this.audio.unlock();
    this.audio.startMusic();
    this.audio.setPaused(false);
    this.setupWorld();
    this.mode = 'playing';
    this.hitStop = 0;
    this.ui.hideAllOverlays();
    this.ui.hideMenu();
    this.ui.showHUD();
    this.ui.showLevelIntro();
    this.ui.tutorial(
      '<b>A / D</b> MOVE &nbsp;·&nbsp; <b>SPACE</b> JUMP &nbsp;·&nbsp; <b>X</b> CUTLASS &nbsp;·&nbsp; <b>C</b> KNIFE &nbsp;·&nbsp; <b>ESC</b> PAUSE',
      8
    );
    this.camera.snapTo(this.player);
    this.ui.updateHUD(this.getHUDState());
    this.audio.checkpoint();
  }

  quitToMenu() {
    this.audio.stopMusic();
    this.audio.setPaused(false);
    this.setupWorld();
    this.mode = 'menu';
    this.camera.x = 20;
    this.ui.clearToasts();
    this.ui.hideLevelIntro();
    this.ui.showMenu();
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.ui.showPause();
    this.audio.setPaused(true);
    this.ui.clearToasts();
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.ui.hidePause();
    this.audio.setPaused(false);
  }

  toggleSound() {
    this.audio.unlock();
    const enabled = this.audio.toggle();
    this.ui.setSoundLabel(enabled);
    if (enabled) this.audio.click();
  }

  getHUDState() {
    const section = this.level.getSectionAt(this.player.centerX);
    return {
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      lives: this.lives,
      score: this.score,
      loot: this.loot,
      totalLoot: this.level.totalLoot,
      section: section.name,
      cooldownRatio: 1 - this.player.secondaryCooldown / PLAYER.knifeCooldown,
    };
  }

  update(dt) {
    this.time += dt;

    if (this.mode === 'playing' && this.input.consume('pause')) {
      this.pause();
      return;
    }
    if (this.mode === 'paused' && this.input.consume('pause')) {
      this.resume();
      return;
    }

    if (this.mode === 'menu') {
      this.updateMenu(dt);
      return;
    }

    if (this.mode === 'paused') {
      return;
    }

    if (this.mode === 'gameover' || this.mode === 'victory') {
      this.particles.update(dt * 0.7);
      this.background.time = this.time;
      return;
    }

    if (this.mode !== 'playing') return;

    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      this.particles.update(dt * 0.18);
      return;
    }

    this.updatePlaying(dt);
  }

  updateMenu(dt) {
    this.camera.x = 20 + Math.sin(this.time * 0.075) * 18;
    this.camera.y = 0;
    this.player.animationTime += dt;
    this.player.state = 'idle';
    for (const enemy of this.enemies) {
      if (enemy.alive) enemy.animationTime += dt * 0.4;
    }
    this.background.time = this.time;
    if (this.input.consume('confirm')) this.startGame();
  }

  updatePlaying(dt) {
    this.background.time = this.time;
    this.level.update(dt);
    this.elapsed += dt;

    this.player.update(dt, this.level, this);
    for (const enemy of this.enemies) {
      enemy.update(dt, this.player, this.level, this);
    }
    this.projectiles.update(dt, this);
    for (const collectible of this.collectibles) {
      collectible.update(dt, this.player, this);
    }

    if (!this.player.dead) {
      this.handleContactDamage();
      this.checkHazards();
      this.checkCheckpoints();
      this.checkTriggers();
      this.checkBoss();
      this.checkCompletion();
    }

    if (this.bossDefeated && !this.level.isGateOpen()) {
      this.gateTimer -= dt;
      if (this.gateTimer <= 0) {
        this.level.openGate();
        this.audio.gate();
        this.camera.shake(8, 0.6);
        this.ui.toast('The portcullis grinds open. The treasure vault awaits.', 3.4);
      }
    }

    if (this.bossBarTimer > 0) {
      this.bossBarTimer -= dt;
      if (this.bossBarTimer <= 0) this.ui.hideBossBar();
    }

    this.particles.update(dt);
    this.camera.update(this.player, dt);
    this.ui.updateHUD(this.getHUDState());

    if (this.player.dead && this.player.deathTimer > 2.15 && !this.deathHandled) {
      this.handleRespawn();
    }
  }

  handleContactDamage() {
    if (this.player.invulnerableTimer > 0 || this.player.dead) return;
    const playerBounds = this.player.getHurtBounds();
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.dying || enemy.contactCooldown > 0) continue;
      if (!rectsOverlap(playerBounds, enemy.getHurtBounds())) continue;
      const damage = enemy.isBoss ? 20 : enemy.type === 'heavy' ? 14 : 7;
      const hit = this.damagePlayer(damage, enemy.centerX, 'contact');
      if (hit) {
        enemy.contactCooldown = 1.1;
        break;
      }
    }
  }

  checkHazards() {
    if (this.player.dead) return;
    const bounds = this.player.getHurtBounds();
    for (const zone of this.level.waterZones) {
      if (
        this.player.x + this.player.w > zone.x &&
        this.player.x < zone.x + zone.w &&
        this.player.feetY > zone.y + (zone.type === 'darkPit' ? 8 : 3)
      ) {
        this.particles.splash(
          clamp(this.player.centerX, zone.x + 20, zone.x + zone.w - 20),
          zone.y,
          zone.type === 'darkPit' ? 10 : 24
        );
        if (zone.type === 'darkPit') this.particles.deathBurst(this.player.centerX, this.player.feetY, '#8aa77a', 18);
        this.audio.splash();
        this.player.health = 0;
        this.player.die(this, zone.type === 'darkPit' ? 'spikes' : 'water');
        return;
      }
    }

    if (this.player.y > 840) {
      this.player.health = 0;
      this.player.die(this, 'fall');
      return;
    }

    for (const hazard of this.level.hazards) {
      if (!rectsOverlap(bounds, hazard)) continue;
      if (this.player.invulnerableTimer > 0) continue;
      this.damagePlayer(16, hazard.x + hazard.w * 0.5, 'spikes');
      this.player.vy = -520;
      this.player.onGround = false;
      this.particles.hitSpark(this.player.centerX, this.player.feetY - 10, '#ffb06a', 10, 0.8);
      break;
    }
  }

  checkCheckpoints() {
    for (const checkpoint of this.level.checkpoints) {
      if (checkpoint.active) continue;
      if (Math.abs(this.player.centerX - checkpoint.x) > 76) continue;
      if (Math.abs(this.player.feetY - checkpoint.y) > 150) continue;
      for (const cp of this.level.checkpoints) cp.active = false;
      checkpoint.active = true;
      this.checkpointObject = checkpoint;
      this.checkpoint = { x: checkpoint.x, y: checkpoint.y, name: checkpoint.name };
      this.score += SCORE.checkpoint;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 20);
      this.audio.checkpoint();
      this.particles.sparkle(checkpoint.x, checkpoint.y - 82, '#ffe38a');
      this.particles.coinBurst(checkpoint.x, checkpoint.y - 60, '#ffd75c', 12);
      this.ui.toast(`Checkpoint secured — <em>${checkpoint.name}</em>`, 2.8);
      break;
    }
  }

  checkTriggers() {
    for (const trigger of this.level.triggers) {
      if (trigger.shown) continue;
      if (this.player.centerX < trigger.x) continue;
      trigger.shown = true;
      this.ui.toast(trigger.text, 4.1);
      break;
    }
  }

  checkBoss() {
    const boss = this.boss;
    if (!boss) return;
    if (!boss.activated && !boss.dying && this.player.centerX > this.level.bossTriggerX) {
      boss.activate(this);
    }
    if (boss.activated && boss.alive && !boss.dying) {
      this.ui.updateBossBar(boss.health, boss.maxHealth);
    }
  }

  checkCompletion() {
    if (this.completionStarted) return;
    if (this.bossDefeated && this.player.centerX > this.level.exitX) {
      this.completeLevel();
    }
  }

  handleSwordHit(player) {
    const attackBounds = player.getAttackBounds();
    if (!attackBounds) return;
    let connected = false;
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.dying) continue;
      if (player.hitEnemies.has(enemy.id)) continue;
      if (!rectsOverlap(attackBounds, enemy.getHurtBounds())) continue;
      player.hitEnemies.add(enemy.id);
      this.damageEnemy(enemy, player.combo === 2 ? PLAYER.swordComboDamage : PLAYER.swordDamage, player.centerX, player.facing, false);
      connected = true;
    }
    for (const collectible of this.collectibles) {
      if (collectible.type !== 'chest' || collectible.collected) continue;
      if (rectsOverlap(attackBounds, collectible.bounds)) {
        collectible.open(this);
        connected = true;
      }
    }
    if (connected) {
      this.camera.shake(4, 0.14);
      this.hitStop = Math.max(this.hitStop, 0.035);
      this.audio.clash();
    }
  }

  damageEnemy(enemy, amount, sourceX, direction, isKnife = false) {
    const hit = enemy.takeDamage(amount, sourceX, direction, this, isKnife);
    if (!hit) return false;
    this.camera.shake(enemy.isBoss ? 5 : 3, 0.11);
    this.hitStop = Math.max(this.hitStop, 0.028);
    this.particles.floatingText(
      enemy.centerX,
      enemy.y - 6,
      `${amount}`,
      isKnife ? '#bdf7ec' : '#ffe28a',
      14
    );
    return true;
  }

  damagePlayer(amount, sourceX, type = 'enemy') {
    if (this.player.dead || this.mode !== 'playing') return false;
    const hit = this.player.takeDamage(amount, sourceX, this, type);
    if (hit) {
      this.particles.floatingText(this.player.centerX, this.player.y - 6, `-${amount}`, '#ff7c63', 16);
      this.ui.updateHUD(this.getHUDState());
    }
    return hit;
  }

  onPlayerDeathStarted(reason) {
    this.deathHandled = false;
    if (reason === 'water') {
      this.audio.splash();
    }
  }

  onEnemyKilled(enemy) {
    this.kills++;
    this.score += enemy.config.score;
    this.particles.floatingText(enemy.centerX, enemy.y - 12, `+${enemy.config.score}`, '#ffd86a', 17);
    this.particles.coinBurst(enemy.centerX, enemy.centerY, '#ffce58', enemy.isBoss ? 30 : 9);

    if (enemy.isBoss) {
      this.bossDefeated = true;
      this.gateTimer = 1.8;
      this.bossBarTimer = 2.2;
      this.score += 1000;
      this.camera.shake(14, 0.9);
      this.particles.bossBurst(enemy.centerX, enemy.centerY);
      this.audio.roar();
      this.audio.victory();
      this.ui.toast('<em>IRONJAW FALLS!</em> The portcullis is opening...', 4.2);
      return;
    }

    const drops = enemy.type === 'heavy' ? 6 : enemy.type === 'ranged' ? 4 : 3;
    for (let i = 0; i < drops; i++) {
      const coin = createCollectible({
        id: `drop-${++dropId}`,
        type: 'coin',
        x: enemy.centerX + (Math.random() - 0.5) * 36,
        y: enemy.centerY + (Math.random() - 0.5) * 20,
      });
      this.collectibles.push(coin);
    }
    if (Math.random() < (enemy.type === 'heavy' ? 0.45 : 0.14)) {
      this.collectibles.push(
        createCollectible({
          id: `drop-${++dropId}`,
          type: 'food',
          x: enemy.centerX,
          y: enemy.centerY,
        })
      );
    }
  }

  collectItem(item) {
    let points = item.value;
    if (item.type === 'coin') {
      points = SCORE.coin;
      this.audio.coin();
      this.particles.coinBurst(item.x, item.y, '#ffd75c', 7);
    } else if (item.type === 'gem') {
      points = item.value || SCORE.gem;
      this.loot++;
      this.audio.gem();
      this.particles.gemBurst(item.x, item.y, '#6df5df');
    } else if (item.type === 'chest') {
      points = item.value || SCORE.chest;
      this.loot++;
      this.audio.chest();
      this.camera.shake(3, 0.14);
      this.particles.coinBurst(item.x, item.y - 10, '#ffda65', 18);
      this.particles.gemBurst(item.x, item.y - 12, '#ffe9a2');
      for (let i = 0; i < 4; i++) {
        this.collectibles.push(
          createCollectible({
            id: `drop-${++dropId}`,
            type: 'coin',
            x: item.x + (Math.random() - 0.5) * 30,
            y: item.y - 14 - i * 4,
          })
        );
      }
    } else if (item.type === 'idol') {
      points = item.value || SCORE.idol;
      this.loot++;
      this.audio.chest();
      this.audio.gem();
      this.camera.shake(5, 0.24);
      this.particles.gemBurst(item.x, item.y, '#ffdf74');
      this.particles.coinBurst(item.x, item.y, '#ffe58a', 24);
    } else if (item.type === 'food') {
      points = SCORE.food;
      const healed = Math.min(25, this.player.maxHealth - this.player.health);
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 25);
      this.audio.food();
      this.particles.gemBurst(item.x, item.y, '#8cf08d');
      this.particles.floatingText(item.x, item.y - 22, healed > 0 ? `+${healed} HP` : 'FULL', '#9cf59d', 15);
    }

    this.score += points;
    this.particles.floatingText(item.x, item.y - 28, `+${points}`, item.type === 'gem' ? '#7df5e0' : '#ffe38a', 16);
    this.ui.updateHUD(this.getHUDState());
  }

  handleRespawn() {
    this.deathHandled = true;
    this.lives--;
    if (this.lives <= 0) {
      this.gameOver();
      return;
    }

    this.player.respawn(this.checkpoint.x, this.checkpoint.y);
    this.camera.snapTo(this.player);
    this.projectiles.clear();
    this.particles.clear();
    for (const enemy of this.enemies) {
      enemy.reset();
      if (enemy.isBoss) {
        enemy.activated = false;
        enemy.dormant = true;
        enemy.state = 'idle';
        enemy.phase = 1;
        enemy.speed = enemy.config.speed;
        enemy.attackCooldownMax = enemy.config.attackCooldown;
      }
    }
    this.level.gate.active = true;
    this.bossDefeated = false;
    this.gateTimer = 0;
    this.bossBarTimer = 0;
    this.ui.hideBossBar();
    for (const cp of this.level.checkpoints) cp.active = cp === this.checkpointObject;
    this.ui.updateHUD(this.getHUDState());
    this.ui.toast(`A life lost. Back to <em>${this.checkpoint.name}</em>.`, 3);
  }

  gameOver() {
    this.mode = 'gameover';
    this.audio.stopMusic();
    this.audio.setPaused(false);
    this.audio.gameover();
    this.ui.hideBossBar();
    this.ui.showGameOver({
      score: this.score,
      loot: this.loot,
      totalLoot: this.level.totalLoot,
      time: this.elapsed,
    });
  }

  completeLevel() {
    if (this.completionStarted) return;
    this.completionStarted = true;
    this.mode = 'victory';
    const bonus = this.loot * 100 + this.lives * 250;
    this.score += bonus;
    this.player.setVictory();
    this.audio.stopMusic();
    this.audio.setPaused(false);
    this.audio.victory();
    this.ui.hideBossBar();
    this.ui.clearToasts();
    this.ui.showVictory({
      score: this.score,
      loot: this.loot,
      totalLoot: this.level.totalLoot,
      time: this.elapsed,
      kills: this.kills,
      bonus,
    });
  }

  render(interpolation = 0) {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    this.background.draw(ctx, this.camera, this.time);

    ctx.save();
    ctx.translate(-this.camera.renderX, -this.camera.renderY);
    this.world.draw(ctx, this.camera, this.level, this.time, this.player);

    for (const collectible of this.collectibles) {
      if (collectible.x < this.camera.renderX - 100 || collectible.x > this.camera.renderX + 1380) continue;
      collectible.draw(ctx, this.time);
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.x + enemy.w < this.camera.renderX - 160 || enemy.x > this.camera.renderX + 1440) continue;
      enemy.draw(ctx, this.time);
    }

    this.projectiles.draw(ctx, this.camera, this.time);

    if (!this.player.dead || this.player.deathTimer < 2.4) {
      this.player.draw(ctx, this.time);
    }

    this.particles.draw(ctx, this.camera);
    ctx.restore();

    this.background.drawAtmosphere(ctx, this.camera, this.time);

    // A soft warm flash when the player takes damage.
    if (this.player.invulnerableTimer > 0.9 && !this.player.dead) {
      const alpha = clamp((this.player.invulnerableTimer - 0.9) * 0.14, 0, 0.16);
      ctx.fillStyle = `rgba(255, 82, 44, ${alpha})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // In the menu, fade the world slightly behind the overlay.
    if (this.mode === 'menu') {
      ctx.fillStyle = 'rgba(3, 8, 8, 0.16)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
}
