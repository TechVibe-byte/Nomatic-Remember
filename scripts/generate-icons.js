import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal PNG generator using raw RGBA buffer and zlib
function createPNG(width, height, getPixel) {
  const rowLength = 1 + width * 4;
  const buffer = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    buffer[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      buffer[pxOffset] = r;
      buffer[pxOffset + 1] = g;
      buffer[pxOffset + 2] = b;
      buffer[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(buffer);

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA (6)
  ihdr[10] = 0; // Compression: Deflate
  ihdr[11] = 0; // Filter: Standard
  ihdr[12] = 0; // Interlace: None
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);

  const crc = crc32(typeAndData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeAndData, crcBuf]);
}

// Standard CRC32 table
let crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
}

function crc32(buf) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Google Note / Keep style glowing lightbulb drawer
function drawAppIcon(isMaskable) {
  return (x, y, w, h) => {
    // Normalize coordinates -1 to 1
    const nx = (x / w) * 2 - 1;
    const ny = (y / h) * 2 - 1;

    // Background: Dark Slate/Navy #0B0F19 -> #1E293B
    const cornerR = 0.38;
    const dx = Math.max(0, Math.abs(nx) - (1 - cornerR));
    const dy = Math.max(0, Math.abs(ny) - (1 - cornerR));
    const outsideRoundedRect = !isMaskable && (dx * dx + dy * dy > cornerR * cornerR);

    if (outsideRoundedRect) {
      return [0, 0, 0, 0]; // Transparent outside icon shape
    }

    // Gradient background
    const bgFactor = (ny + 1) * 0.5;
    let r = Math.round(14 + 14 * (1 - bgFactor));
    let g = Math.round(20 + 20 * (1 - bgFactor));
    let b = Math.round(36 + 25 * (1 - bgFactor));
    let a = 255;

    // Icon scale: if maskable, shrink icon by safe zone factor (0.75)
    const scale = isMaskable ? 0.70 : 0.85;
    const sx = nx / scale;
    const sy = ny / scale;

    // 1. Warm Ambient Halo Glow
    const haloDist = Math.sqrt(sx * sx + (sy - -0.1) * (sy - -0.1));
    if (haloDist < 0.65) {
      const glowAmount = (1 - haloDist / 0.65) * 0.28;
      r = Math.min(255, Math.round(r + 245 * glowAmount));
      g = Math.min(255, Math.round(g + 158 * glowAmount));
      b = Math.min(255, Math.round(b + 11 * glowAmount * 0.4));
    }

    // 2. Rays above the bulb (Google Keep radiance spark)
    // Vertical ray: sx ~ 0, sy between -0.72 and -0.60
    const inTopRay = Math.abs(sx) <= 0.035 && sy >= -0.72 && sy <= -0.58;
    // Left diagonal ray: from (-0.50, -0.45) to (-0.38, -0.35)
    const dLeftRay = distToSegment(sx, sy, -0.52, -0.48, -0.38, -0.36);
    // Right diagonal ray: from (0.50, -0.45) to (0.38, -0.35)
    const dRightRay = distToSegment(sx, sy, 0.52, -0.48, 0.38, -0.36);

    if (inTopRay || dLeftRay <= 0.035 || dRightRay <= 0.035) {
      return [253, 224, 71, 230]; // Soft sunny yellow spark
    }

    // 3. Bulb Dome and Neck geometry
    // Upper dome is a circle centered at cx=0, cy=-0.12 with radius 0.44
    const domeDist = Math.sqrt(sx * sx + (sy - -0.12) * (sy - -0.12));
    const inDome = domeDist <= 0.44 && sy <= 0.02;

    // Lower neck smoothly tapering down to width 0.26 at sy = 0.35
    const inNeck = sy > 0.02 && sy <= 0.35 && Math.abs(sx) <= 0.44 - (sy - 0.02) * 0.56;

    const inBulbGlass = inDome || inNeck;

    if (inBulbGlass) {
      // Golden Amber Gradient (#FEF08A at top -> #F59E0B -> #D97706 at base)
      const gradRatio = Math.max(0, Math.min(1, (sy - -0.56) / 0.91));
      let br = Math.round(254 - 38 * gradRatio);
      let bg = Math.round(240 - 82 * gradRatio);
      let bb = Math.round(138 - 132 * gradRatio);

      // Glass sheen highlight on left side
      const sheenDist = Math.sqrt((sx - -0.18) * (sx - -0.18) + (sy - -0.22) * (sy - -0.22));
      if (sheenDist < 0.18 && sx < -0.05) {
        const sheenIntensity = (1 - sheenDist / 0.18) * 0.5;
        br = Math.round(br * (1 - sheenIntensity) + 255 * sheenIntensity);
        bg = Math.round(bg * (1 - sheenIntensity) + 255 * sheenIntensity);
        bb = Math.round(bb * (1 - sheenIntensity) + 255 * sheenIntensity);
      }

      // 4. Filament Loop (Google Keep distinctive brown arch)
      // Filament arch top: cx=0, cy=-0.08, r=0.14
      const filDist = Math.sqrt(sx * sx + (sy - -0.06) * (sy - -0.06));
      const inFilArch = Math.abs(filDist - 0.13) <= 0.038 && sy <= -0.06;
      const inFilLegs = Math.abs(Math.abs(sx) - 0.13) <= 0.038 && sy > -0.06 && sy <= 0.22;
      const inFilBridge = Math.abs(sy - 0.08) <= 0.028 && Math.abs(sx) <= 0.13;

      if (inFilArch || inFilLegs || inFilBridge) {
        return [120, 53, 15, 240]; // Deep rich filament amber/brown #78350F
      }

      return [br, bg, bb, 255];
    }

    // 5. Metal Screw Base Threads
    // Thread 1: sy between 0.36 and 0.43, width 0.22
    const inThread1 = sy >= 0.36 && sy <= 0.43 && Math.abs(sx) <= 0.21;
    // Thread 2: sy between 0.45 and 0.52, width 0.18
    const inThread2 = sy >= 0.45 && sy <= 0.52 && Math.abs(sx) <= 0.18;

    if (inThread1 || inThread2) {
      return [148, 163, 184, 255]; // Slate metallic #94A3B8
    }

    // 6. Bottom Contact Tip
    const inContact = sy > 0.52 && sy <= 0.59 && Math.abs(sx) <= 0.10;
    if (inContact) {
      return [100, 116, 139, 255]; // Dark slate terminal #64748B
    }

    return [r, g, b, a];
  };
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. pwa-192x192.png
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, drawAppIcon(false)));
console.log('✓ Generated pwa-192x192.png (Bulb logo)');

// 2. pwa-512x512.png
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, drawAppIcon(false)));
console.log('✓ Generated pwa-512x512.png (Bulb logo)');

// 3. pwa-maskable-512x512.png (with safe-zone 15% padding)
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, drawAppIcon(true)));
console.log('✓ Generated pwa-maskable-512x512.png (Bulb logo)');

// 4. apple-touch-icon.png (180x180)
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, drawAppIcon(false)));
console.log('✓ Generated apple-touch-icon.png (Bulb logo)');

// 5. favicon.ico (32x32 PNG)
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPNG(32, 32, drawAppIcon(false)));
console.log('✓ Generated favicon.ico (Bulb logo)');
