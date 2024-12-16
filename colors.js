#!bin/espruino

eval(require("fs").readFile("sdl.js"));

R = Bangle.appRect;

function hexToLinearRGB(hex) {
    // Helper function to convert gamma-encoded sRGB to linear RGB
    function gammaToLinear(channel) {
        const normalized = channel / 255; // Normalize to 0–1
        return normalized <= 0.04045 
            ? normalized / 12.92 
            : Math.pow((normalized + 0.055) / 1.055, 2.4);
    }
    
    // Remove '#' and parse hex components
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Convert to linear RGB
    return {
        r: gammaToLinear(r),
        g: gammaToLinear(g),
        b: gammaToLinear(b)
    };
}

// HEX to HSV
function hexToHsv(hex) {
  // Parse hex color
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Normalize RGB values to [0, 1]
  const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;

  // Find Cmax, Cmin, and delta
  const cmax = Math.max(rNorm, gNorm, bNorm);
  const cmin = Math.min(rNorm, gNorm, bNorm);
  const delta = cmax - cmin;

  // Calculate Hue (H)
  let h;
  if (delta === 0) {
    h = 0; // Hue is undefined for grayscale colors
  } else if (cmax === rNorm) {
    h = ((gNorm - bNorm) / delta) % 6;
  } else if (cmax === gNorm) {
    h = (bNorm - rNorm) / delta + 2;
  } else {
    h = (rNorm - gNorm) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  // Calculate Saturation (S)
  const s = cmax === 0 ? 0 : Math.round((delta / cmax) * 100);

  // Calculate Value (V)
  const v = Math.round(cmax * 100);

  return { h, s, v };
}


// HSV to HEX
function hsvToHex(h, s, v) {
  // Normalize saturation and value
  s /= 100;
  v /= 100;

  // Calculate chroma
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;

  // Determine RGB prime values
  let rPrime, gPrime, bPrime;
  if (h >= 0 && h < 60) {
    rPrime = c; gPrime = x; bPrime = 0;
  } else if (h >= 60 && h < 120) {
    rPrime = x; gPrime = c; bPrime = 0;
  } else if (h >= 120 && h < 180) {
    rPrime = 0; gPrime = c; bPrime = x;
  } else if (h >= 180 && h < 240) {
    rPrime = 0; gPrime = x; bPrime = c;
  } else if (h >= 240 && h < 300) {
    rPrime = x; gPrime = 0; bPrime = c;
  } else {
    rPrime = c; gPrime = 0; bPrime = x;
  }

  // Convert RGB prime to 0-255 range
  const r = Math.round((rPrime + m) * 255);
  const g = Math.round((gPrime + m) * 255);
  const b = Math.round((bPrime + m) * 255);

  // Convert to hex format
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  return hex;
}

// Example usage:
const hexColor = "#FF5733";
const hsv = hexToHsv(hexColor);
console.log(`HEX to HSV: ${JSON.stringify(hsv)}`); // { h: 14, s: 80, v: 100 }

const convertedHex = hsvToHex(hsv.h, hsv.s, hsv.v);
console.log(`HSV to HEX: ${convertedHex}`); // "#FF5733"

// Example palette (3-bit display colors)
const palette = [
  { originalHex: "#000000", hex: "#403f5f" }, // Black
  { originalHex: "#0000ff", hex: "#4b6ec0" }, // Blue
  { originalHex: "#00ff00", hex: "#839d68" }, // Green
  { originalHex: "#00ffff", hex: "#7ea581" }, // Sage Green
  { originalHex: "#ff0000", hex: "#9d6868" }, // Red
  { originalHex: "#ff00ff", hex: "#897593" }, // Muted Mauve
  { originalHex: "#ffff00", hex: "#cdd5bc" }, // Sage Gray  -- spis #e7f5bf
  { originalHex: "#ffffff", hex: "#dff6c0" }  // White
];

for (i=0; i<8; i++) {
  palette[i].l = hexToLinearRGB(palette[i].hex);
  print(hexToHsv(palette[i].hex));
}

function linearAdd(inputLinear, closestPrimary) {
  return {
        r: inputLinear.r + closestPrimary.r,
        g: inputLinear.g + closestPrimary.g,
        b: inputLinear.b + closestPrimary.b
    };
}

function linearDiff(inputLinear, closestPrimary) {
  return {
        r: inputLinear.r - closestPrimary.r,
        g: inputLinear.g - closestPrimary.g,
        b: inputLinear.b - closestPrimary.b
    };
}

var best = hexToLinearRGB("#ffffff");
var besti;
function bestBlack(sum, i, len) {
  let s1 = best.r + best.g + best.b;
  let s2 = sum.r  + sum.g  + sum.b;
  let lim = len * 0.04;
  
  if (Math.abs(sum.r - sum.g) > lim) return;
  if (Math.abs(sum.b - sum.g) > lim) return;

  if (s1 > s2) {
    best = sum;
    besti = i;
    print("New best", i, sum, Math.abs(sum.b - sum.g));
  }
}


function getPattern(len) {
  for (let i=0; i < 1<<(3*len); i++) {
    let sum = hexToLinearRGB("#000000");
    let k = i;
    for (let j=0; j < len; j++) {
      sum = linearAdd(sum, palette[k & 7].l);
      k >>= 3;
    }
    bestBlack(sum, i, len);
  }
}

function dither(x, y, i) {
  let d = 2;
  print("dither");
  for (let x_ = x; x_ < (x+(90)); x_+=d)
    for (let y_ = y; y_ < (y+(90)); y_+=d) {
      let j = i;
      g.setPixel(x_, y_, "#000000");
      g.setPixel(x_, y_, palette[j & 7].hex); j >>= 3;
      g.setPixel(x_+1, y_, palette[j & 7].hex); j >>= 3;
      g.setPixel(x_, y_+1, palette[j & 7].hex); j >>= 3;
      g.setPixel(x_+1, y_+1, palette[j & 7].hex); j >>= 3;
    }
}

print("Recursion test");
getPattern(4);
print("Best is ", besti);

function introScreen() {
  g.reset().clearRect(R);
  g.setColor(0,0,0).setFont("Vector",25);
  g.setFontAlign(0,0);
  g.drawString("Hello", 85,35);
  g.setColor(0,0,0).setFont("Vector",18);
  g.drawString("Press button", 85,55);

  for (i=0; i<8; i++) {
//    print(palette[i]);
    g.setColor(palette[i].hex);
    g.fillRect(100*i, 100, 100*i+90, 200);
  }

  dither(0, 310, besti);
}

function redraw() {
}

function emptyMap() {
  Bangle.setUI({mode:"custom",drag:e=>{
      g.reset().clearRect(R);
      redraw();    
  }, btn: btn=>{
    print("Button pressed");
  }});
}

function adjust() {
  let i = 8;
  let h = hsvToHex(color.h, color.s, color.v);
  print(color, h);
  g.setColor(h);
  g.fillRect(100*i, 100, 100*i+90, 200);
}

var color = { h: 86, s: 22, v: 96 }

function on_key(val) {
  if (val == 24) { color.h += 1; }
  if (val == 25) { color.s += 1; }
  if (val == 26) { color.v += 1; }
  
  if (val == 38) { color.h -= 1; }
  if (val == 39) { color.s -= 1; }
  if (val == 40) { color.v -= 1; }
  adjust();
}

Bangle.on('key', on_key);

introScreen();
emptyMap();

