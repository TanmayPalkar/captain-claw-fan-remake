export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

export const damp = (a, b, speed, dt) => lerp(a, b, 1 - Math.exp(-speed * dt));

export const approach = (value, target, amount) => {
  if (value < target) return Math.min(value + amount, target);
  if (value > target) return Math.max(value - amount, target);
  return target;
};

export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

export const smoothstep = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

export const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const pointInRect = (x, y, r) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const circleRectOverlap = (cx, cy, radius, r) => {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= radius * radius;
};

export const rectDistance = (a, b) => {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  return Math.hypot(dx, dy);
};

// Fast deterministic hash for procedural pixel details.
export const hash2 = (x, y, seed = 0) => {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1442695041;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
};

export const hashString = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const randRange = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(randRange(min, max + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const formatScore = (score) => String(Math.max(0, Math.floor(score))).padStart(6, '0');

export const formatTime = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const formatLoot = (value) => String(value).padStart(2, '0');

export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;

export const angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);

export const dist2 = (x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
};

export const rgba = (hex, alpha) => {
  const value = hex.replace('#', '');
  const bigint = parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const shade = (hex, amount) => {
  const value = hex.replace('#', '');
  const bigint = parseInt(value, 16);
  const r = clamp(((bigint >> 16) & 255) + amount, 0, 255);
  const g = clamp(((bigint >> 8) & 255) + amount, 0, 255);
  const b = clamp((bigint & 255) + amount, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
};
