import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDeflate } from 'node:zlib';
import { promisify } from 'node:util';

const deflate = promisify(createDeflate);

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcData = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

async function makePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (1 + width * 4) + 1 + x * 4;
      raw[di] = rgba[si];
      raw[di + 1] = rgba[si + 1];
      raw[di + 2] = rgba[si + 2];
      raw[di + 3] = rgba[si + 3];
    }
  }

  const def = createDeflate({ level: 9 });
  const chunks = [];
  def.on('data', d => chunks.push(d));
  def.end(raw);
  await new Promise(r => def.on('end', r));
  const compressed = Buffer.concat(chunks);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function solidColor(w, h, r, g, b, a = 255) {
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = r;
    px[i * 4 + 1] = g;
    px[i * 4 + 2] = b;
    px[i * 4 + 3] = a;
  }
  return px;
}

function drawRect(rgba, w, h, rx, ry, rw, rh, r, g, b, a = 255) {
  for (let y = ry; y < ry + rh && y < h; y++) {
    for (let x = rx; x < rx + rw && x < w; x++) {
      const i = (y * w + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
}

async function main() {
  const base = join(import.meta.dirname, '..', 'test', 'fixtures', 'phaser-atlas-contract');

  // === Single Atlas ===
  // 64x64 page, 2 asymmetric frames
  const sW = 64, sH = 64;
  const single = solidColor(sW, sH, 0, 0, 0, 0);
  drawRect(single, sW, sH, 0, 0, 32, 32, 220, 40, 40);
  drawRect(single, sW, sH, 32, 0, 24, 40, 40, 80, 220);

  const singlePng = await makePNG(sW, sH, single);
  writeFileSync(join(base, 'single', 'page.png'), singlePng);

  // JSON Hash format for single atlas
  const singleAtlas = {
    frames: {
      'idle/0000': {
        frame: { x: 0, y: 0, w: 32, h: 32 },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
        sourceSize: { w: 32, h: 32 },
      },
      'idle/0001': {
        frame: { x: 32, y: 0, w: 24, h: 40 },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: 24, h: 40 },
        sourceSize: { w: 24, h: 40 },
      },
    },
    meta: {
      app: 'Kukla2D',
      version: '1',
      image: 'page.png',
      format: 'RGBA8888',
      scale: '1',
    },
  };
  writeFileSync(join(base, 'single', 'atlas.json'), JSON.stringify(singleAtlas, null, 2));

  const singleAnims = {
    anims: [
      {
        key: 'test-char:idle',
        type: 'frame',
        frames: [
          { key: 'test-char', frame: 'idle/0000', duration: 0 },
          { key: 'test-char', frame: 'idle/0001', duration: 0 },
        ],
        frameRate: 10,
        skipMissedFrames: true,
        delay: 0,
        repeat: -1,
        repeatDelay: 0,
        yoyo: false,
      },
    ],
    globalTimeScale: 1,
  };
  writeFileSync(join(base, 'single', 'animations.json'), JSON.stringify(singleAnims, null, 2));

  // === Multi Atlas ===
  // 2 pages, 3 frames across pages
  const mW = 64, mH = 64;

  const page0 = solidColor(mW, mH, 0, 0, 0, 0);
  drawRect(page0, mW, mH, 0, 0, 32, 32, 220, 40, 40);
  drawRect(page0, mW, mH, 32, 0, 28, 36, 40, 200, 40);
  const page0Png = await makePNG(mW, mH, page0);
  writeFileSync(join(base, 'multi', 'page-0.png'), page0Png);

  const page1 = solidColor(mW, mH, 0, 0, 0, 0);
  drawRect(page1, mW, mH, 0, 0, 24, 40, 40, 80, 220);
  const page1Png = await makePNG(mW, mH, page1);
  writeFileSync(join(base, 'multi', 'page-1.png'), page1Png);

  // Multiatlas format: textures array with per-page frames using filename
  const multiAtlas = {
    textures: [
      {
        image: 'page-0.png',
        frames: [
          {
            filename: 'walk/0000',
            frame: { x: 0, y: 0, w: 32, h: 32 },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
            sourceSize: { w: 32, h: 32 },
          },
          {
            filename: 'walk/0001',
            frame: { x: 32, y: 0, w: 28, h: 36 },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: 28, h: 36 },
            sourceSize: { w: 28, h: 36 },
          },
        ],
      },
      {
        image: 'page-1.png',
        frames: [
          {
            filename: 'walk/0002',
            frame: { x: 0, y: 0, w: 24, h: 40 },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: 24, h: 40 },
            sourceSize: { w: 24, h: 40 },
          },
        ],
      },
    ],
    meta: {
      app: 'Kukla2D',
      version: '1',
      format: 'RGBA8888',
      scale: '1',
    },
  };
  writeFileSync(join(base, 'multi', 'atlas.json'), JSON.stringify(multiAtlas, null, 2));

  const multiAnims = {
    anims: [
      {
        key: 'test-char:walk',
        type: 'frame',
        frames: [
          { key: 'test-char-m', frame: 'walk/0000', duration: 0 },
          { key: 'test-char-m', frame: 'walk/0001', duration: 0 },
          { key: 'test-char-m', frame: 'walk/0002', duration: 0 },
        ],
        frameRate: 8,
        skipMissedFrames: true,
        delay: 0,
        repeat: -1,
        repeatDelay: 0,
        yoyo: false,
      },
    ],
    globalTimeScale: 1,
  };
  writeFileSync(join(base, 'multi', 'animations.json'), JSON.stringify(multiAnims, null, 2));

  console.log('Fixtures generated:');
  console.log(`  single/page.png (${singlePng.length} bytes)`);
  console.log('  single/atlas.json (Hash format)');
  console.log('  single/animations.json');
  console.log(`  multi/page-0.png (${page0Png.length} bytes)`);
  console.log(`  multi/page-1.png (${page1Png.length} bytes)`);
  console.log('  multi/atlas.json (textures array format)');
  console.log('  multi/animations.json');
}

main().catch(e => { console.error(e); process.exit(1); });
