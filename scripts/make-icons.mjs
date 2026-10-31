import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.resolve('public/icons');
fs.mkdirSync(OUT, { recursive: true });

/* ---------- tiny PNG encoder ---------- */
function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- geometry helpers ---------- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy));
  const dx = px - (ax + t * vx);
  const dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}
function roundRectDist(px, py, half, radius, cx, cy) {
  const qx = Math.abs(px - cx) - (half - radius);
  const qy = Math.abs(py - cy) - (half - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/* ---------- icon renderer ---------- */
function render(size, { maskable = false, rounded = true } = {}) {
  const SS = 3; // supersample
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const ring = size * 0.275;
  const ringW = size * 0.032;
  const hexR = size * 0.158;
  const hexW = size * 0.019;

  const blades = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    blades.push([c + Math.cos(a) * hexR, c + Math.sin(a) * hexR]);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;

          // background shape
          let bgAlpha = 1;
          if (rounded && !maskable) {
            const d = roundRectDist(px, py, size / 2, size * 0.225, c, c);
            bgAlpha = clamp(0.5 - d);
          }
          if (bgAlpha <= 0) continue;

          // diagonal blue gradient
          const t = clamp((px / size) * 0.55 + (py / size) * 0.45);
          let cr = 59 + (29 - 59) * t;
          let cg = 130 + (78 - 130) * t;
          let cb = 246 + (216 - 246) * t;

          // soft radial highlight
          const hd = Math.hypot(px - size * 0.3, py - size * 0.22) / (size * 0.75);
          const hi = clamp(1 - hd) ** 2 * 0.22;
          cr += (255 - cr) * hi;
          cg += (255 - cg) * hi;
          cb += (255 - cb) * hi;

          // lens ring
          const rd = Math.abs(Math.hypot(px - c, py - c) - ring) - ringW / 2;
          const ringA = clamp(0.5 - rd * (SS / 1.5)) * 0.95;

          // inner iris
          let iris = 0;
          for (let i = 0; i < 6; i++) {
            const p1 = blades[i];
            const p2 = blades[(i + 1) % 6];
            const d = segDist(px, py, p1[0], p1[1], p2[0], p2[1]) - hexW / 2;
            iris = Math.max(iris, clamp(0.5 - d * (SS / 1.5)));
          }
          const centerD = Math.hypot(px - c, py - c) - size * 0.032;
          const centerA = clamp(0.5 - centerD * (SS / 1.5));

          const white = Math.max(ringA * 0.92, iris * 0.85, centerA);
          cr += (255 - cr) * white;
          cg += (255 - cg) * white;
          cb += (255 - cb) * white;

          r += cr;
          g += cg;
          b += cb;
          a += bgAlpha * 255;
        }
      }
      const n = SS * SS;
      const idx = (y * size + x) * 4;
      const alpha = a / n;
      buf[idx] = Math.round(r / n);
      buf[idx + 1] = Math.round(g / n);
      buf[idx + 2] = Math.round(b / n);
      buf[idx + 3] = Math.round(alpha);
    }
  }
  return encodePNG(size, size, buf);
}

const jobs = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }],
  ['favicon-64.png', 64, { rounded: false, maskable: true }]
];

for (const [name, size, opts] of jobs) {
  fs.writeFileSync(path.join(OUT, name), render(size, opts));
  console.log('wrote', name);
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#g)"/>
  <circle cx="32" cy="32" r="15.5" fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="2.1"/>
  <path d="M32 22.2 40.5 27v9.6L32 41.4 23.5 36.6V27z" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.7" stroke-linejoin="round"/>
  <circle cx="32" cy="32" r="2" fill="#fff"/>
</svg>`;
fs.writeFileSync(path.join(OUT, 'favicon.svg'), favicon);
console.log('wrote favicon.svg');
