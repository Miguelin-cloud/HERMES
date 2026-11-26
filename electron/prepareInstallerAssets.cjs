const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT_DIR = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT_DIR, 'build');
const HEADER_PATH = path.join(BUILD_DIR, 'installerHeader.bmp');
const SIDEBAR_PATH = path.join(BUILD_DIR, 'installerSidebar.bmp');
const LOGO_COHETEROS_PATH = path.join(ROOT_DIR, 'src', 'assets', 'coheteros_logo.png');
const ICON_HERMES_PATH = path.join(ROOT_DIR, 'public', 'icon.png');

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error(`Invalid PNG signature: ${filePath}`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buf.length) break;

    if (type === 'IHDR') {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
      interlace = buf[dataStart + 12];
    } else if (type === 'IDAT') {
      idatChunks.push(buf.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (bitDepth !== 8 || interlace !== 0) {
    throw new Error(`Unsupported PNG format (bitDepth=${bitDepth}, interlace=${interlace}) in ${filePath}`);
  }

  const channelsMap = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const channels = channelsMap[colorType];
  if (!channels) {
    throw new Error(`Unsupported PNG colorType=${colorType} in ${filePath}`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * 4);
  const prevRow = new Uint8Array(stride);
  const curRow = new Uint8Array(stride);

  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const val = raw[pos++];
      const a = x >= channels ? curRow[x - channels] : 0;
      const b = prevRow[x];
      const c = x >= channels ? prevRow[x - channels] : 0;
      let recon = val;
      if (filterType === 1) recon = (val + a) & 0xff;
      else if (filterType === 2) recon = (val + b) & 0xff;
      else if (filterType === 3) recon = (val + ((a + b) >> 1)) & 0xff;
      else if (filterType === 4) recon = (val + paethPredictor(a, b, c)) & 0xff;
      curRow[x] = recon;
    }

    for (let x = 0; x < width; x++) {
      const srcIdx = x * channels;
      const dstIdx = (y * width + x) * 4;
      if (channels === 4) {
        pixels[dstIdx] = curRow[srcIdx];
        pixels[dstIdx + 1] = curRow[srcIdx + 1];
        pixels[dstIdx + 2] = curRow[srcIdx + 2];
        pixels[dstIdx + 3] = curRow[srcIdx + 3];
      } else if (channels === 3) {
        pixels[dstIdx] = curRow[srcIdx];
        pixels[dstIdx + 1] = curRow[srcIdx + 1];
        pixels[dstIdx + 2] = curRow[srcIdx + 2];
        pixels[dstIdx + 3] = 255;
      } else if (channels === 2) {
        pixels[dstIdx] = curRow[srcIdx];
        pixels[dstIdx + 1] = curRow[srcIdx];
        pixels[dstIdx + 2] = curRow[srcIdx];
        pixels[dstIdx + 3] = curRow[srcIdx + 1];
      } else {
        pixels[dstIdx] = curRow[srcIdx];
        pixels[dstIdx + 1] = curRow[srcIdx];
        pixels[dstIdx + 2] = curRow[srcIdx];
        pixels[dstIdx + 3] = 255;
      }
    }
    prevRow.set(curRow);
  }

  return { width, height, pixels };
}

function createCanvas(width, height, fillFn) {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fillFn(x, y, width, height);
      const idx = (y * width + x) * 3;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
    }
  }
  return { width, height, data };
}

function blendPixel(canvas, x, y, r, g, b, alpha01) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height || alpha01 <= 0) return;
  const idx = (y * canvas.width + x) * 3;
  const inv = 1 - alpha01;
  canvas.data[idx] = Math.round(canvas.data[idx] * inv + r * alpha01);
  canvas.data[idx + 1] = Math.round(canvas.data[idx + 1] * inv + g * alpha01);
  canvas.data[idx + 2] = Math.round(canvas.data[idx + 2] * inv + b * alpha01);
}

function drawRoundedRect(canvas, rx, ry, rw, rh, radius, color, alpha01 = 1) {
  const x0 = Math.max(0, Math.floor(rx));
  const y0 = Math.max(0, Math.floor(ry));
  const x1 = Math.min(canvas.width - 1, Math.ceil(rx + rw));
  const y1 = Math.min(canvas.height - 1, Math.ceil(ry + rh));
  const [cr, cg, cb] = color;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const cx = Math.max(rx + radius, Math.min(x, rx + rw - radius));
      const cy = Math.max(ry + radius, Math.min(y, ry + rh - radius));
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= radius + 0.5) {
        const aa = Math.max(0, Math.min(1, radius + 0.5 - dist));
        blendPixel(canvas, x, y, cr, cg, cb, alpha01 * aa);
      }
    }
  }
}

function drawImageAreaResampled(canvas, img, dx, dy, dw, dh) {
  const scaleX = img.width / dw;
  const scaleY = img.height / dh;

  for (let ty = 0; ty < dh; ty++) {
    const sy0 = Math.floor(ty * scaleY);
    const sy1 = Math.min(img.height, Math.max(sy0 + 1, Math.ceil((ty + 1) * scaleY)));
    for (let tx = 0; tx < dw; tx++) {
      const sx0 = Math.floor(tx * scaleX);
      const sx1 = Math.min(img.width, Math.max(sx0 + 1, Math.ceil((tx + 1) * scaleX)));

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      let count = 0;

      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * img.width + sx) * 4;
          const a = img.pixels[i + 3] / 255;
          sumR += img.pixels[i] * a;
          sumG += img.pixels[i + 1] * a;
          sumB += img.pixels[i + 2] * a;
          sumA += a;
          count++;
        }
      }

      if (count > 0 && sumA > 0) {
        const avgA = sumA / count;
        const r = Math.min(255, Math.round(sumR / sumA));
        const g = Math.min(255, Math.round(sumG / sumA));
        const b = Math.min(255, Math.round(sumB / sumA));
        blendPixel(canvas, dx + tx, dy + ty, r, g, b, avgA);
      }
    }
  }
}

function writeBmp24(filePath, canvas) {
  const { width, height, data } = canvas;
  const rowBytes = width * 3;
  const paddedRowBytes = (rowBytes + 3) & ~3;
  const pixelDataSize = paddedRowBytes * height;
  const headerSize = 54;
  const fileSize = headerSize + pixelDataSize;
  const out = Buffer.alloc(fileSize);

  // BITMAPFILEHEADER (14 bytes)
  out.write('BM', 0, 'ascii');
  out.writeUInt32LE(fileSize, 2);
  out.writeUInt32LE(0, 6);
  out.writeUInt32LE(headerSize, 10);

  // BITMAPINFOHEADER (40 bytes) — Windows 3.x 24-bit uncompressed BMP
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(0, 30);
  out.writeUInt32LE(pixelDataSize, 34);
  out.writeInt32LE(2835, 38);
  out.writeInt32LE(2835, 42);
  out.writeUInt32LE(0, 46);
  out.writeUInt32LE(0, 50);

  // Bottom-up BGR rows
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y;
    const dstRowOffset = headerSize + y * paddedRowBytes;
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcRow * width + x) * 3;
      const dstIdx = dstRowOffset + x * 3;
      out[dstIdx] = data[srcIdx + 2];     // B
      out[dstIdx + 1] = data[srcIdx + 1]; // G
      out[dstIdx + 2] = data[srcIdx];     // R
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, out);
}

function buildHeaderBmp(hermesImg, coheterosImg) {
  const width = 150;
  const height = 57;
  const canvas = createCanvas(width, height, (x, y) => {
    if (y >= height - 2) return [15, 23, 42]; // Crisp bottom accent line
    if (y === height - 3) return [245, 158, 11]; // Thin aerospace amber rule
    return [255, 255, 255];
  });

  if (coheterosImg) {
    const targetH = 42;
    const targetW = Math.round((coheterosImg.width / coheterosImg.height) * targetH);
    const dx = width - targetW - 8;
    const dy = Math.round((height - 3 - targetH) / 2);
    drawImageAreaResampled(canvas, coheterosImg, dx, dy, targetW, targetH);
  }

  if (hermesImg) {
    const size = 38;
    const dx = 10;
    const dy = Math.round((height - 3 - size) / 2);
    drawImageAreaResampled(canvas, hermesImg, dx, dy, size, size);
    // Subtle vertical divider between HERMES icon and COHETEROS logo
    for (let y = 12; y < height - 14; y++) {
      blendPixel(canvas, 56, y, 203, 213, 225, 0.9);
    }
  }

  writeBmp24(HEADER_PATH, canvas);
}

function buildSidebarBmp(hermesImg, coheterosImg) {
  const width = 164;
  const height = 314;
  const canvas = createCanvas(width, height, (x, y) => {
    // 3px right accent border separating dark aerospace sidebar from wizard pane
    if (x === width - 1) return [226, 232, 240];
    if (x === width - 2) return [245, 158, 11];
    if (x === width - 3) return [217, 119, 6];

    const t = y / (height - 1);
    const r = Math.round(11 + 8 * Math.sin(t * Math.PI));
    const g = Math.round(18 + 14 * Math.sin(t * Math.PI));
    const b = Math.round(32 + 24 * Math.sin(t * Math.PI));
    return [r, g, b];
  });

  // Top subtle accent bar
  drawRoundedRect(canvas, 18, 18, width - 40, 3, 1, [245, 158, 11], 0.9);

  // HERMES app icon card in upper half
  if (hermesImg) {
    drawRoundedRect(canvas, 27, 36, 108, 108, 16, [255, 255, 255], 0.08);
    drawRoundedRect(canvas, 33, 42, 96, 96, 14, [15, 23, 42], 0.85);
    drawImageAreaResampled(canvas, hermesImg, 39, 48, 84, 84);
  }

  // Subtle horizontal divider
  for (let x = 28; x < width - 30; x++) {
    blendPixel(canvas, x, 170, 148, 163, 184, 0.3);
  }

  // COHETEROS official logo inside clean white badge in lower half
  if (coheterosImg) {
    const cardW = 132;
    const cardH = 86;
    const cardX = Math.round((width - 3 - cardW) / 2);
    const cardY = 192;
    drawRoundedRect(canvas, cardX, cardY, cardW, cardH, 10, [255, 255, 255], 0.98);

    const logoW = 114;
    const logoH = Math.round((coheterosImg.height / coheterosImg.width) * logoW);
    const lx = cardX + Math.round((cardW - logoW) / 2);
    const ly = cardY + Math.round((cardH - logoH) / 2);
    drawImageAreaResampled(canvas, coheterosImg, lx, ly, logoW, logoH);
  }

  // Bottom technical trim line
  drawRoundedRect(canvas, 18, height - 22, width - 40, 2, 1, [56, 189, 248], 0.55);

  writeBmp24(SIDEBAR_PATH, canvas);
}

function isValidBmp(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < 1024) return false;
    const fd = fs.openSync(filePath, 'r');
    const sig = Buffer.alloc(2);
    fs.readSync(fd, sig, 0, 2, 0);
    fs.closeSync(fd);
    return sig.toString('ascii') === 'BM';
  } catch {
    return false;
  }
}

function ensureInstallerAssets({ force = false } = {}) {
  const needsHeader = force || !isValidBmp(HEADER_PATH);
  const needsSidebar = force || !isValidBmp(SIDEBAR_PATH);
  if (!needsHeader && !needsSidebar) {
    return false;
  }

  const hermesImg = fs.existsSync(ICON_HERMES_PATH) ? decodePng(ICON_HERMES_PATH) : null;
  const coheterosImg = fs.existsSync(LOGO_COHETEROS_PATH) ? decodePng(LOGO_COHETEROS_PATH) : null;

  if (needsHeader) buildHeaderBmp(hermesImg, coheterosImg);
  if (needsSidebar) buildSidebarBmp(hermesImg, coheterosImg);
  return true;
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  const generated = ensureInstallerAssets({ force });
  console.log(
    generated
      ? '[HERMES] Generated NSIS installer BMP assets in build/'
      : '[HERMES] NSIS installer BMP assets already present.'
  );
}

module.exports = { ensureInstallerAssets };
