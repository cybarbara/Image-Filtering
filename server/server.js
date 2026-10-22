const express = require("express");
const path = require("path");
const app = express();
const PORT = 8000;
const zlib = require("zlib");
const Jimp = require("jimp");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const sharp = require("sharp");
const upload = multer({ dest: "uploads/" });
const logStream = fs.createWriteStream("server.log", { flags: "a" });
const { encodeMSI, decodeMSI } = require("./msi");


let filepath;
let image;
let mimetype;


function logToFile(entry) {
  const line = JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  logStream.write(line + "\n");
  console.log(line);
}


app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
  }),
);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logToFile({
      type: "request",
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration_ms: Date.now() - start,
    });
  });
  next();
});




app.post("/encode-msi", upload.single("image"), async (req, res) => {
  try {
    const image = await fs.promises.readFile(req.file.path);
    const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });

    const msiBuffer = encodeMSI({
      width: info.width,
      height: info.height,
      channels: info.channels,
      pixels: data,
      metadata: { originalName: req.file.originalname },
    });

    logToFile({ level: "INFO", type: "encode-msi", file: req.file.originalname, size: msiBuffer.length });

    res.set("Content-Type", "application/octet-stream");
    res.set("Content-Disposition", `attachment; filename="image.msi"`);
    res.send(msiBuffer);
  } catch (err) {
    logToFile({ level: "ERROR", type: "encode-msi", error: err.message });
    res.status(500).json({ error: err.message });
  }
});
app.listen(PORT, () => {
  console.log(`Server is running successfully on http://localhost:${PORT}`);
});

app.post("/decode-msi", upload.single("image"), async (req, res) => {
  try {
    const msiBuffer = await fs.promises.readFile(req.file.path);
    const { width, height, channels, pixels } = decodeMSI(msiBuffer);

    const encoded = await sharp(Buffer.from(pixels), {
      raw: { width, height, channels }
    }).jpeg().toBuffer();

    logToFile({ level: "INFO", type: "decode-msi", size: msiBuffer.length });

    res.json({ image: encoded.toString("base64"), type: "image/jpg" });
  } catch (err) {
    logToFile({ level: "ERROR", type: "decode-msi", error: err.message });
    res.status(500).json({ error: err.message });
  }
});


app.post("/process-image", upload.single("image"), async (req, res) => {
  try {
    
    const image = await fs.readFileSync(req.file.path);
    
    const inputSize = image.length;
    const { mode } = req.body;
    const filterStart = Date.now();
    const filterLog = [];
console.log(req.body);
    const { data, info } = await sharp(image)
      .raw()
      .toBuffer({ resolveWithObject: true });

    let pixels = data;

    if (mode === "batch") {
      const filters = JSON.parse(req.body.filters);
      for (const filter of filters) {
        const {
          filterName,
          brightness,
          sharpen,
          flip,
          jitter,
          dotSize,
          threshold,
        } = filter;
        const start = Date.now();
        switch (filterName) {
          case "Brightness":
            pixels = brightnessFilter(pixels, Number(brightness));
            break;
          case "Invert":
            pixels = invertFilter(pixels);
            break;
          case "Sharpen":
            pixels = sharpenFilter(
              pixels,
              info.width,
              info.height,
              Number(sharpen),
            );
            break;
          case "EdgeEnhance":
            pixels = enhanceEdges(
              pixels,
              info.width,
              info.height,
              Number(threshold),
            );
            break;
          case "FlipHorVer":
            pixels =
              flip === "horizontal"
                ? flipHorizontal(pixels, info.width, info.height)
                : flipVertical(pixels, info.width, info.height);
            break;
          case "RandomJitter":
            pixels = randomJitter(
              pixels,
              info.width,
              info.height,
              Number(jitter),
            );
            break;
          case "BillAtkinson":
            pixels = atkinsonDither(pixels, info.width, info.height);
            break;
          case "Halftone":
            pixels = halftone(pixels, info.width, info.height, Number(dotSize));
            break;
        }
        filterLog.push({ filterName, duration_ms: Date.now() - start });
      }
    } else {
      const {
        filterName,
        brightness,
        sharpen,
        flip,
        jitter,
        dotSize,
        threshold,
      } = req.body;
      const start = Date.now();
      switch (filterName) {
        case "Brightness":
          pixels = brightnessFilter(pixels, Number(brightness));
          break;
        case "Invert":
          pixels = invertFilter(pixels);
          break;
        case "Sharpen":
          pixels = sharpenFilter(
            pixels,
            info.width,
            info.height,
            Number(sharpen),
          );
          break;
        case "EdgeEnhance":
          pixels = enhanceEdges(
            pixels,
            info.width,
            info.height,
            Number(threshold),
          );
          break;
        case "FlipHorVer":
          pixels =
            flip === "horizontal"
              ? flipHorizontal(pixels, info.width, info.height)
              : flipVertical(pixels, info.width, info.height);
          break;
        case "RandomJitter":
          pixels = randomJitter(
            pixels,
            info.width,
            info.height,
            Number(jitter),
          );
          break;
        case "BillAtkinson":
          pixels = atkinsonDither(pixels, info.width, info.height);
          break;
        case "Halftone":
          pixels = halftone(pixels, info.width, info.height, Number(dotSize));
          break;
      }
      filterLog.push({ filterName, duration_ms: Date.now() - start });
    }

    const encoded = await sharp(Buffer.from(pixels), {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .jpeg()
      .toBuffer();

   
    logToFile({
      level: "INFO",
      type: mode === "batch" ? "batch" : "single",
      file: req.file.originalname,
      imageSize: `${info.width}x${info.height}`,
      input_bytes: inputSize,
      output_bytes: encoded.length,
      filters: filterLog,
      total_ms: Date.now() - filterStart,
    });

    res.json({ image: encoded.toString("base64"), type: "image/jpg" });
  } catch (err) {
    
    logToFile({
      level: "ERROR",
      type: "process-image",
      error: err.message,
      stack: err.stack,
    });
    res
      .status(500)
      .json({ error: "Image processing failed", message: err.message });
  }
});

function clamp(val) {
  return Math.max(0, Math.min(255, Math.round(val)));
}

function brightnessFilter(pixels, amount) {
  const out = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    out[i] = clamp(pixels[i] + amount); 
    out[i + 1] = clamp(pixels[i + 1] + amount); 
    out[i + 2] = clamp(pixels[i + 2] + amount); 
    out[i + 3] = pixels[i + 3]; 
  }
  return out;
}
function invertFilter(pixels) {
  const out = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    out[i] = 255 - pixels[i]; // R
    out[i + 1] = 255 - pixels[i + 1];
    out[i + 2] = 255 - pixels[i + 2]; 
    out[i + 3] = pixels[i + 3]; 
  }
  return out;
}
function sharpenFilter(pixels, width, height, strength) {
  const output = new Uint8Array(pixels.length);

  const kernel = [
    0,
    -strength,
    0,
    -strength,
    1 + 4 * strength,
    -strength,
    0,
    -strength,
    0,
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0;
      let g = 0;
      let b = 0;

      let k = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 3;

          const weight = kernel[k++];

          r += pixels[idx] * weight;
          g += pixels[idx + 1] * weight;
          b += pixels[idx + 2] * weight;
        }
      }

      const out = (y * width + x) * 3;

      output[out] = Math.max(0, Math.min(255, r));
      output[out + 1] = Math.max(0, Math.min(255, g));
      output[out + 2] = Math.max(0, Math.min(255, b));
    }
  }

  return output;
}
function flipHorizontal(pixels, width, height) {
  const output = new Uint8ClampedArray(pixels.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 3;
      const tgtIdx = (y * width + (width - 1 - x)) * 3;

      for (let c = 0; c < 3; c++) {
        output[tgtIdx + c] = pixels[srcIdx + c];
      }
    }
  }

  return output;
}
function flipVertical(pixels, width, height) {
  const output = new Uint8ClampedArray(pixels.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 3;
      const dst = ((height - y - 1) * width + x) * 3;

      output[dst] = pixels[src];
      output[dst + 1] = pixels[src + 1];
      output[dst + 2] = pixels[src + 2];
    }
  }

  return output;
}
function randomJitter(pixels, width, height, amount) {
  const output = new Uint8ClampedArray(pixels.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = Math.max(
        0,
        Math.min(
          width - 1,
          x + Math.floor(Math.random() * (amount * 2 + 1)) - amount,
        ),
      );

      const ny = Math.max(
        0,
        Math.min(
          height - 1,
          y + Math.floor(Math.random() * (amount * 2 + 1)) - amount,
        ),
      );

      const src = (ny * width + nx) * 3;
      const dst = (y * width + x) * 3;

      output[dst] = pixels[src];
      output[dst + 1] = pixels[src + 1];
      output[dst + 2] = pixels[src + 2];
    }
  }

  return output;
}
function atkinsonDither(pixels, width, height) {
  const gray = new Float32Array(width * height);

  for (let i = 0, p = 0; i < gray.length; i++, p += 3) {
    gray[i] = pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      const oldPixel = gray[idx];
      const newPixel = oldPixel < 128 ? 0 : 255;

      gray[idx] = newPixel;

      const error = (oldPixel - newPixel) / 8;

      const spread = [
        [1, 0],
        [2, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
        [0, 2],
      ];

      for (const [dx, dy] of spread) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          gray[ny * width + nx] += error;
        }
      }
    }
  }

  const output = new Uint8Array(width * height * 3);

  for (let i = 0, p = 0; i < gray.length; i++, p += 3) {
    const value = gray[i] < 128 ? 0 : 255;

    output[p] = value;
    output[p + 1] = value;
    output[p + 2] = value;
  }

  return output;
}
function halftone(pixels, width, height, cellSize = 10) {
  const output = new Uint8Array(width * height * 3);

  output.fill(255);

  for (let cy = 0; cy < height; cy += cellSize) {
    for (let cx = 0; cx < width; cx += cellSize) {
      let brightness = 0;
      let count = 0;

      for (let y = cy; y < Math.min(cy + cellSize, height); y++) {
        for (let x = cx; x < Math.min(cx + cellSize, width); x++) {
          const idx = (y * width + x) * 3;

          brightness +=
            pixels[idx] * 0.299 +
            pixels[idx + 1] * 0.587 +
            pixels[idx + 2] * 0.114;

          count++;
        }
      }

      const avg = brightness / count;

      const radius = (1 - avg / 255) * (cellSize / 2);

      const centerX = cx + cellSize / 2;
      const centerY = cy + cellSize / 2;

      for (let y = cy; y < Math.min(cy + cellSize, height); y++) {
        for (let x = cx; x < Math.min(cx + cellSize, width); x++) {
          const dx = x - centerX;
          const dy = y - centerY;

          const idx = (y * width + x) * 3;

          const black = dx * dx + dy * dy <= radius * radius;

          const value = black ? 0 : 255;

          output[idx] = value;
          output[idx + 1] = value;
          output[idx + 2] = value;
        }
      }
    }
  }

  return output;
}
function enhanceEdges(pixels, width, height, strength = 1) {
  const output = new Uint8Array(pixels.length);

  
  for (let i = 0; i < pixels.length; i++) {
    output[i] = pixels[i];
  }

  const kernel = [
    [-1, -1, -1],
    [-1, 8, -1],
    [-1, -1, -1],
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0,
        g = 0,
        b = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 3; 
          const weight = kernel[ky + 1][kx + 1] * strength;

          r += pixels[idx] * weight;
          g += pixels[idx + 1] * weight;
          b += pixels[idx + 2] * weight;
          
        }
      }

      const out = (y * width + x) * 3; 
      output[out] = Math.max(0, Math.min(255, Math.round(pixels[out] + r)));
      output[out + 1] = Math.max(
        0,
        Math.min(255, Math.round(pixels[out + 1] + g)),
      );
      output[out + 2] = Math.max(
        0,
        Math.min(255, Math.round(pixels[out + 2] + b)),
      );
      output[out + 3] = pixels[out + 3]; 
    }
  }

  return output;
}

app.use((err, req, res, next) => {
  logToFile({ level: "ERROR", type: "middleware", error: err.message });
  res.status(400).json({ error: err.message });
});


process.on("uncaughtException", (err) => {
  logToFile({
    level: "ERROR",
    type: "uncaughtException",
    error: err.message,
    stack: err.stack,
  });
});

process.on("unhandledRejection", (reason) => {
  logToFile({
    level: "ERROR",
    type: "unhandledRejection",
    error: String(reason),
  });
});
