import { THEME_COLORS, SECTIONS, VIEW_W, VIEW_H } from './config.js';
import { clamp, smoothstep, hash2, lerp } from './utils.js';

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const n = parseInt(value, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixColor(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgb(${Math.round(lerp(ca.r, cb.r, t))}, ${Math.round(lerp(ca.g, cb.g, t))}, ${Math.round(lerp(ca.b, cb.b, t))})`;
}

export class Background {
  constructor() {
    this.time = 0;
  }

  getWeights(worldX) {
    let index = 0;
    for (let i = SECTIONS.length - 1; i >= 0; i--) {
      if (worldX >= SECTIONS[i].x) {
        index = i;
        break;
      }
    }
    const weights = [0, 0, 0, 0];
    weights[index] = 1;
    const fade = 560;
    const section = SECTIONS[index];
    if (index > 0 && worldX < section.x + fade) {
      const t = smoothstep((worldX - section.x) / fade);
      weights[index] = t;
      weights[index - 1] = 1 - t;
    } else if (index < SECTIONS.length - 1 && worldX > section.end - fade) {
      const t = smoothstep((worldX - (section.end - fade)) / fade);
      weights[index] = 1 - t;
      weights[index + 1] = t;
    }
    return weights;
  }

  draw(ctx, camera, time) {
    this.time = time;
    const centerX = camera.x + VIEW_W * 0.5;
    const weights = this.getWeights(centerX);
    const camX = camera.x;

    this.drawSky(ctx, weights);
    this.drawSun(ctx, weights, camX, time);
    this.drawClouds(ctx, weights, camX, time);

    if (weights[0] > 0.01) this.drawCoast(ctx, camX, time, weights[0]);
    if (weights[1] > 0.01) this.drawOutpost(ctx, camX, time, weights[1]);
    if (weights[2] > 0.01) this.drawJungle(ctx, camX, time, weights[2]);
    if (weights[3] > 0.01) this.drawFortress(ctx, camX, time, weights[3]);

    this.drawDistantBirds(ctx, weights, camX, time);
  }

  drawSky(ctx, weights) {
    let top = '#000';
    let mid = '#000';
    let bottom = '#000';
    let haze = '#000';
    let total = 0;
    const themes = ['coast', 'outpost', 'jungle', 'fortress'];
    for (let i = 0; i < 4; i++) {
      const w = weights[i];
      if (w <= 0.001) continue;
      const c = THEME_COLORS[themes[i]];
      if (total === 0) {
        top = c.skyTop;
        mid = c.skyMid;
        bottom = c.skyBottom;
        haze = c.haze;
      } else {
        top = mixColor(top, c.skyTop, w / (total + w));
        mid = mixColor(mid, c.skyMid, w / (total + w));
        bottom = mixColor(bottom, c.skyBottom, w / (total + w));
        haze = mixColor(haze, c.haze, w / (total + w));
      }
      total += w;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    gradient.addColorStop(0, top);
    gradient.addColorStop(0.48, mid);
    gradient.addColorStop(0.78, bottom);
    gradient.addColorStop(1, mixColor(bottom, '#101b1b', 0.5));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Haze band at the horizon.
    const hazeGradient = ctx.createLinearGradient(0, 300, 0, 520);
    hazeGradient.addColorStop(0, 'rgba(255, 218, 154, 0)');
    hazeGradient.addColorStop(0.5, haze);
    hazeGradient.addColorStop(1, 'rgba(255, 218, 154, 0)');
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = hazeGradient;
    ctx.fillRect(0, 300, VIEW_W, 220);
    ctx.restore();
  }

  drawSun(ctx, weights, camX, time) {
    const fortress = weights[3];
    const jungle = weights[2];
    const x = 1010 - camX * 0.012;
    const y = 122;
    ctx.save();
    const radius = 39;
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 105);
    if (fortress > 0.5) {
      glow.addColorStop(0, 'rgba(238, 218, 187, 0.95)');
      glow.addColorStop(0.16, 'rgba(224, 193, 156, 0.48)');
      glow.addColorStop(1, 'rgba(218, 171, 129, 0)');
    } else if (jungle > 0.5) {
      glow.addColorStop(0, 'rgba(252, 237, 173, 0.9)');
      glow.addColorStop(0.18, 'rgba(245, 205, 121, 0.42)');
      glow.addColorStop(1, 'rgba(232, 178, 84, 0)');
    } else {
      glow.addColorStop(0, 'rgba(255, 242, 188, 0.95)');
      glow.addColorStop(0.17, 'rgba(255, 207, 122, 0.5)');
      glow.addColorStop(1, 'rgba(255, 174, 76, 0)');
    }
    ctx.fillStyle = glow;
    ctx.fillRect(x - 110, y - 110, 220, 220);
    ctx.fillStyle = fortress > 0.5 ? '#eadfca' : '#fff1b9';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (fortress > 0.5) {
      ctx.fillStyle = 'rgba(137, 132, 124, 0.32)';
      ctx.beginPath();
      ctx.arc(x - 9, y - 8, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 12, y + 7, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawClouds(ctx, weights, camX, time) {
    const tint =
      weights[3] > 0.5
        ? 'rgba(77, 66, 80, 0.52)'
        : weights[2] > 0.5
          ? 'rgba(203, 219, 181, 0.4)'
          : 'rgba(245, 232, 201, 0.55)';
    const highlight =
      weights[3] > 0.5
        ? 'rgba(141, 112, 122, 0.22)'
        : 'rgba(255, 248, 223, 0.3)';
    const parallax = camX * 0.08;
    const cloudData = [
      { x: 120, y: 92, s: 1.2 },
      { x: 520, y: 150, s: 0.8 },
      { x: 870, y: 74, s: 1.35 },
      { x: 1240, y: 128, s: 0.7 },
      { x: 1650, y: 94, s: 1.05 },
      { x: 2080, y: 150, s: 0.9 },
    ];
    ctx.save();
    ctx.globalAlpha = 0.72;
    for (const cloud of cloudData) {
      const span = 2300;
      let sx = ((cloud.x - parallax + time * 4.2) % span + span) % span - 160;
      if (sx > VIEW_W + 220) sx -= span;
      this.drawPixelCloud(ctx, sx, cloud.y, cloud.s, tint, highlight);
    }
    ctx.restore();
  }

  drawPixelCloud(ctx, x, y, scale, color, highlight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.fillRect(-50, 8, 100, 13);
    ctx.fillRect(-36, -2, 32, 14);
    ctx.fillRect(-12, -12, 34, 24);
    ctx.fillRect(18, -4, 27, 15);
    ctx.fillRect(-63, 12, 30, 9);
    ctx.fillRect(37, 11, 31, 10);
    ctx.fillStyle = highlight;
    ctx.fillRect(-34, -1, 25, 4);
    ctx.fillRect(-8, -10, 24, 4);
    ctx.fillRect(20, -2, 18, 3);
    ctx.restore();
  }

  drawCoast(ctx, camX, time, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Sea
    const sea = ctx.createLinearGradient(0, 382, 0, VIEW_H);
    sea.addColorStop(0, '#4f918d');
    sea.addColorStop(0.2, '#2a6f75');
    sea.addColorStop(1, '#0e343f');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 382, VIEW_W, VIEW_H - 382);

    // Horizon shimmer
    ctx.fillStyle = 'rgba(237, 218, 163, 0.22)';
    ctx.fillRect(0, 381, VIEW_W, 2);
    for (let i = 0; i < 12; i++) {
      const wx = ((i * 173 - camX * 0.15) % 1500 + 1500) % 1500 - 100;
      const wy = 405 + (i % 4) * 26 + Math.sin(time * 0.7 + i) * 3;
      ctx.fillStyle = 'rgba(223, 247, 231, 0.18)';
      ctx.fillRect(wx, wy, 26 + (i % 3) * 14, 1);
    }

    // Distant islands
    this.drawIsland(ctx, 260 - camX * 0.18, 420, 1.1, '#3b6e68');
    this.drawIsland(ctx, 760 - camX * 0.2, 416, 0.75, '#35635f');
    this.drawIsland(ctx, 1180 - camX * 0.16, 424, 1.35, '#2e5b58');
    this.drawIsland(ctx, 1720 - camX * 0.2, 419, 0.9, '#376a64');

    // Pirate ship silhouette
    const shipX = 760 - camX * 0.25;
    if (shipX > -260 && shipX < VIEW_W + 260) this.drawPirateShip(ctx, shipX, 407, 0.72, time);

    // Mid cliffs
    ctx.fillStyle = '#285c58';
    ctx.beginPath();
    ctx.moveTo(-100, 520);
    ctx.lineTo(60, 442);
    ctx.lineTo(150, 470);
    ctx.lineTo(220, 431);
    ctx.lineTo(330, 478);
    ctx.lineTo(430, 445);
    ctx.lineTo(510, 510);
    ctx.lineTo(560, 720);
    ctx.lineTo(-100, 720);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1f4c49';
    ctx.beginPath();
    ctx.moveTo(900 - camX * 0.12, 720);
    ctx.lineTo(980 - camX * 0.12, 480);
    ctx.lineTo(1080 - camX * 0.12, 510);
    ctx.lineTo(1160 - camX * 0.12, 456);
    ctx.lineTo(1260 - camX * 0.12, 500);
    ctx.lineTo(1370 - camX * 0.12, 720);
    ctx.closePath();
    ctx.fill();

    // Small sailing boat
    const boatX = 1270 - camX * 0.33;
    if (boatX > -100 && boatX < VIEW_W + 100) {
      ctx.save();
      ctx.translate(boatX, 450 + Math.sin(time * 1.4) * 2);
      ctx.fillStyle = '#263e3c';
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.lineTo(14, 7);
      ctx.lineTo(-14, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d5ccb0';
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(0, -35);
      ctx.lineTo(18, -7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  drawOutpost(ctx, camX, time, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const sea = ctx.createLinearGradient(0, 390, 0, VIEW_H);
    sea.addColorStop(0, '#456e6b');
    sea.addColorStop(0.25, '#234f54');
    sea.addColorStop(1, '#0c2a32');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 390, VIEW_W, VIEW_H - 390);

    this.drawIsland(ctx, 120 - camX * 0.17, 430, 0.85, '#365b55');
    this.drawIsland(ctx, 980 - camX * 0.19, 424, 1.2, '#2d524f');

    // Distant fort on cliff
    const fortX = 940 - camX * 0.22;
    ctx.fillStyle = '#263b3b';
    ctx.beginPath();
    ctx.moveTo(fortX - 180, 445);
    ctx.lineTo(fortX - 120, 382);
    ctx.lineTo(fortX + 80, 382);
    ctx.lineTo(fortX + 190, 440);
    ctx.lineTo(fortX + 220, 720);
    ctx.lineTo(fortX - 220, 720);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d3031';
    ctx.fillRect(fortX - 75, 315, 48, 74);
    ctx.fillRect(fortX + 14, 300, 62, 90);
    ctx.fillStyle = '#334b48';
    ctx.fillRect(fortX - 70, 310, 38, 8);
    ctx.fillRect(fortX + 18, 295, 52, 8);
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(fortX - 70 + i * 12, 299, 7, 12);
      ctx.fillRect(fortX + 20 + i * 14, 284, 8, 12);
    }
    ctx.fillStyle = '#d8944f';
    ctx.fillRect(fortX - 55, 340, 7, 10);
    ctx.fillRect(fortX + 40, 329, 8, 11);
    ctx.fillRect(fortX + 66, 349, 5, 8);

    // Big docked galleon
    const shipX = 280 - camX * 0.31;
    if (shipX > -320 && shipX < VIEW_W + 320) this.drawPirateShip(ctx, shipX, 438, 1.28, time, true);

    // Foreground dock silhouette
    ctx.fillStyle = '#1a2b2c';
    ctx.fillRect(0, 536, VIEW_W, 10);
    for (let i = 0; i < 14; i++) {
      ctx.fillRect(20 + i * 108 - (camX * 0.06) % 108, 536, 12, 90);
    }
    ctx.fillStyle = '#2b4240';
    ctx.fillRect(0, 532, VIEW_W, 5);

    // Flags on poles
    for (let i = 0; i < 3; i++) {
      const fx = 240 + i * 380 - camX * 0.12;
      if (fx < -40 || fx > VIEW_W + 40) continue;
      ctx.fillStyle = '#202f2f';
      ctx.fillRect(fx, 430, 3, 105);
      ctx.fillStyle = i === 1 ? '#8d2b24' : '#c89e48';
      const wave = Math.sin(time * 3 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(fx + 3, 435);
      ctx.lineTo(fx + 35 + wave, 443);
      ctx.lineTo(fx + 31 + wave, 458);
      ctx.lineTo(fx + 3, 451);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  drawJungle(ctx, camX, time, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Misty mountains
    ctx.fillStyle = 'rgba(68, 104, 83, 0.55)';
    ctx.beginPath();
    ctx.moveTo(-100, 470);
    ctx.lineTo(120, 300);
    ctx.lineTo(260, 390);
    ctx.lineTo(420, 280);
    ctx.lineTo(600, 420);
    ctx.lineTo(790, 320);
    ctx.lineTo(980, 410);
    ctx.lineTo(1160, 310);
    ctx.lineTo(1380, 470);
    ctx.lineTo(1380, 720);
    ctx.lineTo(-100, 720);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(52, 88, 70, 0.7)';
    ctx.beginPath();
    ctx.moveTo(-100, 520);
    ctx.lineTo(170, 390);
    ctx.lineTo(330, 480);
    ctx.lineTo(550, 360);
    ctx.lineTo(760, 500);
    ctx.lineTo(1010, 390);
    ctx.lineTo(1210, 470);
    ctx.lineTo(1380, 430);
    ctx.lineTo(1380, 720);
    ctx.lineTo(-100, 720);
    ctx.closePath();
    ctx.fill();

    // Distant waterfall
    const wfX = 1030 - camX * 0.14;
    ctx.fillStyle = 'rgba(179, 223, 203, 0.34)';
    ctx.fillRect(wfX - 16, 355, 32, 240);
    for (let i = 0; i < 8; i++) {
      const offset = (time * 70 + i * 31) % 210;
      ctx.fillStyle = 'rgba(226, 248, 235, 0.26)';
      ctx.fillRect(wfX - 12 + (i % 3) * 9, 360 + offset, 2, 19);
    }

    // Mid jungle canopy
    this.drawJungleSilhouette(ctx, camX, 500, 0.18, '#28523e', 0.7, time);
    this.drawJungleSilhouette(ctx, camX, 560, 0.28, '#1c4333', 1, time);

    // Hanging canopy from top
    ctx.fillStyle = '#17352c';
    for (let i = 0; i < 9; i++) {
      const cx = ((i * 210 - camX * 0.12) % 1900 + 1900) % 1900 - 200;
      ctx.beginPath();
      ctx.arc(cx, -35 + (i % 3) * 20, 90 + (i % 4) * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1f4535';
    for (let i = 0; i < 7; i++) {
      const cx = ((i * 280 - camX * 0.18 + 100) % 1800 + 1800) % 1800 - 150;
      ctx.beginPath();
      ctx.arc(cx, -5 + (i % 2) * 28, 65 + (i % 3) * 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vines
    for (let i = 0; i < 10; i++) {
      const vx = ((i * 167 - camX * 0.22) % 1600 + 1600) % 1600 - 80;
      const len = 70 + (i % 4) * 55;
      ctx.strokeStyle = i % 2 ? 'rgba(53, 92, 57, 0.75)' : 'rgba(43, 78, 51, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vx, 0);
      ctx.quadraticCurveTo(vx + Math.sin(time * 0.9 + i) * 12, len * 0.5, vx + 6, len);
      ctx.stroke();
    }

    // Fireflies
    for (let i = 0; i < 14; i++) {
      const fx = ((i * 131 + Math.sin(time * 0.4 + i) * 40 - camX * 0.35) % 1400 + 1400) % 1400 - 60;
      const fy = 350 + ((i * 53 + Math.cos(time * 0.6 + i) * 20) % 230);
      const glow = 0.25 + Math.sin(time * 3 + i) * 0.2;
      ctx.fillStyle = `rgba(231, 239, 126, ${glow})`;
      ctx.fillRect(fx, fy, 2, 2);
    }

    ctx.restore();
  }

  drawJungleSilhouette(ctx, camX, baseY, parallax, color, alpha, time) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    const offset = (camX * parallax) % 260;
    for (let i = -1; i < 7; i++) {
      const x = i * 260 - offset;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - 50, baseY + 160);
      ctx.lineTo(x + 15, baseY - 50);
      ctx.lineTo(x + 40, baseY + 40);
      ctx.lineTo(x + 70, baseY - 20);
      ctx.lineTo(x + 120, baseY + 90);
      ctx.lineTo(x + 170, baseY - 80);
      ctx.lineTo(x + 235, baseY + 130);
      ctx.lineTo(x + 310, baseY + 160);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 55, baseY - 20, 55, 0, Math.PI * 2);
      ctx.arc(x + 120, baseY - 40, 44, 0, Math.PI * 2);
      ctx.arc(x + 180, baseY - 10, 61, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFortress(ctx, camX, time, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Stormy distant cliffs
    ctx.fillStyle = 'rgba(48, 43, 55, 0.8)';
    ctx.beginPath();
    ctx.moveTo(-100, 540);
    ctx.lineTo(90, 320);
    ctx.lineTo(170, 380);
    ctx.lineTo(270, 250);
    ctx.lineTo(370, 420);
    ctx.lineTo(510, 300);
    ctx.lineTo(660, 430);
    ctx.lineTo(820, 270);
    ctx.lineTo(970, 400);
    ctx.lineTo(1120, 300);
    ctx.lineTo(1270, 430);
    ctx.lineTo(1380, 350);
    ctx.lineTo(1380, 720);
    ctx.lineTo(-100, 720);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(30, 28, 39, 0.88)';
    ctx.beginPath();
    ctx.moveTo(-100, 600);
    ctx.lineTo(80, 470);
    ctx.lineTo(210, 540);
    ctx.lineTo(360, 410);
    ctx.lineTo(520, 560);
    ctx.lineTo(700, 430);
    ctx.lineTo(860, 580);
    ctx.lineTo(1040, 460);
    ctx.lineTo(1220, 560);
    ctx.lineTo(1380, 500);
    ctx.lineTo(1380, 720);
    ctx.lineTo(-100, 720);
    ctx.closePath();
    ctx.fill();

    // Main fortress silhouette
    const fx = 800 - camX * 0.2;
    ctx.fillStyle = '#24212b';
    ctx.fillRect(fx - 250, 300, 500, 360);
    ctx.fillStyle = '#302c37';
    ctx.fillRect(fx - 220, 330, 440, 330);
    ctx.fillStyle = '#1c1a22';
    for (let i = 0; i < 8; i++) ctx.fillRect(fx - 240 + i * 62, 280, 36, 40);
    ctx.fillStyle = '#18161d';
    ctx.fillRect(fx - 80, 220, 70, 110);
    ctx.fillRect(fx + 70, 250, 50, 80);
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(fx - 78 + i * 20, 205, 12, 22);
      ctx.fillRect(fx + 72 + i * 14, 238, 9, 18);
    }
    ctx.fillStyle = '#e08442';
    ctx.fillRect(fx - 48, 270, 10, 16);
    ctx.fillRect(fx + 90, 286, 8, 13);
    ctx.fillRect(fx - 160, 370, 9, 14);
    ctx.fillRect(fx + 150, 390, 9, 14);
    ctx.fillStyle = 'rgba(231, 110, 55, 0.12)';
    ctx.fillRect(fx - 56, 262, 28, 34);
    ctx.fillRect(fx + 84, 279, 24, 28);

    // Chained watchtower
    ctx.fillStyle = '#1a1820';
    ctx.fillRect(190 - camX * 0.15, 380, 55, 210);
    ctx.fillRect(178 - camX * 0.15, 365, 78, 20);
    for (let i = 0; i < 4; i++) ctx.fillRect(180 - camX * 0.15 + i * 18, 350, 10, 16);

    // Glowing forge
    const forgeX = 390 - camX * 0.18;
    const forgeGlow = ctx.createRadialGradient(forgeX, 520, 2, forgeX, 520, 100);
    forgeGlow.addColorStop(0, 'rgba(255, 116, 42, 0.3)');
    forgeGlow.addColorStop(1, 'rgba(255, 75, 22, 0)');
    ctx.fillStyle = forgeGlow;
    ctx.fillRect(forgeX - 100, 420, 200, 200);

    // Lightning
    const flash = Math.sin(time * 0.55) > 0.985 ? 0.22 : 0;
    if (flash > 0) {
      ctx.fillStyle = `rgba(206, 218, 241, ${flash})`;
      ctx.fillRect(0, 0, VIEW_W, 430);
    }

    ctx.restore();
  }

  drawDistantBirds(ctx, weights, camX, time) {
    if (weights[0] + weights[1] < 0.3) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(23, 41, 40, 0.65)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const bx = ((i * 247 + 190 - camX * 0.14 + time * 7) % 1500 + 1500) % 1500 - 100;
      const by = 190 + (i % 3) * 31 + Math.sin(time * 0.8 + i) * 4;
      const flap = Math.sin(time * 5 + i * 1.4) * 3;
      ctx.beginPath();
      ctx.moveTo(bx - 5, by - flap);
      ctx.lineTo(bx, by + 1);
      ctx.lineTo(bx + 5, by - flap);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawIsland(ctx, x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-95, 16);
    ctx.lineTo(-64, -4);
    ctx.lineTo(-42, 2);
    ctx.lineTo(-20, -24);
    ctx.lineTo(7, -12);
    ctx.lineTo(28, -28);
    ctx.lineTo(53, 2);
    ctx.lineTo(84, 10);
    ctx.lineTo(102, 20);
    ctx.lineTo(70, 26);
    ctx.lineTo(-70, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(17, 46, 47, 0.35)';
    ctx.fillRect(-72, 17, 140, 5);
    // Palm silhouette
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, -20);
    ctx.lineTo(-16, -47);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-16, -47);
      ctx.lineTo(-16 + Math.cos(i * 1.2) * 18, -47 + Math.sin(i * 1.2) * 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPirateShip(ctx, x, y, scale, time, detailed = false) {
    ctx.save();
    ctx.translate(x, y + Math.sin(time * 1.3 + x * 0.01) * 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = detailed ? '#1b2c2c' : '#223c3c';
    // Hull
    ctx.beginPath();
    ctx.moveTo(-92, 0);
    ctx.lineTo(92, 0);
    ctx.lineTo(70, 26);
    ctx.lineTo(-64, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = detailed ? '#2c4240' : '#2c4d4a';
    ctx.beginPath();
    ctx.moveTo(-82, 3);
    ctx.lineTo(80, 3);
    ctx.lineTo(63, 18);
    ctx.lineTo(-56, 18);
    ctx.closePath();
    ctx.fill();
    // Masts
    ctx.fillStyle = '#1b2626';
    ctx.fillRect(-30, -108, 4, 110);
    ctx.fillRect(28, -92, 4, 94);
    ctx.fillRect(-3, -126, 3, 128);
    // Sails
    ctx.fillStyle = detailed ? 'rgba(203, 192, 159, 0.8)' : 'rgba(200, 194, 164, 0.72)';
    ctx.beginPath();
    ctx.moveTo(-27, -100);
    ctx.quadraticCurveTo(-8, -76, -26, -50);
    ctx.lineTo(-58, -47);
    ctx.quadraticCurveTo(-45, -77, -27, -100);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(31, -84);
    ctx.quadraticCurveTo(48, -62, 31, -40);
    ctx.lineTo(7, -37);
    ctx.quadraticCurveTo(20, -63, 31, -84);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -120);
    ctx.quadraticCurveTo(20, -92, 0, -64);
    ctx.lineTo(-23, -64);
    ctx.quadraticCurveTo(-11, -94, 0, -120);
    ctx.fill();
    // Flag
    ctx.fillStyle = '#7b2924';
    ctx.beginPath();
    ctx.moveTo(0, -126);
    ctx.lineTo(24, -119);
    ctx.lineTo(0, -111);
    ctx.closePath();
    ctx.fill();
    // Hull detail
    ctx.fillStyle = '#0d1e1f';
    for (let i = 0; i < 4; i++) ctx.fillRect(-56 + i * 30, 10, 15, 5);
    // Cannon ports
    ctx.fillStyle = '#0d1e1f';
    for (let i = 0; i < 4; i++) ctx.fillRect(-52 + i * 27, 19, 8, 5);
    ctx.restore();
  }

  drawAtmosphere(ctx, camera, time) {
    const centerX = camera.x + VIEW_W * 0.5;
    const weights = this.getWeights(centerX);

    // Jungle god rays
    if (weights[2] > 0.02) {
      ctx.save();
      ctx.globalAlpha = weights[2] * 0.09;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = 160 + i * 290 - camera.x * 0.03;
        ctx.fillStyle = i % 2 ? 'rgba(221, 236, 168, 0.4)' : 'rgba(201, 228, 149, 0.3)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 95, 0);
        ctx.lineTo(x + 270, VIEW_H);
        ctx.lineTo(x + 120, VIEW_H);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Fortress rain and embers
    if (weights[3] > 0.02) {
      ctx.save();
      ctx.globalAlpha = weights[3] * 0.18;
      ctx.strokeStyle = '#9aa5b4';
      ctx.lineWidth = 1;
      for (let i = 0; i < 50; i++) {
        const x = ((i * 137 + time * 120) % 1500) - 100;
        const y = ((i * 83 + time * 520) % 760) - 20;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y + 18);
        ctx.stroke();
      }
      ctx.globalAlpha = weights[3] * 0.45;
      ctx.fillStyle = '#ff8a43';
      for (let i = 0; i < 12; i++) {
        const x = ((i * 211 + Math.sin(time + i) * 30) % 1400) - 60;
        const y = ((i * 97 - time * 18) % 700 + 700) % 700;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
    }

    // Vignette and subtle scanlines
    const vignette = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.47, 280, VIEW_W * 0.5, VIEW_H * 0.5, 760);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.72, 'rgba(4, 10, 10, 0.12)');
    vignette.addColorStop(1, 'rgba(2, 6, 6, 0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = '#000';
    for (let y = 0; y < VIEW_H; y += 4) ctx.fillRect(0, y, VIEW_W, 1);
    ctx.restore();

    // Theme color grade
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    if (weights[2] > 0.5) {
      ctx.fillStyle = 'rgba(70, 118, 72, 0.16)';
    } else if (weights[3] > 0.5) {
      ctx.fillStyle = 'rgba(119, 66, 56, 0.2)';
    } else {
      ctx.fillStyle = 'rgba(235, 175, 92, 0.08)';
    }
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }
}
