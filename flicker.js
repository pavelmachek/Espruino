eval(require("fs").readFile("sdl.js"));

// Light sensor visualization and flicker detection for Bangle.js 2

/*
  How is that sensor accessed? Create a simple application that displays current value, graph of recent values, and min and max in last second. It should optionally sample at high rate and save those samples to detect periodic flicker at 50Hz, for example.
￼
*/

// ---- Configuration ----
let sampleInterval = 50;  // ms between samples (20 Hz)
let highRate = false;     // toggle high-rate flicker detection mode
let history = [];
let historyLen = 100;     // number of samples in graph
let flickerSamples = [];
let flickerBufferLen = 500; // for high-rate mode (~1s at 2 ms interval)

function sampleLight() {
  let v = Puck.light(); // normalized 0..1
  history.push(v);
  if (history.length > historyLen) history.shift();
  if (highRate) {
    flickerSamples.push(v);
    if (flickerSamples.length > flickerBufferLen)
      flickerSamples.shift();
  }
}

function draw() {
    g.reset(). clear();
    g.setColor(0,0,0);
  g.setFont("Vector", 20);
  let v = history[history.length - 1] || 0;
  let min = Math.min.apply(null, history);
  let max = Math.max.apply(null, history);

  g.drawString("Light: " + v.toFixed(6), 0, 0);
  g.drawString("Min: " + min.toFixed(3), 0, 24);
  g.drawString("Max: " + max.toFixed(3), 0, 48);

  // Draw graph
  let y0 = 100, h = 60, w = g.getWidth();
  g.drawLine(0, y0, w, y0);
  for (let i = 0; i < history.length; i++) {
    let x = i * w / historyLen;
    let y = y0 - history[i] * h;
    g.fillRect(x, y, x + 1, y);
  }

  g.flip();
}

// ---- Main Loop ----
setInterval(sampleLight, sampleInterval);
setInterval(draw, 200);

// ---- Optional: Flicker detection ----
function enableHighRate(on) {
  highRate = on;
  if (on) {
    sampleInterval = 2; // 500 Hz sampling
    console.log("High-rate sampling enabled");
  } else {
    sampleInterval = 50;
    flickerSamples = [];
    console.log("High-rate sampling disabled");
  }
}

// Example flicker analysis: check dominant frequency
function detectFlicker() {
  if (flickerSamples.length < flickerBufferLen) return;
  let mean = flickerSamples.reduce((a, b) => a + b) / flickerSamples.length;
  let signal = flickerSamples.map(v => v - mean);
  let crossings = 0;
  for (let i = 1; i < signal.length; i++) {
    if (signal[i - 1] * signal[i] < 0) crossings++;
  }
  let freq = crossings / 2 / (flickerBufferLen * sampleInterval / 1000);
  console.log("Approx flicker frequency:", freq.toFixed(1), "Hz");
}

// Run flicker detection every second
setInterval(() => {
  if (highRate) detectFlicker();
}, 1000);

// ---- UI ----
Bangle.setUI("touch", (b, xy) => {
  enableHighRate(!highRate);
});
