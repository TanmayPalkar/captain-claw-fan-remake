import { hash2, rgba, clamp } from './utils.js';

const CULL_PAD = 220;

export class WorldRenderer {
  constructor() {
    this.time = 0;
  }

  draw(ctx, camera, level, time, player) {
    const left = camera.renderX - CULL_PAD;
    const right = camera.renderX + 1280 + CULL_PAD;

    this.drawWater(ctx, camera, level, time, left, right);
    this.drawDecorLayer(ctx, camera, level, time, 'back', left, right);
    this.drawTerrain(ctx, camera, level, time, left, right);
    this.drawHazards(ctx, camera, level, time, left, right);
    this.drawDecorLayer(ctx, camera, level, time, 'front', left, right);
    this.drawMovingPlatforms(ctx, camera, level, time, left, right);
    this.drawCheckpoints(ctx, camera, level, time, left, right);
    this.drawGate(ctx, camera, level, time);
    this.drawTorchGlow(ctx, camera, level, time, left, right);
  }

  drawWater(ctx, camera, level, time, left, right) {
    for (const zone of level.waterZones) {
      if (zone.x + zone.w < left || zone.x > right) continue;
      const dark = zone.type === 'darkPit';
      const surface = zone.y;
      const gradient = ctx.createLinearGradient(0, surface - 10, 0, 720);
      if (dark) {
        gradient.addColorStop(0, 'rgba(25, 53, 45, 0.72)');
        gradient.addColorStop(0.35, 'rgba(8, 25, 22, 0.94)');
        gradient.addColorStop(1, '#050d0b');
      } else {
        gradient.addColorStop(0, 'rgba(54, 140, 143, 0.74)');
        gradient.addColorStop(0.32, 'rgba(19, 82, 91, 0.9)');
        gradient.addColorStop(1, '#07252d');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(zone.x, surface - 12, zone.w, 720 - surface + 12);

      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath();
        ctx.strokeStyle = dark
          ? `rgba(100, 178, 139, ${0.12 - layer * 0.025})`
          : `rgba(154, 238, 226, ${0.2 - layer * 0.045})`;
        ctx.lineWidth = 2;
        const offset = layer * 11;
        for (let x = zone.x - 20; x < zone.x + zone.w + 20; x += 16) {
          const y =
            surface +
            offset +
            Math.sin(x * 0.035 + time * (1.4 + layer * 0.2) + layer) * 2.5 +
            Math.sin(x * 0.011 - time * 0.7) * 1.5;
          if (x === zone.x - 20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      if (!dark) {
        for (let i = 0; i < 6; i++) {
          const x = zone.x + ((hash2(i, zone.x, 41) * zone.w + time * 9) % zone.w);
          const y = surface + 18 + hash2(i, zone.x, 42) * 36;
          ctx.globalAlpha = 0.22 + Math.sin(time * 2 + i) * 0.1;
          ctx.fillStyle = '#d9fbf4';
          ctx.fillRect(x, y, 10 + hash2(i, 1, 2) * 18, 1.5);
        }
        ctx.globalAlpha = 1;
      }

      // Foam at the edges of gaps.
      ctx.fillStyle = dark ? 'rgba(88, 137, 108, 0.35)' : 'rgba(210, 246, 236, 0.6)';
      ctx.fillRect(zone.x, surface - 2, 12, 3);
      ctx.fillRect(zone.x + zone.w - 12, surface - 2, 12, 3);
    }
  }

  drawTerrain(ctx, camera, level, time, left, right) {
    for (const solid of level.solids) {
      if (!solid.active || solid.kind === 'gate') continue;
      if (solid.x + solid.w < left || solid.x > right) continue;
      this.drawSolid(ctx, solid, time);
    }
  }

  drawSolid(ctx, solid, time) {
    const { x, y, w, h, kind } = solid;
    const isPlatform = h <= 34;
    let base = '#6b645a';
    let top = '#8d8578';
    let dark = '#403b34';
    let accent = '#a89c83';

    if (kind === 'sand') {
      base = '#b08d58';
      top = '#d8b879';
      dark = '#765a35';
      accent = '#e3c88d';
    } else if (kind === 'grass') {
      base = '#4f613a';
      top = '#7d9448';
      dark = '#2f3d28';
      accent = '#a1b45a';
    } else if (kind === 'wood') {
      base = '#6d421f';
      top = '#9d6531';
      dark = '#3a2110';
      accent = '#c18748';
    } else if (kind === 'dock') {
      base = '#56361b';
      top = '#8b582b';
      dark = '#2b190b';
      accent = '#b4773b';
    } else if (kind === 'stone') {
      base = '#65615e';
      top = '#8b8680';
      dark = '#3b3938';
      accent = '#aaa39a';
    } else if (kind === 'ruin') {
      base = '#5c6350';
      top = '#8b8e6b';
      dark = '#333a2d';
      accent = '#a7a980';
    } else if (kind === 'rock') {
      base = '#746b5b';
      top = '#9d9179';
      dark = '#464137';
      accent = '#b4a58a';
    } else if (kind === 'movingWood') {
      base = '#5b391e';
      top = '#9a6737';
      dark = '#2c190c';
      accent = '#d19a58';
    } else if (kind === 'movingRuin') {
      base = '#4f5848';
      top = '#80866a';
      dark = '#29302a';
      accent = '#b1b07c';
    } else if (kind === 'movingStone') {
      base = '#555352';
      top = '#7c7874';
      dark = '#2e2d2c';
      accent = '#9e978d';
    }

    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);

    // Top surface
    ctx.fillStyle = top;
    ctx.fillRect(x, y, w, isPlatform ? 7 : 9);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, w, 2);

    // Bottom shade
    ctx.fillStyle = dark;
    ctx.fillRect(x, y + h - (isPlatform ? 6 : 12), w, isPlatform ? 6 : 12);
    ctx.fillStyle = 'rgba(5, 9, 8, 0.16)';
    ctx.fillRect(x, y + h - 4, w, 4);

    if (kind === 'sand') {
      this.drawSandTexture(ctx, solid);
      this.drawGrassFringe(ctx, solid, time, '#c7b16d', '#8a733e');
    } else if (kind === 'grass') {
      this.drawDirtTexture(ctx, solid);
      this.drawGrassFringe(ctx, solid, time, '#8fa94e', '#5d7b38');
      this.drawVines(ctx, solid, time);
    } else if (kind === 'wood' || kind === 'dock' || kind === 'movingWood') {
      this.drawPlankTexture(ctx, solid, kind);
    } else if (kind === 'stone' || kind === 'movingStone') {
      this.drawStoneTexture(ctx, solid, kind === 'movingStone');
    } else if (kind === 'ruin' || kind === 'movingRuin') {
      this.drawRuinTexture(ctx, solid);
    } else if (kind === 'rock') {
      this.drawRockTexture(ctx, solid);
    }

    // Outline / edge highlight
    ctx.strokeStyle = 'rgba(12, 9, 7, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  drawSandTexture(ctx, solid) {
    const { x, y, w, h } = solid;
    const count = Math.max(6, Math.floor(w / 52));
    for (let i = 0; i < count; i++) {
      const rx = x + hash2(i, solid.seed, 1) * w;
      const ry = y + 14 + hash2(i, solid.seed, 2) * Math.max(8, h - 20);
      const size = 2 + Math.floor(hash2(i, solid.seed, 3) * 4);
      ctx.fillStyle = hash2(i, solid.seed, 4) > 0.5 ? 'rgba(91, 66, 36, 0.3)' : 'rgba(235, 210, 153, 0.35)';
      ctx.fillRect(rx, ry, size, 2);
    }
    for (let i = 0; i < Math.max(2, Math.floor(w / 230)); i++) {
      const rx = x + 30 + hash2(i, solid.seed, 8) * (w - 60);
      ctx.strokeStyle = 'rgba(239, 219, 170, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rx, y + 18 + hash2(i, solid.seed, 9) * 20, 4, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }

  drawDirtTexture(ctx, solid) {
    const { x, y, w, h } = solid;
    for (let i = 0; i < Math.floor(w / 35); i++) {
      const rx = x + hash2(i, solid.seed, 11) * w;
      const ry = y + 15 + hash2(i, solid.seed, 12) * Math.max(10, h - 20);
      ctx.fillStyle = hash2(i, solid.seed, 13) > 0.5 ? 'rgba(31, 45, 25, 0.28)' : 'rgba(120, 132, 72, 0.2)';
      ctx.fillRect(rx, ry, 3 + hash2(i, solid.seed, 14) * 8, 2);
    }
  }

  drawGrassFringe(ctx, solid, time, color, dark) {
    const { x, y, w } = solid;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const step = 11;
    for (let gx = x + 4; gx < x + w - 3; gx += step) {
      const h = 3 + hash2(gx, solid.seed, 21) * 8;
      const sway = Math.sin(time * 2 + gx * 0.12) * 1.5;
      ctx.beginPath();
      ctx.moveTo(gx, y + 1);
      ctx.quadraticCurveTo(gx + sway, y - h * 0.6, gx + sway * 1.5, y - h);
      ctx.stroke();
    }
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    for (let gx = x + 9; gx < x + w - 5; gx += 23) {
      const h = 2 + hash2(gx, solid.seed, 22) * 5;
      ctx.beginPath();
      ctx.moveTo(gx, y + 2);
      ctx.lineTo(gx + 2, y - h);
      ctx.stroke();
    }
  }

  drawVines(ctx, solid, time) {
    const { x, y, w, h } = solid;
    if (h < 60) return;
    for (let i = 0; i < Math.max(1, Math.floor(w / 190)); i++) {
      const vx = x + 30 + hash2(i, solid.seed, 31) * (w - 60);
      const len = 22 + hash2(i, solid.seed, 32) * Math.min(60, h * 0.4);
      ctx.strokeStyle = 'rgba(83, 117, 57, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vx, y + 8);
      ctx.quadraticCurveTo(vx + Math.sin(time + i) * 5, y + len * 0.55, vx - 3, y + len);
      ctx.stroke();
      ctx.fillStyle = '#6f9447';
      ctx.fillRect(vx - 5, y + len * 0.45, 4, 2);
      ctx.fillRect(vx + 2, y + len * 0.7, 4, 2);
    }
  }

  drawPlankTexture(ctx, solid, kind) {
    const { x, y, w, h } = solid;
    const plank = kind === 'dock' ? 34 : 29;
    ctx.strokeStyle = 'rgba(42, 22, 9, 0.65)';
    ctx.lineWidth = 1;
    for (let px = x + plank; px < x + w; px += plank) {
      ctx.beginPath();
      ctx.moveTo(px, y + 7);
      ctx.lineTo(px, y + h - 5);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(224, 166, 91, 0.24)';
    for (let px = x + 5; px < x + w; px += plank) {
      ctx.beginPath();
      ctx.moveTo(px, y + 11);
      ctx.lineTo(px + plank * 0.45, y + 11);
      ctx.stroke();
    }
    for (let i = 0; i < Math.floor(w / 70); i++) {
      const nx = x + 15 + hash2(i, solid.seed, 51) * (w - 30);
      const ny = y + 13 + hash2(i, solid.seed, 52) * Math.max(4, h - 22);
      ctx.fillStyle = '#2c1a0c';
      ctx.fillRect(nx, ny, 2, 2);
      ctx.fillStyle = 'rgba(231, 190, 122, 0.5)';
      ctx.fillRect(nx, ny - 1, 1, 1);
    }
    if (kind === 'dock' && h > 40) {
      ctx.fillStyle = 'rgba(29, 15, 6, 0.5)';
      for (let px = x + 55; px < x + w; px += 120) {
        ctx.fillRect(px, y + 12, 12, h - 16);
        ctx.fillStyle = 'rgba(126, 81, 38, 0.28)';
        ctx.fillRect(px + 3, y + 16, 3, h - 26);
        ctx.fillStyle = 'rgba(29, 15, 6, 0.5)';
      }
    }
  }

  drawStoneTexture(ctx, solid, moving) {
    const { x, y, w, h } = solid;
    ctx.strokeStyle = 'rgba(38, 36, 35, 0.55)';
    ctx.lineWidth = 1;
    const rowH = 22;
    for (let row = 0; row < Math.ceil(h / rowH); row++) {
      const ry = y + 9 + row * rowH;
      ctx.beginPath();
      ctx.moveTo(x, ry);
      ctx.lineTo(x + w, ry);
      ctx.stroke();
      const offset = row % 2 === 0 ? 0 : 22;
      for (let bx = x + offset; bx < x + w; bx += 46) {
        ctx.beginPath();
        ctx.moveTo(bx, ry);
        ctx.lineTo(bx, Math.min(y + h, ry + rowH));
        ctx.stroke();
      }
    }
    for (let i = 0; i < Math.floor(w / 80); i++) {
      const mx = x + hash2(i, solid.seed, 61) * w;
      const my = y + 11 + hash2(i, solid.seed, 62) * Math.max(5, h - 24);
      ctx.fillStyle = 'rgba(87, 111, 65, 0.35)';
      ctx.fillRect(mx, my, 6 + hash2(i, solid.seed, 63) * 15, 2);
    }
    if (moving) {
      ctx.fillStyle = 'rgba(214, 168, 80, 0.5)';
      ctx.fillRect(x + 7, y + 4, w - 14, 1);
    }
  }

  drawRuinTexture(ctx, solid) {
    this.drawStoneTexture(ctx, solid, false);
    const { x, y, w, h } = solid;
    for (let i = 0; i < Math.max(1, Math.floor(w / 150)); i++) {
      const gx = x + 24 + hash2(i, solid.seed, 71) * (w - 48);
      const gy = y + 16 + hash2(i, solid.seed, 72) * Math.max(8, h - 30);
      ctx.strokeStyle = 'rgba(45, 63, 39, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 8, gy - 4);
      ctx.lineTo(gx + 8, gy + 7);
      ctx.lineTo(gx + 16, gy + 3);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(104, 139, 71, 0.4)';
    for (let i = 0; i < Math.max(1, Math.floor(w / 110)); i++) {
      const mx = x + hash2(i, solid.seed, 75) * w;
      ctx.fillRect(mx, y + 8, 10 + hash2(i, solid.seed, 76) * 20, 3);
    }
  }

  drawRockTexture(ctx, solid) {
    const { x, y, w, h } = solid;
    ctx.strokeStyle = 'rgba(38, 34, 29, 0.55)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < Math.max(2, Math.floor(w / 60)); i++) {
      const cx = x + 15 + hash2(i, solid.seed, 81) * (w - 30);
      const cy = y + 12 + hash2(i, solid.seed, 82) * Math.max(4, h - 20);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 7, cy + 5);
      ctx.lineTo(cx + 3, cy + 11);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(209, 194, 157, 0.22)';
    for (let i = 0; i < Math.max(2, Math.floor(w / 45)); i++) {
      const rx = x + hash2(i, solid.seed, 83) * w;
      const ry = y + 7 + hash2(i, solid.seed, 84) * 8;
      ctx.fillRect(rx, ry, 4, 2);
    }
  }

  drawHazards(ctx, camera, level, time, left, right) {
    for (const hazard of level.hazards) {
      if (hazard.x + hazard.w < left || hazard.x > right) continue;
      if (hazard.type === 'spikes') {
        const count = Math.max(1, Math.floor(hazard.w / 18));
        for (let i = 0; i < count; i++) {
          const sx = hazard.x + i * (hazard.w / count);
          const sw = hazard.w / count;
          ctx.fillStyle = '#2b2520';
          ctx.beginPath();
          ctx.moveTo(sx + 1, hazard.y + hazard.h);
          ctx.lineTo(sx + sw * 0.5, hazard.y - 6 - (i % 2) * 3);
          ctx.lineTo(sx + sw - 1, hazard.y + hazard.h);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#a7a18e';
          ctx.beginPath();
          ctx.moveTo(sx + 3, hazard.y + hazard.h - 2);
          ctx.lineTo(sx + sw * 0.5, hazard.y - 2 - (i % 2) * 3);
          ctx.lineTo(sx + sw * 0.48, hazard.y + hazard.h - 2);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#e0d9c2';
          ctx.beginPath();
          ctx.moveTo(sx + sw * 0.5, hazard.y - 2 - (i % 2) * 3);
          ctx.lineTo(sx + sw * 0.48, hazard.y + 5);
          ctx.lineTo(sx + sw * 0.38, hazard.y + 6);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(121, 43, 29, 0.5)';
        ctx.fillRect(hazard.x, hazard.y + hazard.h - 3, hazard.w, 3);
      }
    }
  }

  drawDecorLayer(ctx, camera, level, time, layer, left, right) {
    for (const decoration of level.decorations) {
      if (decoration.layer !== layer) continue;
      if (decoration.x < left || decoration.x > right) continue;
      this.drawDecoration(ctx, decoration, time);
    }
  }

  drawDecoration(ctx, d, time) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.scale(d.flip ? -d.scale : d.scale, d.scale);
    switch (d.type) {
      case 'palm':
      case 'palmBack':
        this.drawPalm(ctx, time, d);
        break;
      case 'jungleTree':
      case 'jungleTreeBack':
        this.drawJungleTree(ctx, time, d);
        break;
      case 'fern':
        this.drawFern(ctx, time, d);
        break;
      case 'rock':
        this.drawRock(ctx, d);
        break;
      case 'sign':
        this.drawSign(ctx, d);
        break;
      case 'barrel':
        this.drawBarrel(ctx, d);
        break;
      case 'crate':
        this.drawCrate(ctx, d);
        break;
      case 'skull':
        this.drawSkull(ctx, d);
        break;
      case 'torch':
        this.drawTorch(ctx, time, d);
        break;
      case 'banner':
        this.drawBanner(ctx, time, d);
        break;
      case 'shackBack':
        this.drawShack(ctx, d);
        break;
      case 'dockBack':
        this.drawDock(ctx, d);
        break;
      case 'waterfallBack':
        this.drawWaterfall(ctx, time, d);
        break;
      case 'fortressTowerBack':
        this.drawFortressTower(ctx, time, d);
        break;
      case 'ruinPillar':
        this.drawRuinPillar(ctx, d);
        break;
      case 'statue':
        this.drawStatue(ctx, d);
        break;
      case 'chestPile':
        this.drawChestPile(ctx, time, d);
        break;
      case 'brazier':
        this.drawBrazier(ctx, time, d);
        break;
      case 'chain':
        this.drawChain(ctx, time, d);
        break;
      default:
        break;
    }
    ctx.restore();
  }

  drawPalm(ctx, time, d) {
    const back = d.type === 'palmBack';
    ctx.globalAlpha = back ? 0.78 : 1;
    const sway = Math.sin(time * 1.1 + d.x * 0.02) * 3;
    ctx.strokeStyle = back ? '#5a442a' : '#6e4b25';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-5, -45, 5 + sway * 0.4, -88);
    ctx.stroke();
    ctx.strokeStyle = back ? '#80623a' : '#a06b32';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-4, -45, 5 + sway * 0.4, -88);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const angle = -2.9 + i * 0.52 + Math.sin(time * 1.4 + i) * 0.04;
      ctx.strokeStyle = i % 2 === 0 ? (back ? '#3e613d' : '#4f7c44') : (back ? '#315237' : '#3f6b3e');
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(5 + sway * 0.4, -88);
      ctx.quadraticCurveTo(
        5 + Math.cos(angle) * 32 + sway,
        -98 + Math.sin(angle) * 20,
        5 + Math.cos(angle) * 62 + sway * 1.5,
        -92 + Math.sin(angle) * 36
      );
      ctx.stroke();
      ctx.strokeStyle = 'rgba(134, 163, 84, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(5 + Math.cos(angle) * 18, -94 + Math.sin(angle) * 12);
      ctx.lineTo(5 + Math.cos(angle) * 38, -96 + Math.sin(angle) * 23);
      ctx.stroke();
    }
    ctx.fillStyle = '#6f5128';
    ctx.beginPath();
    ctx.arc(4 + sway * 0.4, -86, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawJungleTree(ctx, time, d) {
    const back = d.type === 'jungleTreeBack';
    ctx.globalAlpha = back ? 0.6 : 1;
    const sway = Math.sin(time * 0.8 + d.x * 0.01) * 2;
    ctx.strokeStyle = back ? '#2f3c2b' : '#493a25';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-8, -60, 3 + sway, -130);
    ctx.stroke();
    ctx.strokeStyle = back ? '#3d4d35' : '#655135';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-7, -60, 3 + sway, -130);
    ctx.stroke();
    ctx.fillStyle = back ? '#244432' : '#315f42';
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const cx = 3 + sway + Math.cos(angle) * (28 + (i % 3) * 10);
      const cy = -132 + Math.sin(angle) * 19;
      ctx.beginPath();
      ctx.arc(cx, cy, 18 + (i % 2) * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = back ? '#315a3e' : '#467c4c';
    for (let i = 0; i < 5; i++) {
      const cx = 3 + sway + Math.cos(i * 1.4) * 23;
      const cy = -137 + Math.sin(i * 1.4) * 16;
      ctx.beginPath();
      ctx.arc(cx, cy, 14 + (i % 2) * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Vines
    ctx.strokeStyle = back ? '#2c4a35' : '#426c45';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const vx = -18 + i * 17;
      ctx.beginPath();
      ctx.moveTo(vx, -118);
      ctx.quadraticCurveTo(vx + Math.sin(time + i) * 7, -80, vx + 3, -46 - i * 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawFern(ctx, time, d) {
    const sway = Math.sin(time * 1.7 + d.x * 0.05) * 2;
    ctx.strokeStyle = '#4e773f';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const angle = -2.6 + i * 0.43;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(
        Math.cos(angle) * 16 + sway,
        -18 + Math.sin(angle) * 8,
        Math.cos(angle) * 34 + sway * 1.4,
        -29 + Math.sin(angle) * 13
      );
      ctx.stroke();
      ctx.strokeStyle = i % 2 ? '#6b924c' : '#547d40';
      ctx.lineWidth = 2;
      for (let j = 1; j < 4; j++) {
        const t = j / 4;
        const fx = Math.cos(angle) * 32 * t + sway * t;
        const fy = -27 * t + Math.sin(angle) * 12 * t;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + 5, fy - 4);
        ctx.stroke();
      }
      ctx.strokeStyle = '#4e773f';
      ctx.lineWidth = 3;
    }
  }

  drawRock(ctx, d) {
    ctx.fillStyle = '#6d6557';
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(-18, -14);
    ctx.lineTo(-5, -23);
    ctx.lineTo(11, -20);
    ctx.lineTo(24, -8);
    ctx.lineTo(22, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#918674';
    ctx.beginPath();
    ctx.moveTo(-16, -4);
    ctx.lineTo(-10, -15);
    ctx.lineTo(1, -19);
    ctx.lineTo(11, -14);
    ctx.lineTo(7, -5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a443a';
    ctx.beginPath();
    ctx.moveTo(24, -8);
    ctx.lineTo(22, 0);
    ctx.lineTo(9, 0);
    ctx.lineTo(16, -8);
    ctx.closePath();
    ctx.fill();
  }

  drawSign(ctx, d) {
    ctx.fillStyle = '#4b2c16';
    ctx.fillRect(-2, -52, 5, 52);
    ctx.fillStyle = '#72431f';
    ctx.fillRect(-26, -62, 52, 25);
    ctx.fillStyle = '#a66a31';
    ctx.fillRect(-23, -59, 46, 19);
    ctx.fillStyle = '#5e3518';
    ctx.fillRect(-18, -53, 36, 2);
    ctx.fillRect(-18, -47, 24, 2);
    ctx.fillStyle = '#2f190a';
    ctx.fillRect(-4, -42, 8, 3);
    ctx.fillRect(-2, -39, 4, 6);
  }

  drawBarrel(ctx, d) {
    ctx.fillStyle = '#4c2b13';
    ctx.beginPath();
    ctx.ellipse(0, -2, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a4a22';
    ctx.fillRect(-14, -33, 28, 31);
    ctx.fillStyle = '#9b612e';
    ctx.fillRect(-11, -30, 22, 25);
    ctx.fillStyle = '#422511';
    ctx.fillRect(-14, -28, 28, 4);
    ctx.fillRect(-14, -12, 28, 4);
    ctx.fillStyle = '#b77b3e';
    ctx.fillRect(-11, -26, 3, 11);
    ctx.fillStyle = '#2f1a0a';
    ctx.beginPath();
    ctx.ellipse(0, -33, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b3f1c';
    ctx.beginPath();
    ctx.ellipse(0, -33, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCrate(ctx, d) {
    ctx.fillStyle = '#3a2110';
    ctx.fillRect(-18, -35, 36, 35);
    ctx.fillStyle = '#8b5728';
    ctx.fillRect(-16, -33, 32, 31);
    ctx.fillStyle = '#b27638';
    ctx.fillRect(-13, -30, 26, 2);
    ctx.fillRect(-13, -6, 26, 2);
    ctx.strokeStyle = '#5b3517';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, -30);
    ctx.lineTo(14, -5);
    ctx.moveTo(14, -30);
    ctx.lineTo(-14, -5);
    ctx.stroke();
    ctx.strokeStyle = '#3c2210';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-16.5, -33.5, 33, 32);
    ctx.fillStyle = '#2a170a';
    ctx.fillRect(-17, -3, 34, 3);
  }

  drawSkull(ctx, d) {
    ctx.fillStyle = '#d4c8a7';
    ctx.beginPath();
    ctx.ellipse(0, -9, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-7, -5, 14, 7);
    ctx.fillStyle = '#2a2118';
    ctx.fillRect(-6, -11, 4, 4);
    ctx.fillRect(2, -11, 4, 4);
    ctx.fillRect(-1, -5, 2, 3);
    ctx.fillStyle = '#9b8f73';
    ctx.fillRect(-8, 0, 16, 2);
    ctx.strokeStyle = '#6f5e43';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, -1);
    ctx.lineTo(15, -1);
    ctx.stroke();
  }

  drawTorch(ctx, time, d) {
    const flicker = 0.78 + Math.sin(time * 13 + d.x) * 0.12 + Math.sin(time * 21 + d.x * 0.4) * 0.08;
    ctx.fillStyle = '#4c2b16';
    ctx.fillRect(-3, -38, 6, 38);
    ctx.fillStyle = '#2d180b';
    ctx.fillRect(-5, -40, 10, 5);
    ctx.fillStyle = '#7a4a22';
    ctx.fillRect(-7, -42, 14, 4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, -48, 2, 0, -48, 65);
    glow.addColorStop(0, `rgba(255, 203, 92, ${0.42 * flicker})`);
    glow.addColorStop(0.4, `rgba(255, 119, 40, ${0.18 * flicker})`);
    glow.addColorStop(1, 'rgba(255, 92, 20, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-70, -115, 140, 140);
    ctx.restore();
    ctx.fillStyle = '#ff7a2e';
    ctx.beginPath();
    ctx.moveTo(-7, -42);
    ctx.quadraticCurveTo(-3, -60 - flicker * 7, 1, -52);
    ctx.quadraticCurveTo(5, -66 - flicker * 9, 8, -45);
    ctx.quadraticCurveTo(6, -39, 0, -38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd56e';
    ctx.beginPath();
    ctx.moveTo(-2, -43);
    ctx.quadraticCurveTo(0, -54 - flicker * 5, 4, -46);
    ctx.quadraticCurveTo(2, -41, -1, -41);
    ctx.closePath();
    ctx.fill();
  }

  drawBanner(ctx, time, d) {
    ctx.fillStyle = '#3c2413';
    ctx.fillRect(-2, -128, 4, 128);
    ctx.fillStyle = '#8f2b24';
    const sway = Math.sin(time * 1.8 + d.x * 0.02) * 2;
    ctx.beginPath();
    ctx.moveTo(0, -122);
    ctx.lineTo(31, -118);
    ctx.lineTo(29 + sway, -70);
    ctx.lineTo(15, -76);
    ctx.lineTo(3 + sway, -68);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c44a32';
    ctx.beginPath();
    ctx.moveTo(3, -119);
    ctx.lineTo(26, -116);
    ctx.lineTo(24 + sway, -76);
    ctx.lineTo(14, -81);
    ctx.lineTo(5 + sway, -75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e4bd61';
    ctx.fillRect(10, -104, 9, 2);
    ctx.fillRect(13, -109, 3, 12);
    ctx.beginPath();
    ctx.arc(14, -93, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b1715';
    ctx.fillRect(12, -94, 4, 4);
  }

  drawShack(ctx, d) {
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#3b2717';
    ctx.fillRect(-78, -104, 156, 104);
    ctx.fillStyle = '#5b3b21';
    ctx.fillRect(-70, -96, 140, 96);
    ctx.fillStyle = '#2c1b10';
    ctx.fillRect(-92, -115, 184, 18);
    ctx.beginPath();
    ctx.moveTo(-98, -111);
    ctx.lineTo(-70, -144);
    ctx.lineTo(73, -144);
    ctx.lineTo(101, -111);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a2d18';
    ctx.beginPath();
    ctx.moveTo(-86, -113);
    ctx.lineTo(-62, -137);
    ctx.lineTo(66, -137);
    ctx.lineTo(92, -113);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1a0f08';
    ctx.fillRect(-55, -74, 30, 34);
    ctx.fillRect(26, -74, 30, 34);
    ctx.fillStyle = '#c98b3c';
    ctx.fillRect(-50, -69, 20, 24);
    ctx.fillRect(31, -69, 20, 24);
    ctx.fillStyle = 'rgba(255, 203, 95, 0.28)';
    ctx.fillRect(-46, -65, 12, 16);
    ctx.fillRect(35, -65, 12, 16);
    ctx.fillStyle = '#24150b';
    ctx.fillRect(-12, -56, 24, 56);
    ctx.globalAlpha = 1;
  }

  drawDock(ctx, d) {
    ctx.globalAlpha = 0.68;
    ctx.fillStyle = '#2b1a0d';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(i * 54 - 6, -78, 12, 78);
      ctx.fillStyle = '#4a2c15';
      ctx.fillRect(i * 54 - 3, -74, 4, 72);
      ctx.fillStyle = '#2b1a0d';
    }
    ctx.fillStyle = '#3e2614';
    ctx.fillRect(-150, -82, 300, 12);
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(-150, -84, 300, 5);
    ctx.globalAlpha = 1;
  }

  drawWaterfall(ctx, time, d) {
    const x = 0;
    const width = 52;
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#173d3b';
    ctx.fillRect(x - width * 0.5, -330, width, 330);
    const gradient = ctx.createLinearGradient(0, -330, 0, 0);
    gradient.addColorStop(0, 'rgba(109, 178, 166, 0.25)');
    gradient.addColorStop(0.5, 'rgba(174, 226, 213, 0.5)');
    gradient.addColorStop(1, 'rgba(210, 248, 239, 0.72)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - width * 0.36, -326, width * 0.72, 326);
    for (let i = 0; i < 9; i++) {
      const offset = ((time * (80 + i * 9) + i * 37) % 320);
      const wx = x - width * 0.3 + (i % 3) * width * 0.3;
      ctx.fillStyle = 'rgba(230, 255, 249, 0.42)';
      ctx.fillRect(wx, -326 + offset, 2, 22 + (i % 4) * 9);
    }
    ctx.fillStyle = 'rgba(214, 252, 244, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, -4, 38 + Math.sin(time * 2) * 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawFortressTower(ctx, time, d) {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#26242d';
    ctx.fillRect(-56, -195, 112, 195);
    ctx.fillStyle = '#34313d';
    ctx.fillRect(-46, -185, 92, 185);
    ctx.fillStyle = '#191820';
    for (let i = 0; i < 5; i++) ctx.fillRect(-50 + i * 24, -208, 15, 20);
    ctx.fillStyle = '#17161d';
    ctx.fillRect(-68, -198, 136, 8);
    ctx.fillStyle = '#e18b45';
    ctx.fillRect(-20, -152, 12, 19);
    ctx.fillRect(18, -123, 10, 16);
    ctx.fillRect(-8, -91, 9, 14);
    ctx.fillStyle = 'rgba(239, 146, 65, 0.12)';
    ctx.fillRect(-25, -158, 22, 30);
    ctx.fillRect(13, -129, 20, 26);
    ctx.fillStyle = '#14131a';
    ctx.fillRect(-13, -54, 26, 54);
    ctx.globalAlpha = 1;
  }

  drawRuinPillar(ctx, d) {
    ctx.fillStyle = '#4c5143';
    ctx.fillRect(-16, -118, 32, 118);
    ctx.fillStyle = '#74775d';
    ctx.fillRect(-12, -112, 24, 100);
    ctx.fillStyle = '#929472';
    ctx.fillRect(-12, -112, 6, 100);
    ctx.fillStyle = '#3a3f34';
    for (let i = 0; i < 4; i++) ctx.fillRect(-15, -100 + i * 24, 30, 3);
    ctx.fillStyle = '#555b48';
    ctx.fillRect(-22, -128, 44, 12);
    ctx.fillStyle = '#7e8263';
    ctx.fillRect(-19, -125, 38, 5);
    // Broken top
    ctx.fillStyle = '#3f4538';
    ctx.beginPath();
    ctx.moveTo(-22, -128);
    ctx.lineTo(-14, -140);
    ctx.lineTo(-6, -126);
    ctx.lineTo(4, -136);
    ctx.lineTo(13, -124);
    ctx.lineTo(22, -130);
    ctx.lineTo(22, -128);
    ctx.closePath();
    ctx.fill();
  }

  drawStatue(ctx, d) {
    ctx.fillStyle = '#3e4639';
    ctx.fillRect(-24, -13, 48, 13);
    ctx.fillStyle = '#5e6650';
    ctx.fillRect(-20, -30, 40, 18);
    ctx.fillStyle = '#70785c';
    ctx.fillRect(-14, -74, 28, 45);
    ctx.fillStyle = '#89916d';
    ctx.beginPath();
    ctx.arc(0, -86, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, -90);
    ctx.lineTo(-15, -106);
    ctx.lineTo(-3, -97);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, -90);
    ctx.lineTo(15, -106);
    ctx.lineTo(3, -97);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#31382c';
    ctx.fillRect(-6, -89, 3, 3);
    ctx.fillRect(3, -89, 3, 3);
    ctx.fillStyle = '#596148';
    ctx.fillRect(-20, -66, 8, 34);
    ctx.fillRect(12, -66, 8, 34);
    ctx.fillStyle = 'rgba(89, 122, 65, 0.55)';
    ctx.fillRect(-15, -76, 8, 5);
    ctx.fillRect(4, -46, 11, 3);
  }

  drawChestPile(ctx, time, d) {
    ctx.fillStyle = '#5a3418';
    ctx.fillRect(-42, -24, 84, 24);
    ctx.fillStyle = '#8b5527';
    ctx.fillRect(-38, -22, 76, 20);
    ctx.fillStyle = '#d6a846';
    for (let i = 0; i < 16; i++) {
      const gx = -35 + (i * 37) % 70;
      const gy = -22 + (i * 13) % 15;
      ctx.fillRect(gx, gy, 4, 4);
    }
    ctx.fillStyle = '#b77c28';
    ctx.fillRect(-27, -44, 26, 22);
    ctx.fillStyle = '#d2a344';
    ctx.fillRect(-24, -41, 20, 3);
    ctx.fillStyle = '#6b3d1c';
    ctx.fillRect(-8, -44, 26, 22);
    ctx.fillStyle = '#f2d16e';
    ctx.fillRect(-4, -39, 18, 4);
    ctx.fillStyle = 'rgba(255, 217, 105, 0.12)';
    ctx.beginPath();
    ctx.arc(0, -22, 48 + Math.sin(time * 2) * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBrazier(ctx, time, d) {
    const flicker = 0.75 + Math.sin(time * 12 + d.x) * 0.16 + Math.sin(time * 19) * 0.08;
    ctx.fillStyle = '#4a2c16';
    ctx.fillRect(-4, -28, 8, 28);
    ctx.fillStyle = '#2b180b';
    ctx.beginPath();
    ctx.moveTo(-22, -31);
    ctx.lineTo(22, -31);
    ctx.lineTo(14, -16);
    ctx.lineTo(-14, -16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6b4524';
    ctx.fillRect(-20, -31, 40, 5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, -52, 3, 0, -52, 80);
    glow.addColorStop(0, `rgba(255, 195, 78, ${0.42 * flicker})`);
    glow.addColorStop(0.45, `rgba(255, 98, 32, ${0.16 * flicker})`);
    glow.addColorStop(1, 'rgba(255, 72, 12, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-85, -130, 170, 150);
    ctx.restore();
    ctx.fillStyle = '#ff6c28';
    ctx.beginPath();
    ctx.moveTo(-14, -31);
    ctx.quadraticCurveTo(-8, -58 - flicker * 10, 0, -46);
    ctx.quadraticCurveTo(8, -68 - flicker * 10, 14, -31);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd063';
    ctx.beginPath();
    ctx.moveTo(-7, -32);
    ctx.quadraticCurveTo(-2, -48 - flicker * 5, 3, -36);
    ctx.quadraticCurveTo(6, -30, -7, -32);
    ctx.fill();
  }

  drawChain(ctx, time, d) {
    ctx.strokeStyle = '#4d4c4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -170);
    ctx.lineTo(0, 0);
    ctx.stroke();
    ctx.strokeStyle = '#77746d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1, -170);
    ctx.lineTo(-1, 0);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = i % 2 ? '#5f5b54' : '#393835';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -160 + i * 13, 4, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawMovingPlatforms(ctx, camera, level, time, left, right) {
    for (const platform of level.movingPlatforms) {
      if (platform.x + platform.w < left || platform.x > right) continue;
      this.drawSolid(ctx, platform, time);
      // Chains / magical runes depending on theme.
      if (platform.kind === 'movingRuin') {
        ctx.save();
        ctx.strokeStyle = 'rgba(117, 223, 173, 0.55)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const gx = platform.x + 20 + i * 28;
          ctx.beginPath();
          ctx.moveTo(gx, platform.y + 8);
          ctx.lineTo(gx + 5, platform.y + 14);
          ctx.lineTo(gx + 10, platform.y + 8);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        ctx.strokeStyle = 'rgba(45, 31, 18, 0.75)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          const cx = platform.x + 16 + i * (platform.w - 32);
          ctx.beginPath();
          ctx.moveTo(cx, platform.y);
          ctx.lineTo(cx, platform.y - 18);
          ctx.stroke();
          ctx.fillStyle = 'rgba(198, 159, 85, 0.6)';
          ctx.fillRect(cx - 2, platform.y - 20, 4, 4);
        }
      }
      // Motion glints
      ctx.fillStyle = 'rgba(241, 217, 148, 0.35)';
      const glint = ((time * 45) % (platform.w + 40)) - 20;
      ctx.fillRect(platform.x + glint, platform.y + 2, 12, 1);
    }
  }

  drawCheckpoints(ctx, camera, level, time, left, right) {
    for (const checkpoint of level.checkpoints) {
      if (checkpoint.x < left || checkpoint.x > right) continue;
      const x = checkpoint.x;
      const y = checkpoint.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#3a2413';
      ctx.fillRect(-2, -102, 4, 102);
      ctx.fillStyle = '#8f6a34';
      ctx.fillRect(-1, -100, 2, 96);
      ctx.fillStyle = '#2b1a0d';
      ctx.fillRect(-12, -4, 24, 4);
      if (checkpoint.active) {
        const glow = 0.5 + Math.sin(time * 3) * 0.16;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gradient = ctx.createRadialGradient(0, -78, 2, 0, -78, 75);
        gradient.addColorStop(0, `rgba(255, 223, 118, ${0.3 * glow})`);
        gradient.addColorStop(1, 'rgba(255, 182, 44, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(-80, -160, 160, 160);
        ctx.restore();
      }
      ctx.fillStyle = checkpoint.active ? '#e1b84e' : '#655849';
      const wave = Math.sin(time * 4 + x) * 3;
      ctx.beginPath();
      ctx.moveTo(2, -98);
      ctx.lineTo(37 + wave, -89);
      ctx.lineTo(34 + wave, -68);
      ctx.lineTo(2, -72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = checkpoint.active ? '#8d2b21' : '#403b34';
      ctx.beginPath();
      ctx.moveTo(7, -94);
      ctx.lineTo(31 + wave, -87);
      ctx.lineTo(29 + wave, -74);
      ctx.lineTo(7, -77);
      ctx.closePath();
      ctx.fill();
      if (checkpoint.active) {
        ctx.fillStyle = '#fff0ac';
        ctx.beginPath();
        ctx.arc(17, -85, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawGate(ctx, camera, level, time) {
    const gate = level.gate;
    if (!gate) return;
    if (gate.x < camera.renderX - 200 || gate.x > camera.renderX + 1480) return;
    const { x, y, w, h } = gate;
    // Stone arch posts always remain.
    ctx.fillStyle = '#33313a';
    ctx.fillRect(x - 18, y - 20, 20, h + 20);
    ctx.fillRect(x + w - 2, y - 20, 20, h + 20);
    ctx.fillStyle = '#4f4d58';
    ctx.fillRect(x - 15, y - 18, 12, h + 16);
    ctx.fillRect(x + w + 3, y - 18, 12, h + 16);
    ctx.fillStyle = '#25242c';
    ctx.fillRect(x - 24, y - 28, w + 48, 15);
    ctx.fillStyle = '#5b5864';
    ctx.fillRect(x - 18, y - 25, w + 36, 5);

    if (gate.active) {
      ctx.fillStyle = '#1b1b20';
      ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 5; i++) {
        const bx = x + 5 + i * ((w - 10) / 4);
        ctx.fillStyle = '#3e3e46';
        ctx.fillRect(bx - 2, y, 4, h - 12);
        ctx.fillStyle = '#6f6d75';
        ctx.fillRect(bx - 1, y, 1, h - 12);
        ctx.fillStyle = '#222228';
        ctx.beginPath();
        ctx.moveTo(bx - 5, y + h - 12);
        ctx.lineTo(bx, y + h);
        ctx.lineTo(bx + 5, y + h - 12);
        ctx.closePath();
        ctx.fill();
      }
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#29292f';
        ctx.fillRect(x, y + 30 + i * 46, w, 5);
        ctx.fillStyle = '#55545d';
        ctx.fillRect(x, y + 30 + i * 46, w, 1);
      }
      ctx.fillStyle = 'rgba(220, 81, 47, 0.35)';
      ctx.fillRect(x - 4, y - 6, w + 8, 3);
    } else {
      // Retracted portcullis with chains.
      ctx.fillStyle = '#2c2b32';
      ctx.fillRect(x, y - 12, w, 18);
      for (let i = 0; i < 5; i++) {
        const bx = x + 6 + i * ((w - 12) / 4);
        ctx.fillStyle = '#55535d';
        ctx.fillRect(bx - 1, y - 12, 2, 30);
      }
      ctx.fillStyle = 'rgba(233, 192, 91, 0.24)';
      ctx.fillRect(x, y + 8, w, 2);
    }
  }

  drawTorchGlow(ctx, camera, level, time, left, right) {
    // Subtle ambient bounce from nearby torches, kept behind the actors.
    for (const d of level.decorations) {
      if ((d.type !== 'torch' && d.type !== 'brazier') || d.x < left || d.x > right) continue;
      const flicker = 0.75 + Math.sin(time * 11 + d.x) * 0.15;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.12 * flicker;
      const gradient = ctx.createRadialGradient(d.x, d.y - 50, 5, d.x, d.y - 50, 120);
      gradient.addColorStop(0, 'rgba(255, 172, 71, 0.45)');
      gradient.addColorStop(1, 'rgba(255, 98, 22, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(d.x - 120, d.y - 170, 240, 240);
      ctx.restore();
    }
  }
}
