const crc32 = require("crc-32");


const MAGIC = Buffer.from([0x4D, 0x53, 0x49, 0x30]);
const VERSION = 0x0001;
const HEADER_LEN = 12; 

const COLORSPACE = {
  LINEAR: 0,   
  RGB:    1,   
  YCBCR:  2,   
  HSV:    3,  
};

const COMPRESSION = {
  NONE:         0,
  SHANNON_FANO: 1,
  HUFFMAN:      2, 
  DOWNSAMPLING_MPEG1: 3, 
  DOWNSAMPLING_MPEG2: 4, 
};


function rgbToYCbCr(pixels) {
  const out = Buffer.alloc(pixels.length);
  for (let i = 0; i < pixels.length; i += 3) {
    const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
    out[i]   = Math.round(0.299*r + 0.587*g + 0.114*b);          
    out[i+1] = Math.round(128 - 0.168736*r - 0.331264*g + 0.5*b); 
    out[i+2] = Math.round(128 + 0.5*r - 0.418688*g - 0.081312*b); 
  }
  return out;
}

function yCbCrToRgb(pixels) {
  const out = Buffer.alloc(pixels.length);
  for (let i = 0; i < pixels.length; i += 3) {
    const y = pixels[i], cb = pixels[i+1] - 128, cr = pixels[i+2] - 128;
    out[i]   = Math.max(0, Math.min(255, Math.round(y + 1.402*cr)));
    out[i+1] = Math.max(0, Math.min(255, Math.round(y - 0.344136*cb - 0.714136*cr)));
    out[i+2] = Math.max(0, Math.min(255, Math.round(y + 1.772*cb)));
  }
  return out;
}

function rgbToHsv(pixels) {
  const out = Buffer.alloc(pixels.length);
  for (let i = 0; i < pixels.length; i += 3) {
    const r = pixels[i]/255, g = pixels[i+1]/255, b = pixels[i+2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = 0, s = max === 0 ? 0 : d/max, v = max;
    if (d !== 0) {
      if      (max === r) h = ((g-b)/d + (g<b?6:0)) / 6;
      else if (max === g) h = ((b-r)/d + 2) / 6;
      else                h = ((r-g)/d + 4) / 6;
    }
    out[i]   = Math.round(h * 255);
    out[i+1] = Math.round(s * 255);
    out[i+2] = Math.round(v * 255);
  }
  return out;
}

function hsvToRgb(pixels) {
  const out = Buffer.alloc(pixels.length);
  for (let i = 0; i < pixels.length; i += 3) {
    const h = pixels[i]/255*6, s = pixels[i+1]/255, v = pixels[i+2]/255;
    const f = h - Math.floor(h);
    const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
    let r,g,b;
    switch (Math.floor(h) % 6) {
      case 0: r=v; g=t; b=p; break;
      case 1: r=q; g=v; b=p; break;
      case 2: r=p; g=v; b=t; break;
      case 3: r=p; g=q; b=v; break;
      case 4: r=t; g=p; b=v; break;
      case 5: r=v; g=p; b=q; break;
    }
    out[i]   = Math.round(r*255);
    out[i+1] = Math.round(g*255);
    out[i+2] = Math.round(b*255);
  }
  return out;
}



function buildShannonFano(freqs) {
  const symbols = Object.entries(freqs)
    .map(([sym, freq]) => ({ sym: Number(sym), freq }))
    .sort((a, b) => b.freq - a.freq);

  const codes = {};
  function split(arr, prefix) {
    if (arr.length === 1) { codes[arr[0].sym] = prefix || "0"; return; }
    const total = arr.reduce((s, x) => s + x.freq, 0);
    let acc = 0, mid = 0;
    for (let i = 0; i < arr.length; i++) {
      acc += arr[i].freq;
      if (acc >= total / 2) { mid = i + 1; break; }
    }
    split(arr.slice(0, mid), prefix + "0");
    split(arr.slice(mid),    prefix + "1");
  }
  split(symbols, "");
  return codes;
}

function shannonFanoEncode(data) {
  const freqs = {};
  for (const b of data) freqs[b] = (freqs[b] || 0) + 1;
  const codes = buildShannonFano(freqs);

 
  const tableEntries = Object.entries(codes);
  const tableParts = [Buffer.alloc(2)];
  tableParts[0].writeUInt16LE(tableEntries.length, 0);

  for (const [sym, code] of tableEntries) {
    const entry = Buffer.alloc(2 + Math.ceil(code.length / 8));
    entry.writeUInt8(Number(sym), 0);
    entry.writeUInt8(code.length, 1);
    let byte = 0, bit = 0;
    for (let i = 0; i < code.length; i++) {
      if (code[i] === "1") byte |= (1 << (7 - bit));
      bit++;
      if (bit === 8) { entry[2 + Math.floor((i) / 8)] = byte; byte = 0; bit = 0; }
    }
    if (bit > 0) entry[2 + Math.floor((code.length-1) / 8)] = byte;
    tableParts.push(entry);
  }


  let bits = "";
  for (const b of data) bits += codes[b];
  const byteLen = Math.ceil(bits.length / 8);
  const encoded = Buffer.alloc(byteLen);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") encoded[Math.floor(i/8)] |= (1 << (7 - (i%8)));
  }

  const dataLenBuf = Buffer.alloc(4);
  dataLenBuf.writeUInt32LE(data.length, 0);

  return Buffer.concat([...tableParts, dataLenBuf, encoded]);
}

function shannonFanoDecode(buf) {
  let offset = 0;
  const numSymbols = buf.readUInt16LE(offset); offset += 2;
  const codes = {};
  for (let i = 0; i < numSymbols; i++) {
    const sym = buf.readUInt8(offset++);
    const codeLen = buf.readUInt8(offset++);
    let code = "";
    const byteCount = Math.ceil(codeLen / 8);
    for (let b = 0; b < byteCount; b++) {
      const byte = buf.readUInt8(offset++);
      for (let bit = 7; bit >= 0 && code.length < codeLen; bit--) {
        code += (byte >> bit) & 1 ? "1" : "0";
      }
    }
    codes[code] = sym;
  }

  const originalLen = buf.readUInt32LE(offset); offset += 4;
  const out = Buffer.alloc(originalLen);
  let current = "", written = 0;
  for (let i = offset; i < buf.length && written < originalLen; i++) {
    const byte = buf[i];
    for (let bit = 7; bit >= 0 && written < originalLen; bit--) {
      current += (byte >> bit) & 1 ? "1" : "0";
      if (codes[current] !== undefined) {
        out[written++] = codes[current];
        current = "";
      }
    }
  }
  return out;
}


function buildHuffman(freqs) {
  let nodes = Object.entries(freqs).map(([sym, freq]) => ({ sym: Number(sym), freq, left: null, right: null }));
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    const left = nodes.shift(), right = nodes.shift();
    nodes.push({ sym: null, freq: left.freq + right.freq, left, right });
  }
  const codes = {};
  function traverse(node, code) {
    if (!node.left && !node.right) { codes[node.sym] = code || "0"; return; }
    traverse(node.left,  code + "0");
    traverse(node.right, code + "1");
  }
  traverse(nodes[0], "");
  return codes;
}

function huffmanEncode(data) {
  const freqs = {};
  for (const b of data) freqs[b] = (freqs[b] || 0) + 1;
  const codes = buildHuffman(freqs);
  // reuse same serialization as shannon-fano
  const tableEntries = Object.entries(codes);
  const tableParts = [Buffer.alloc(2)];
  tableParts[0].writeUInt16LE(tableEntries.length, 0);
  for (const [sym, code] of tableEntries) {
    const entry = Buffer.alloc(2 + Math.ceil(code.length / 8));
    entry.writeUInt8(Number(sym), 0);
    entry.writeUInt8(code.length, 1);
    let byte = 0, bit = 0;
    for (let i = 0; i < code.length; i++) {
      if (code[i] === "1") byte |= (1 << (7 - bit));
      bit++;
      if (bit === 8) { entry[2 + Math.floor(i/8)] = byte; byte = 0; bit = 0; }
    }
    if (bit > 0) entry[2 + Math.floor((code.length-1)/8)] = byte;
    tableParts.push(entry);
  }
  let bits = "";
  for (const b of data) bits += codes[b];
  const byteLen = Math.ceil(bits.length / 8);
  const encoded = Buffer.alloc(byteLen);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") encoded[Math.floor(i/8)] |= (1 << (7-(i%8)));
  }
  const dataLenBuf = Buffer.alloc(4);
  dataLenBuf.writeUInt32LE(data.length, 0);
  return Buffer.concat([...tableParts, dataLenBuf, encoded]);
}


const huffmanDecode = shannonFanoDecode;


function downsampleMPEG(pixels, width, height, version) {

  const yPlane  = Buffer.alloc(width * height);
  const cbPlane = Buffer.alloc((width/2) * (height/2));
  const crPlane = Buffer.alloc((width/2) * (height/2));

  
  for (let i = 0; i < width * height; i++) {
    yPlane[i] = pixels[i * 3];
  }

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i00 = (y * width + x) * 3;
      const i10 = ((y+1) * width + x) * 3;
      const i01 = (y * width + x+1) * 3;
      const i11 = ((y+1) * width + x+1) * 3;

      const outIdx = (y/2) * (width/2) + (x/2);

      if (version === 1) {
        
        cbPlane[outIdx] = Math.round((pixels[i00+1] + pixels[i01+1] + pixels[i10+1] + pixels[i11+1]) / 4);
        crPlane[outIdx] = Math.round((pixels[i00+2] + pixels[i01+2] + pixels[i10+2] + pixels[i11+2]) / 4);
      } else {
       
        cbPlane[outIdx] = Math.round((pixels[i00+1] + pixels[i01+1]) / 2);
        crPlane[outIdx] = Math.round((pixels[i00+2] + pixels[i01+2]) / 2);
      }
    }
  }

  const w2 = Buffer.alloc(2); w2.writeUInt16LE(width, 0);
  const h2 = Buffer.alloc(2); h2.writeUInt16LE(height, 0);
  return Buffer.concat([w2, h2, yPlane, cbPlane, crPlane]);
}

function upsampleMPEG(data) {
  let offset = 0;
  const width  = data.readUInt16LE(offset); offset += 2;
  const height = data.readUInt16LE(offset); offset += 2;
  const yPlane  = data.slice(offset, offset + width*height); offset += width*height;
  const cbPlane = data.slice(offset, offset + (width/2)*(height/2)); offset += (width/2)*(height/2);
  const crPlane = data.slice(offset);

  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      out[i]   = yPlane[y * width + x];
      out[i+1] = cbPlane[Math.floor(y/2) * (width/2) + Math.floor(x/2)];
      out[i+2] = crPlane[Math.floor(y/2) * (width/2) + Math.floor(x/2)];
    }
  }
  return out;
}


function encodeMSI({ width, height, channels, pixels, metadata = {}, compression = COMPRESSION.NONE, colorspace = null, pixelIndex = 0 }) {
  
  if (colorspace === null) {
    colorspace = channels === 1 ? COLORSPACE.LINEAR : COLORSPACE.RGB;
  }

  let pixelData = Buffer.from(pixels);

  
  if (channels === 3) {
    if (colorspace === COLORSPACE.YCBCR) pixelData = rgbToYCbCr(pixelData);
    else if (colorspace === COLORSPACE.HSV) pixelData = rgbToHsv(pixelData);
  }

 
  if (compression === COMPRESSION.SHANNON_FANO) {
    pixelData = shannonFanoEncode(pixelData);
  } else if (compression === COMPRESSION.HUFFMAN) {
    pixelData = huffmanEncode(pixelData);
  } else if (compression === COMPRESSION.DOWNSAMPLING_MPEG1) {
    pixelData = downsampleMPEG(pixelData, width, height, 1);
  } else if (compression === COMPRESSION.DOWNSAMPLING_MPEG2) {
    pixelData = downsampleMPEG(pixelData, width, height, 2);
  }

 
  const fixedHeader = Buffer.alloc(28);
  MAGIC.copy(fixedHeader, 0);                              // 0:  MAGIC
  fixedHeader.writeUInt16LE(VERSION,     4);               // 4:  VERSION
  fixedHeader.writeUInt16LE(HEADER_LEN,  6);               // 6:  HEADER_LEN
  fixedHeader.writeUInt32LE(width,       8);               // 8:  WIDTH
  fixedHeader.writeUInt32LE(height,      12);              // 12: HEIGHT
  fixedHeader.writeUInt8(channels,       16);              // 16: CHANNELS
  fixedHeader.writeUInt8(colorspace,     17);              // 17: COLORSPACE
  fixedHeader.writeUInt8(compression,    18);              // 18: COMPRESSION
  fixedHeader.writeUInt8(0,              19);              // 19: RESERVED

  const metaBuf = Buffer.from(JSON.stringify({
    ...metadata,
    created: new Date().toISOString(),
    width, height, channels, colorspace, compression,
  }));

  fixedHeader.writeUInt32LE(metaBuf.length,    20);        // 20: META_LEN
  fixedHeader.writeUInt32LE(pixelData.length,  24);        // 24: PIXEL_LEN

  const body = Buffer.concat([fixedHeader, metaBuf, pixelData]);


  const checksum = Buffer.alloc(4);
  checksum.writeInt32LE(crc32.buf(body), 0);

  return Buffer.concat([body, checksum]);
}



function decodeMSI(buffer) {
  let offset = 0;

  
  const magic = buffer.slice(0, 4);
  if (!magic.equals(MAGIC)) throw new Error("Invalid MSI file: bad magic bytes");
  offset += 4;

  const version    = buffer.readUInt16LE(offset); offset += 2;
  const headerLen  = buffer.readUInt16LE(offset); offset += 2;
  const width      = buffer.readUInt32LE(offset); offset += 4;
  const height     = buffer.readUInt32LE(offset); offset += 4;
  const channels   = buffer.readUInt8(offset);    offset += 1;
  const colorspace = buffer.readUInt8(offset);    offset += 1;
  const compression = buffer.readUInt8(offset);   offset += 1;
  offset += 1; 

  const metaLen   = buffer.readUInt32LE(offset);  offset += 4;
  const pixelLen  = buffer.readUInt32LE(offset);  offset += 4;

  const metadata  = JSON.parse(buffer.slice(offset, offset + metaLen).toString()); offset += metaLen;
  let pixelData   = buffer.slice(offset, offset + pixelLen); offset += pixelLen;

  
  const storedCRC   = buffer.readInt32LE(offset);
  const computedCRC = crc32.buf(buffer.slice(0, offset));
  if (storedCRC !== computedCRC) throw new Error("MSI checksum mismatch — file may be corrupted");


  if (compression === COMPRESSION.SHANNON_FANO) {
    pixelData = shannonFanoDecode(pixelData);
  } else if (compression === COMPRESSION.HUFFMAN) {
    pixelData = huffmanDecode(pixelData);
  } else if (compression === COMPRESSION.DOWNSAMPLING_MPEG1 || compression === COMPRESSION.DOWNSAMPLING_MPEG2) {
    pixelData = upsampleMPEG(pixelData);
  }

 
  if (channels === 3) {
    if (colorspace === COLORSPACE.YCBCR) pixelData = yCbCrToRgb(pixelData);
    else if (colorspace === COLORSPACE.HSV) pixelData = hsvToRgb(pixelData);
  }

  return { width, height, channels, colorspace, compression, version, metadata, pixels: pixelData };
}

module.exports = { encodeMSI, decodeMSI, COLORSPACE, COMPRESSION };