import { formatScore, formatLoot, formatTime } from './utils.js';

export class UI {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.shell = document.getElementById('game-shell');
    this.hud = document.getElementById('hud');
    this.menu = document.getElementById('menu');
    this.pause = document.getElementById('pause-menu');
    this.gameover = document.getElementById('gameover-menu');
    this.victory = document.getElementById('victory-menu');
    this.controls = document.getElementById('controls-menu');
    this.levelIntro = document.getElementById('level-intro');

    this.healthFill = document.getElementById('health-fill');
    this.healthGhost = document.getElementById('health-ghost');
    this.lives = document.getElementById('lives');
    this.score = document.getElementById('score');
    this.loot = document.getElementById('loot');
    this.sectionName = document.getElementById('section-name');
    this.cooldownFill = document.getElementById('cooldown-fill');
    this.bossBar = document.getElementById('boss-bar');
    this.bossFill = document.getElementById('boss-fill');
    this.bossGhost = document.getElementById('boss-ghost');
    this.bossName = this.bossBar.querySelector('.boss-name');
    this.toastEl = document.getElementById('toast');
    this.tutorialEl = document.getElementById('tutorial');

    this.toastTimer = null;
    this.tutorialTimer = null;
    this.ghostTimer = null;
    this.lastHealth = 100;
    this.controlsReturn = 'menu';

    this.bindButton('btn-start', () => this.callbacks.onStart?.());
    this.bindButton('btn-controls', () => this.showControls('menu'));
    this.bindButton('btn-controls-back', () => this.hideControls());
    this.bindButton('btn-sound-menu', () => this.callbacks.onToggleSound?.());
    this.bindButton('btn-sound-pause', () => this.callbacks.onToggleSound?.());
    this.bindButton('btn-resume', () => this.callbacks.onResume?.());
    this.bindButton('btn-restart-pause', () => this.callbacks.onRestart?.());
    this.bindButton('btn-quit-pause', () => this.callbacks.onQuit?.());
    this.bindButton('btn-restart-gameover', () => this.callbacks.onRestart?.());
    this.bindButton('btn-quit-gameover', () => this.callbacks.onQuit?.());
    this.bindButton('btn-play-again', () => this.callbacks.onRestart?.());
    this.bindButton('btn-quit-victory', () => this.callbacks.onQuit?.());

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  bindButton(id, handler) {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener('click', () => {
        this.callbacks.onClick?.();
        handler();
      });
    }
  }

  resize() {
    if (!this.shell) return;
    const rect = this.shell.getBoundingClientRect();
    const scale = rect.width / 1280;
    this.shell.style.setProperty('--ui-scale', String(scale));
  }

  showHUD() {
    this.hud.classList.remove('hidden');
  }

  hideHUD() {
    this.hud.classList.add('hidden');
  }

  showMenu() {
    this.hideAllOverlays();
    this.menu.classList.remove('hidden');
    this.hideHUD();
  }

  hideMenu() {
    this.menu.classList.add('hidden');
  }

  hideAllOverlays() {
    this.menu.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.gameover.classList.add('hidden');
    this.victory.classList.add('hidden');
    this.controls.classList.add('hidden');
    this.hideBossBar();
  }

  showPause() {
    this.pause.classList.remove('hidden');
  }

  hidePause() {
    this.pause.classList.add('hidden');
  }

  showControls(returnTo = 'menu') {
    this.controlsReturn = returnTo;
    this.controls.classList.remove('hidden');
    if (returnTo === 'menu') this.menu.classList.add('hidden');
    if (returnTo === 'pause') this.pause.classList.add('hidden');
  }

  hideControls() {
    this.controls.classList.add('hidden');
    if (this.controlsReturn === 'pause') this.pause.classList.remove('hidden');
    else this.menu.classList.remove('hidden');
  }

  showGameOver(stats) {
    this.hideAllOverlays();
    this.hideHUD();
    document.getElementById('gameover-score').textContent = formatScore(stats.score);
    document.getElementById('gameover-loot').textContent = `${stats.loot} / ${stats.totalLoot}`;
    document.getElementById('gameover-time').textContent = formatTime(stats.time);
    this.gameover.classList.remove('hidden');
  }

  showVictory(stats) {
    this.hideAllOverlays();
    this.hideHUD();
    document.getElementById('victory-score').textContent = formatScore(stats.score);
    document.getElementById('victory-loot').textContent = `${stats.loot} / ${stats.totalLoot}`;
    document.getElementById('victory-time').textContent = formatTime(stats.time);
    document.getElementById('victory-kills').textContent = String(stats.kills);
    document.getElementById('victory-bonus').textContent = `+${stats.bonus}`;
    this.victory.classList.remove('hidden');
  }

  showLevelIntro() {
    this.levelIntro.classList.remove('hidden');
    // Restart the CSS animation.
    this.levelIntro.style.animation = 'none';
    void this.levelIntro.offsetWidth;
    this.levelIntro.style.animation = '';
    window.clearTimeout(this.introTimer);
    this.introTimer = window.setTimeout(() => this.levelIntro.classList.add('hidden'), 3150);
  }

  hideLevelIntro() {
    this.levelIntro.classList.add('hidden');
  }

  updateHUD(state) {
    const healthPercent = Math.max(0, Math.min(100, (state.health / state.maxHealth) * 100));
    this.healthFill.style.width = `${healthPercent}%`;
    if (this.healthGhost.style.width !== `${healthPercent}%`) {
      window.clearTimeout(this.ghostTimer);
      this.ghostTimer = window.setTimeout(() => {
        this.healthGhost.style.width = `${healthPercent}%`;
      }, 220);
    }
    this.lives.textContent = String(state.lives);
    this.score.textContent = formatScore(state.score);
    this.loot.textContent = `${formatLoot(state.loot)} / ${formatLoot(state.totalLoot)}`;
    if (this.sectionName.textContent !== state.section.toUpperCase()) {
      this.sectionName.textContent = state.section.toUpperCase();
    }
    const ratio = Math.max(0, Math.min(1, state.cooldownRatio));
    this.cooldownFill.style.transform = `scaleX(${ratio})`;
    this.cooldownFill.style.background =
      ratio >= 1
        ? 'linear-gradient(90deg, #d2a445, #fff0a4)'
        : 'linear-gradient(90deg, #594a2a, #97814a)';
  }

  showBossBar(name) {
    this.bossName.innerHTML = `<span>⚓</span> ${name.toUpperCase()} <span>⚓</span>`;
    this.bossBar.classList.remove('hidden');
  }

  hideBossBar() {
    this.bossBar.classList.add('hidden');
  }

  updateBossBar(health, maxHealth) {
    const percent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
    this.bossFill.style.width = `${percent}%`;
    this.bossGhost.style.width = `${percent}%`;
  }

  toast(html, duration = 3.2) {
    if (!this.toastEl) return;
    this.toastEl.innerHTML = html;
    this.toastEl.classList.remove('hidden');
    // Force reflow so repeated toasts animate in.
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('show');
      window.setTimeout(() => {
        if (!this.toastEl.classList.contains('show')) this.toastEl.classList.add('hidden');
      }, 200);
    }, duration * 1000);
  }

  tutorial(html, duration = 7) {
    if (!this.tutorialEl) return;
    this.tutorialEl.innerHTML = html;
    this.tutorialEl.classList.remove('hidden');
    void this.tutorialEl.offsetWidth;
    this.tutorialEl.classList.add('show');
    window.clearTimeout(this.tutorialTimer);
    this.tutorialTimer = window.setTimeout(() => {
      this.tutorialEl.classList.remove('show');
      window.setTimeout(() => {
        if (!this.tutorialEl.classList.contains('show')) this.tutorialEl.classList.add('hidden');
      }, 200);
    }, duration * 1000);
  }

  clearToasts() {
    window.clearTimeout(this.toastTimer);
    window.clearTimeout(this.tutorialTimer);
    if (this.toastEl) {
      this.toastEl.classList.remove('show');
      this.toastEl.classList.add('hidden');
    }
    if (this.tutorialEl) {
      this.tutorialEl.classList.remove('show');
      this.tutorialEl.classList.add('hidden');
    }
  }

  setSoundLabel(enabled) {
    const label = `SOUND: ${enabled ? 'ON' : 'OFF'}`;
    const menuButton = document.getElementById('btn-sound-menu');
    const pauseButton = document.getElementById('btn-sound-pause');
    if (menuButton) menuButton.textContent = label;
    if (pauseButton) pauseButton.textContent = label;
  }
}
