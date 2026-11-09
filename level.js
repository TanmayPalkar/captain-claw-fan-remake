import { SECTIONS } from './config.js';
import { hash2 } from './utils.js';

let collectibleId = 0;

class Level {
  constructor() {
    this.width = 13400;
    this.height = 720;
    this.solids = [];
    this.movingPlatforms = [];
    this.hazards = [];
    this.waterZones = [];
    this.decorations = [];
    this.enemySpawns = [];
    this.collectibleSpawns = [];
    this.checkpoints = [];
    this.triggers = [];
    this.sections = SECTIONS.map((s) => ({ ...s }));
    this.gate = null;
    this.bossSpawn = null;
    this.bossTriggerX = 11750;
    this.exitX = 13240;
    this.spawn = { x: 118, y: 590 };
    this.totalLoot = 0;
    this.totalCoins = 0;
    this.time = 0;
    this.build();
    this.collisionSolids = [...this.solids, ...this.movingPlatforms];
    this.totalLoot = this.collectibleSpawns.filter((c) => ['gem', 'chest', 'idol'].includes(c.type)).length;
    this.totalCoins = this.collectibleSpawns.filter((c) => c.type === 'coin').length;
  }

  addSolid(x, y, w, h, kind, options = {}) {
    const solid = {
      x,
      y,
      w,
      h,
      kind,
      oneWay: Boolean(options.oneWay),
      active: true,
      seed: hash2(x, y, 73),
      ...options,
    };
    this.solids.push(solid);
    return solid;
  }

  addMovingPlatform(x, y, w, h, axis, range, speed, phase = 0, kind = 'movingWood') {
    const platform = {
      x,
      y,
      w,
      h,
      baseX: x,
      baseY: y,
      axis,
      range,
      speed,
      phase,
      dx: 0,
      dy: 0,
      kind,
      active: true,
      oneWay: false,
      seed: hash2(x, y, 99),
    };
    this.movingPlatforms.push(platform);
    return platform;
  }

  addHazard(x, y, w, h, type = 'spikes') {
    this.hazards.push({ x, y, w, h, type });
  }

  addWater(x, y, w, type = 'water') {
    this.waterZones.push({ x, y, w, type });
  }

  addDecor(type, x, y, options = {}) {
    this.decorations.push({
      type,
      x,
      y,
      scale: options.scale || 1,
      flip: Boolean(options.flip),
      layer: options.layer || 'front',
      variant: options.variant ?? Math.floor(hash2(x, y, 31) * 3),
    });
  }

  addEnemy(type, x, feetY, options = {}) {
    this.enemySpawns.push({
      type,
      x,
      feetY,
      patrolLeft: options.patrolLeft ?? x - 150,
      patrolRight: options.patrolRight ?? x + 150,
      facing: options.facing ?? -1,
      dormant: Boolean(options.dormant),
      isBoss: Boolean(options.isBoss),
    });
  }

  addCoin(x, y) {
    this.collectibleSpawns.push({ id: ++collectibleId, type: 'coin', x, y });
  }

  addCoinLine(x, y, count, spacing = 32, curve = 0) {
    for (let i = 0; i < count; i++) {
      this.addCoin(x + i * spacing, y - Math.sin((i / Math.max(1, count - 1)) * Math.PI) * curve);
    }
  }

  addGem(x, y, value = 100) {
    this.collectibleSpawns.push({ id: ++collectibleId, type: 'gem', x, y, value });
  }

  addChest(x, y, value = 500, hidden = false) {
    this.collectibleSpawns.push({ id: ++collectibleId, type: 'chest', x, y, value, hidden });
  }

  addFood(x, y) {
    this.collectibleSpawns.push({ id: ++collectibleId, type: 'food', x, y });
  }

  addIdol(x, y, value = 1000) {
    this.collectibleSpawns.push({ id: ++collectibleId, type: 'idol', x, y, value });
  }

  addCheckpoint(x, y, name) {
    this.checkpoints.push({ x, y, name, active: false });
  }

  addTrigger(x, text) {
    this.triggers.push({ x, text, shown: false });
  }

  build() {
    // ============================================================
    // TERRAIN
    // ============================================================
    // Section A — Coastal Arrival
    this.addSolid(0, 590, 1180, 150, 'sand');
    this.addSolid(1360, 590, 760, 150, 'sand');
    this.addSolid(2310, 590, 850, 150, 'sand');

    this.addSolid(300, 500, 150, 26, 'rock');
    this.addSolid(690, 485, 170, 24, 'wood');
    this.addSolid(810, 390, 140, 22, 'wood');
    this.addSolid(1200, 520, 80, 20, 'wood');
    this.addSolid(1290, 460, 80, 20, 'wood');
    this.addSolid(1550, 505, 130, 20, 'wood');
    this.addSolid(1740, 425, 130, 20, 'wood');
    this.addSolid(1925, 350, 145, 22, 'wood');
    this.addSolid(2160, 515, 90, 20, 'wood');
    this.addSolid(2240, 450, 90, 20, 'wood');
    this.addSolid(2840, 490, 120, 22, 'wood');

    this.addWater(1180, 658, 180);
    this.addWater(2120, 658, 190);

    // Section B — Pirate Outpost
    this.addSolid(3160, 570, 900, 170, 'dock');
    this.addSolid(3370, 460, 150, 22, 'wood');
    this.addSolid(3540, 370, 140, 22, 'wood');
    this.addSolid(3820, 450, 150, 22, 'wood');
    this.addMovingPlatform(4085, 515, 120, 20, 'x', 90, 1.15, 0, 'movingWood');
    this.addSolid(4210, 455, 85, 20, 'wood');

    this.addSolid(4300, 590, 1000, 150, 'stone');
    this.addSolid(4440, 485, 180, 24, 'wood');
    this.addSolid(4610, 390, 170, 22, 'wood');
    this.addSolid(5100, 450, 140, 20, 'wood');

    this.addWater(4060, 658, 240);
    this.addWater(5300, 658, 180);

    this.addSolid(5340, 500, 80, 20, 'wood');
    this.addSolid(5480, 590, 900, 150, 'wood');
    this.addSolid(5900, 460, 150, 22, 'wood');

    // Section C — Jungle Ruins
    this.addSolid(6380, 600, 1020, 150, 'grass');
    this.addSolid(6900, 480, 150, 22, 'ruin');

    this.addWater(7400, 668, 340, 'darkPit');
    this.addHazard(7400, 682, 340, 38, 'spikes');
    this.addSolid(7430, 520, 90, 20, 'ruin');
    this.addMovingPlatform(7580, 470, 100, 20, 'y', 85, 1.05, 1.4, 'movingRuin');
    this.addSolid(7680, 430, 90, 20, 'ruin');

    this.addSolid(7740, 590, 1040, 150, 'ruin');
    this.addSolid(7850, 500, 160, 24, 'ruin');
    this.addSolid(8050, 420, 160, 24, 'ruin');
    this.addSolid(8250, 340, 180, 24, 'ruin');
    this.addSolid(8440, 430, 150, 24, 'ruin');
    this.addSolid(8600, 520, 140, 22, 'ruin');

    this.addWater(8780, 668, 230, 'darkPit');
    this.addHazard(8780, 682, 230, 38, 'spikes');
    this.addSolid(8820, 500, 80, 20, 'ruin');
    this.addMovingPlatform(8920, 450, 90, 20, 'x', 55, 1.4, 0.4, 'movingRuin');

    this.addSolid(9010, 600, 900, 150, 'grass');
    this.addSolid(9150, 500, 160, 24, 'ruin');
    this.addSolid(9350, 410, 180, 24, 'ruin');
    this.addSolid(9560, 320, 170, 24, 'ruin');

    // Section D — Pirate Stronghold
    this.addSolid(9910, 580, 950, 170, 'stone');
    this.addSolid(10050, 480, 150, 24, 'stone');
    this.addSolid(10250, 390, 140, 24, 'stone');
    this.addSolid(10380, 450, 170, 24, 'stone');
    this.addSolid(10600, 470, 150, 24, 'stone');

    this.addWater(10860, 658, 200);
    this.addMovingPlatform(10890, 520, 100, 20, 'x', 100, 1.3, 0.9, 'movingStone');

    this.addSolid(11060, 590, 600, 150, 'stone');
    this.addSolid(11660, 600, 1740, 150, 'stone');
    this.addSolid(11950, 500, 180, 24, 'stone');
    this.addSolid(12650, 490, 190, 24, 'stone');
    this.addSolid(12900, 400, 150, 22, 'stone');

    this.gate = this.addSolid(13120, 338, 54, 262, 'gate', { gate: true });
    this.gate.active = true;

    // ============================================================
    // CHECKPOINTS
    // ============================================================
    this.addCheckpoint(2990, 590, 'Coastal Camp');
    this.addCheckpoint(5230, 590, 'Outpost Gate');
    this.addCheckpoint(6300, 590, 'Jungle Trail');
    this.addCheckpoint(7270, 600, 'Ruins Approach');
    this.addCheckpoint(9800, 600, 'Temple Steps');
    this.addCheckpoint(11500, 590, 'Stronghold Vault');

    // ============================================================
    // ENEMIES
    // ============================================================
    this.addEnemy('pirate', 2570, 590, { patrolLeft: 2410, patrolRight: 2740 });
    this.addEnemy('pirate', 3420, 570, { patrolLeft: 3230, patrolRight: 3590 });
    this.addEnemy('pirate', 3660, 570, { patrolLeft: 3490, patrolRight: 3790 });
    this.addEnemy('ranged', 3890, 450, { patrolLeft: 3825, patrolRight: 3955 });
    this.addEnemy('pirate', 4550, 590, { patrolLeft: 4330, patrolRight: 4700 });
    this.addEnemy('ranged', 4690, 390, { patrolLeft: 4620, patrolRight: 4770 });
    this.addEnemy('pirate', 4970, 590, { patrolLeft: 4760, patrolRight: 5100 });
    this.addEnemy('ranged', 5975, 460, { patrolLeft: 5910, patrolRight: 6035 });
    this.addEnemy('heavy', 6050, 590, { patrolLeft: 5750, patrolRight: 6230 });
    this.addEnemy('pirate', 6500, 600, { patrolLeft: 6390, patrolRight: 6710 });
    this.addEnemy('ranged', 6920, 480, { patrolLeft: 6905, patrolRight: 7040 });
    this.addEnemy('pirate', 7180, 600, { patrolLeft: 7050, patrolRight: 7350 });
    this.addEnemy('pirate', 7950, 590, { patrolLeft: 7770, patrolRight: 8170 });
    this.addEnemy('ranged', 8300, 340, { patrolLeft: 8255, patrolRight: 8420 });
    this.addEnemy('pirate', 8500, 590, { patrolLeft: 8360, patrolRight: 8720 });
    this.addEnemy('ranged', 9210, 500, { patrolLeft: 9160, patrolRight: 9300 });
    this.addEnemy('heavy', 9700, 600, { patrolLeft: 9430, patrolRight: 9880 });
    this.addEnemy('heavy', 10150, 580, { patrolLeft: 9940, patrolRight: 10400 });
    this.addEnemy('ranged', 10450, 450, { patrolLeft: 10390, patrolRight: 10540 });
    this.addEnemy('pirate', 10700, 580, { patrolLeft: 10540, patrolRight: 10840 });
    this.addEnemy('ranged', 12020, 500, { patrolLeft: 11960, patrolRight: 12120 });
    this.addEnemy('heavy', 12300, 600, { patrolLeft: 12150, patrolRight: 12480, dormant: true });

    this.bossSpawn = { type: 'boss', x: 12550, feetY: 600, patrolLeft: 11720, patrolRight: 13050 };

    // ============================================================
    // COLLECTIBLES
    // ============================================================
    this.addCoinLine(262, 545, 5, 33, 24);
    this.addCoinLine(335, 462, 3, 32, 20);
    this.addCoinLine(710, 447, 3, 32, 16);
    this.addCoinLine(832, 352, 3, 31, 14);
    this.addCoin(1238, 488);
    this.addCoin(1312, 426);
    this.addCoinLine(1568, 468, 3, 31, 18);
    this.addCoinLine(1760, 388, 3, 31, 16);
    this.addCoinLine(1945, 312, 3, 30, 14);
    this.addCoin(2185, 484);
    this.addCoin(2262, 416);
    this.addCoinLine(2375, 540, 5, 34, 22);
    this.addCoinLine(2615, 510, 3, 30, 36);
    this.addCoinLine(2862, 452, 3, 31, 18);

    this.addCoinLine(3200, 525, 4, 32, 16);
    this.addCoinLine(3390, 420, 4, 30, 20);
    this.addCoinLine(3560, 330, 4, 29, 18);
    this.addCoinLine(3860, 410, 4, 30, 18);
    this.addCoinLine(4100, 470, 4, 34, 22);
    this.addCoinLine(4345, 545, 4, 34, 18);
    this.addCoinLine(4460, 445, 4, 31, 18);
    this.addCoinLine(4630, 350, 4, 30, 16);
    this.addCoinLine(5125, 412, 3, 30, 16);
    this.addCoinLine(5365, 462, 3, 28, 12);
    this.addCoinLine(5535, 540, 4, 34, 20);
    this.addCoinLine(5920, 420, 4, 30, 18);
    this.addCoinLine(6070, 520, 4, 32, 20);

    this.addCoinLine(6420, 555, 4, 33, 20);
    this.addCoinLine(6925, 440, 4, 30, 18);
    this.addCoinLine(7450, 478, 3, 28, 14);
    this.addCoinLine(7700, 388, 3, 29, 14);
    this.addCoinLine(7870, 458, 4, 31, 18);
    this.addCoinLine(8070, 378, 4, 31, 18);
    this.addCoinLine(8270, 298, 4, 31, 18);
    this.addCoinLine(8460, 388, 3, 30, 14);
    this.addCoinLine(8620, 478, 3, 29, 14);
    this.addCoinLine(8845, 458, 3, 28, 12);
    this.addCoinLine(9170, 458, 4, 31, 18);
    this.addCoinLine(9370, 368, 4, 31, 18);
    this.addCoinLine(9580, 278, 4, 31, 18);

    this.addCoinLine(9960, 535, 4, 33, 18);
    this.addCoinLine(10070, 438, 4, 30, 16);
    this.addCoinLine(10270, 348, 4, 29, 14);
    this.addCoinLine(10400, 408, 4, 31, 18);
    this.addCoinLine(10620, 428, 4, 30, 16);
    this.addCoinLine(10920, 475, 3, 30, 14);
    this.addCoinLine(11100, 540, 4, 33, 18);
    this.addCoinLine(11320, 540, 4, 33, 18);
    this.addCoinLine(11710, 550, 4, 33, 18);
    this.addCoinLine(11975, 458, 4, 30, 16);
    this.addCoinLine(12675, 448, 4, 30, 16);
    this.addCoinLine(12925, 358, 3, 30, 14);

    this.addGem(462, 458);
    this.addGem(882, 348);
    this.addGem(1242, 475);
    this.addGem(1802, 382);
    this.addGem(3008, 532);
    this.addGem(4802, 348);
    this.addGem(6118, 418);
    this.addGem(6932, 438);
    this.addGem(7918, 456);
    this.addGem(8470, 384);
    this.addGem(9208, 454);
    this.addGem(10320, 348);
    this.addGem(12095, 456);
    this.addGem(12715, 446);

    this.addChest(1980, 326, 500);
    this.addChest(3580, 346, 500);
    this.addChest(5160, 426, 500, true);
    this.addChest(8330, 316, 750, true);
    this.addChest(9560, 296, 750);
    this.addChest(11220, 566, 750);
    this.addChest(11420, 566, 750);

    this.addIdol(13010, 372, 1250);
    this.addIdol(7040, 548, 1000);

    this.addFood(1580, 560);
    this.addFood(3720, 540);
    this.addFood(5370, 465);
    this.addFood(8060, 560);
    this.addFood(9740, 560);
    this.addFood(11470, 560);
    this.addFood(12030, 560);

    // ============================================================
    // DECORATION — BACK LAYERS
    // ============================================================
    this.addDecor('palmBack', 170, 590, { scale: 1.25, layer: 'back' });
    this.addDecor('palmBack', 610, 590, { scale: 0.95, flip: true, layer: 'back' });
    this.addDecor('palmBack', 1030, 590, { scale: 1.15, layer: 'back' });
    this.addDecor('palmBack', 1480, 590, { scale: 1.35, flip: true, layer: 'back' });
    this.addDecor('palmBack', 2050, 590, { scale: 1.1, layer: 'back' });
    this.addDecor('palmBack', 2480, 590, { scale: 1.2, flip: true, layer: 'back' });
    this.addDecor('palmBack', 2870, 590, { scale: 0.95, layer: 'back' });
    this.addDecor('shackBack', 4520, 590, { scale: 1.25, layer: 'back' });
    this.addDecor('shackBack', 5050, 590, { scale: 1.05, flip: true, layer: 'back' });
    this.addDecor('dockBack', 3800, 570, { scale: 1.4, layer: 'back' });
    this.addDecor('jungleTreeBack', 6420, 600, { scale: 1.3, layer: 'back' });
    this.addDecor('jungleTreeBack', 6760, 600, { scale: 1.05, flip: true, layer: 'back' });
    this.addDecor('jungleTreeBack', 7250, 600, { scale: 1.4, layer: 'back' });
    this.addDecor('jungleTreeBack', 7750, 590, { scale: 1.2, flip: true, layer: 'back' });
    this.addDecor('jungleTreeBack', 8160, 590, { scale: 1.35, layer: 'back' });
    this.addDecor('jungleTreeBack', 8620, 590, { scale: 1.0, layer: 'back' });
    this.addDecor('jungleTreeBack', 9120, 600, { scale: 1.25, flip: true, layer: 'back' });
    this.addDecor('jungleTreeBack', 9600, 600, { scale: 1.15, layer: 'back' });
    this.addDecor('waterfallBack', 8680, 590, { scale: 1.1, layer: 'back' });
    this.addDecor('fortressTowerBack', 10080, 580, { scale: 1.25, layer: 'back' });
    this.addDecor('fortressTowerBack', 10600, 580, { scale: 0.95, flip: true, layer: 'back' });
    this.addDecor('fortressTowerBack', 11200, 590, { scale: 1.1, layer: 'back' });
    this.addDecor('fortressTowerBack', 12200, 600, { scale: 1.3, flip: true, layer: 'back' });
    this.addDecor('fortressTowerBack', 12850, 600, { scale: 1.15, layer: 'back' });

    // ============================================================
    // DECORATION — FRONT LAYERS
    // ============================================================
    this.addDecor('sign', 95, 590, { scale: 1, layer: 'front' });
    this.addDecor('rock', 260, 590, { scale: 1, layer: 'front' });
    this.addDecor('fern', 390, 590, { scale: 0.9, layer: 'front' });
    this.addDecor('palm', 520, 590, { scale: 0.9, layer: 'front' });
    this.addDecor('barrel', 940, 590, { scale: 1, layer: 'front' });
    this.addDecor('crate', 1000, 590, { scale: 1, layer: 'front' });
    this.addDecor('rock', 1400, 590, { scale: 0.75, layer: 'front' });
    this.addDecor('skull', 1600, 590, { scale: 1, layer: 'front' });
    this.addDecor('fern', 1830, 590, { scale: 0.8, flip: true, layer: 'front' });
    this.addDecor('crate', 2420, 590, { scale: 1, layer: 'front' });
    this.addDecor('barrel', 2480, 590, { scale: 0.9, layer: 'front' });
    this.addDecor('palm', 2740, 590, { scale: 1.05, flip: true, layer: 'front' });
    this.addDecor('rock', 2900, 590, { scale: 0.85, layer: 'front' });
    this.addDecor('sign', 3120, 590, { scale: 0.9, layer: 'front' });

    this.addDecor('crate', 3205, 570, { scale: 1.05, layer: 'front' });
    this.addDecor('barrel', 3260, 570, { scale: 0.9, layer: 'front' });
    this.addDecor('crate', 3500, 570, { scale: 0.9, layer: 'front' });
    this.addDecor('barrel', 3750, 570, { scale: 1, layer: 'front' });
    this.addDecor('torch', 4000, 570, { scale: 1, layer: 'front' });
    this.addDecor('banner', 4360, 590, { scale: 1, layer: 'front' });
    this.addDecor('crate', 4410, 590, { scale: 1, layer: 'front' });
    this.addDecor('torch', 4580, 590, { scale: 1, layer: 'front' });
    this.addDecor('barrel', 4750, 590, { scale: 0.9, layer: 'front' });
    this.addDecor('crate', 4900, 590, { scale: 1, layer: 'front' });
    this.addDecor('crate', 5130, 590, { scale: 0.9, layer: 'front' });
    this.addDecor('banner', 5290, 590, { scale: 0.9, layer: 'front' });
    this.addDecor('crate', 5530, 590, { scale: 1, layer: 'front' });
    this.addDecor('barrel', 5590, 590, { scale: 0.9, layer: 'front' });
    this.addDecor('torch', 5720, 590, { scale: 1, layer: 'front' });
    this.addDecor('crate', 5820, 590, { scale: 0.9, layer: 'front' });
    this.addDecor('barrel', 5960, 590, { scale: 1, layer: 'front' });
    this.addDecor('torch', 6200, 590, { scale: 1, layer: 'front' });

    this.addDecor('fern', 6410, 600, { scale: 1.1, layer: 'front' });
    this.addDecor('jungleTree', 6620, 600, { scale: 1, layer: 'front' });
    this.addDecor('fern', 6820, 600, { scale: 0.8, flip: true, layer: 'front' });
    this.addDecor('jungleTree', 7120, 600, { scale: 0.85, layer: 'front' });
    this.addDecor('rock', 7380, 600, { scale: 0.8, layer: 'front' });
    this.addDecor('jungleTree', 7790, 590, { scale: 1.1, flip: true, layer: 'front' });
    this.addDecor('ruinPillar', 7880, 590, { scale: 1, layer: 'front' });
    this.addDecor('fern', 8010, 590, { scale: 0.9, layer: 'front' });
    this.addDecor('statue', 8210, 590, { scale: 0.9, layer: 'front' });
    this.addDecor('ruinPillar', 8580, 590, { scale: 1.15, layer: 'front' });
    this.addDecor('fern', 8750, 590, { scale: 0.8, flip: true, layer: 'front' });
    this.addDecor('statue', 9080, 600, { scale: 1, flip: true, layer: 'front' });
    this.addDecor('ruinPillar', 9290, 600, { scale: 0.95, layer: 'front' });
    this.addDecor('fern', 9440, 600, { scale: 0.85, layer: 'front' });
    this.addDecor('jungleTree', 9700, 600, { scale: 0.95, layer: 'front' });

    this.addDecor('torch', 9950, 580, { scale: 1.1, layer: 'front' });
    this.addDecor('banner', 10020, 580, { scale: 1, layer: 'front' });
    this.addDecor('crate', 10200, 580, { scale: 1, layer: 'front' });
    this.addDecor('torch', 10300, 580, { scale: 1, layer: 'front' });
    this.addDecor('skull', 10500, 580, { scale: 1, layer: 'front' });
    this.addDecor('torch', 10750, 580, { scale: 1.1, layer: 'front' });
    this.addDecor('banner', 10960, 590, { scale: 1, layer: 'front' });
    this.addDecor('torch', 11110, 590, { scale: 1, layer: 'front' });
    this.addDecor('chestPile', 11310, 590, { scale: 1, layer: 'front' });
    this.addDecor('torch', 11520, 590, { scale: 1.1, layer: 'front' });
    this.addDecor('banner', 11720, 600, { scale: 1.2, layer: 'front' });
    this.addDecor('torch', 11850, 600, { scale: 1.1, layer: 'front' });
    this.addDecor('skull', 12100, 600, { scale: 1.2, layer: 'front' });
    this.addDecor('torch', 12300, 600, { scale: 1, layer: 'front' });
    this.addDecor('brazier', 12450, 600, { scale: 1.15, layer: 'front' });
    this.addDecor('banner', 12600, 600, { scale: 1.1, layer: 'front' });
    this.addDecor('torch', 12720, 600, { scale: 1.1, layer: 'front' });
    this.addDecor('skull', 12900, 600, { scale: 1.2, layer: 'front' });
    this.addDecor('brazier', 13000, 600, { scale: 1.25, layer: 'front' });
    this.addDecor('chain', 13160, 600, { scale: 1, layer: 'front' });

    // ============================================================
    // TUTORIAL TRIGGERS
    // ============================================================
    this.addTrigger(60, 'Move with <em>A / D</em> or the arrow keys. The hunt begins.');
    this.addTrigger(420, 'Press <em>SPACE</em> to jump. Hold it for a higher leap.');
    this.addTrigger(980, 'Gold adds score. <em>Gems, chests and idols</em> count as loot.');
    this.addTrigger(2260, 'A cutlass waits for no one — press <em>X</em> to strike.');
    this.addTrigger(3160, 'Pirate Outpost. Watch the high ground — and search for hidden chests.');
    this.addTrigger(4040, 'Press <em>C</em> to throw a knife at distant foes.');
    this.addTrigger(4300, 'Some treasure hides above the obvious path.');
    this.addTrigger(6380, 'Jungle Ruins. Mind the spikes and moving platforms.');
    this.addTrigger(7400, 'Spike pits are deadly. Time your jumps.');
    this.addTrigger(8780, 'The old temple hides its finest loot up high.');
    this.addTrigger(9910, 'Pirate Stronghold. Ironjaw\'s guards hit hard.');
    this.addTrigger(11700, 'Ironjaw blocks the gate. Defeat him to claim the isle.');
  }

  update(dt) {
    this.time += dt;
    for (const platform of this.movingPlatforms) {
      const previousX = platform.x;
      const previousY = platform.y;
      const offset = Math.sin(this.time * platform.speed + platform.phase) * platform.range;
      if (platform.axis === 'x') {
        platform.x = platform.baseX + offset;
        platform.y = platform.baseY;
      } else {
        platform.x = platform.baseX;
        platform.y = platform.baseY + offset;
      }
      platform.dx = platform.x - previousX;
      platform.dy = platform.y - previousY;
    }
  }

  getCollisionSolids() {
    return this.collisionSolids;
  }

  getSectionAt(x) {
    for (let i = this.sections.length - 1; i >= 0; i--) {
      if (x >= this.sections[i].x) return this.sections[i];
    }
    return this.sections[0];
  }

  getSectionIndexAt(x) {
    for (let i = this.sections.length - 1; i >= 0; i--) {
      if (x >= this.sections[i].x) return i;
    }
    return 0;
  }

  openGate() {
    if (this.gate) this.gate.active = false;
  }

  isGateOpen() {
    return !this.gate || !this.gate.active;
  }

  resetCheckpoints() {
    for (const checkpoint of this.checkpoints) checkpoint.active = false;
  }
}

export function createLevel() {
  collectibleId = 0;
  return new Level();
}
