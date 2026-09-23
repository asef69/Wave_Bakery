const fs = require("fs");
const zlib = require("zlib");

function makePng(width, height, pixelFn) {
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rawData = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1);
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * bytesPerPixel;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      for (let j = 0; j < 8; j++) {
        if ((crc ^ byte) & 1) {
          crc = (crc >>> 1) ^ 0xedb88320;
        } else {
          crc = crc >>> 1;
        }
        byte >>>= 1;
      }
    }
    return (crc ^ -1) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const payload = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(payload), 0);
    return Buffer.concat([len, payload, crcBuf]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(rawData);

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idat),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const dirEntries = [];
  const imageDatas = [];

  for (const item of pngBuffers) {
    const png = item.png;
    const size = item.size;
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);

    dirEntries.push(entry);
    imageDatas.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageDatas]);
}

function waveBakeryPixel(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  const cx = 0.5;
  const cy = 0.5;

  const dx = Math.abs(nx - cx);
  const dy = Math.abs(ny - cy);
  const r = Math.pow(Math.pow(dx * 2.2, 4) + Math.pow(dy * 2.2, 4), 0.25);
  if (r > 1.05) return [0, 0, 0, 0];

  if (r > 0.92) return [255, 158, 44, 255];

  let bg = [38, 20, 14, 255];

  const hatX = Math.abs(nx - 0.5);
  if (ny >= 0.22 && ny <= 0.62 && hatX <= 0.36) {
    const hatDist = Math.hypot((nx - 0.5) * 1.3, ny - 0.42);
    if (hatDist < 0.28 || (ny > 0.35 && hatX < 0.3)) {
      bg = [255, 248, 240, 255];
    }
  }

  if (ny >= 0.62 && ny <= 0.72 && hatX <= 0.26) {
    bg = [255, 152, 0, 255];
  }

  const waveY = 0.55 - 0.24 * Math.sin((nx - 0.1) * Math.PI * 2.2);
  const distToWave = Math.abs(ny - waveY);

  if (distToWave < 0.09) {
    const t = nx;
    const wr = 255;
    const wg = Math.round(80 + t * 140);
    const wb = 30;
    if (distToWave < 0.04) {
      return [255, 255, 255, 255];
    }
    return [wr, wg, wb, 255];
  }

  return bg;
}

if (!fs.existsSync("public")) {
  fs.mkdirSync("public");
}

const png32 = makePng(32, 32, waveBakeryPixel);
const png64 = makePng(64, 64, waveBakeryPixel);

fs.writeFileSync("public/favicon.png", png64);
fs.writeFileSync("public/apple-touch-icon.png", png64);

const ico = makeIco([
  { png: png32, size: 32 },
  { png: png64, size: 64 },
]);
fs.writeFileSync("public/favicon.ico", ico);

console.log("WaveBakery favicon assets generated successfully!");
