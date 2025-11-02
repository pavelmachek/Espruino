/* This is primarily maintained in the tui/bwatch . */

eval(require("fs").readFile("sdl.js"));

/* Step counter demo for Bangle.js2
   - manual step detection from accel (peak + dynamic threshold)
   - displays manual count and system count (Bangle.getStepCount())
   - both counters zeroed at startup by subtracting startup values
   - bottom strip: small graph of recent processed accel values
   - big font for counters
   
   Bangle.js2: Implement step counter by reading accelerometer data and processing them manually. Display step counter value, along with step counter obtained from Bangle.js2 system. (Substract value at startup so that both counters stay at zero). Search the web or papers for some reasonable algorithm for step detection. Use big font for step counter values. Display small graph of recent readings in bottom part of screen.


Where I got the algorithm idea (quick sources)
Analog Devices app note: simple peak-detection pedometer for low-power accelerometers — peak detection + time window works well for wrist sensors. 
analog.com

Open-source / constrained-device implementations use windowed peak detection and simple moving filters. Brondin (2020) documents a small algorithm optimized for wearable devices. 
DIVA Portal

Dynamic/adaptive thresholding (sliding minimum/mean/std) improves robustness across users and motion modes (Xu 2022, and others). 
MDPI
+1

Recent validation / reviews of open algorithms emphasize peak detection + adaptive thresholds and refractory (dead-time) as a good "one-size-fits-most" approach. 
cancer.jmir.org

How the app works (short)
Read Bangle.on('accel', ...) samples (about 25 Hz).

Compute acceleration magnitude mag = sqrt(x^2+y^2+z^2).

Estimate gravity / low-frequency component with a short moving average and subtract it to produce a band-passed / high-passed signal hp = mag - mean.

Maintain a sliding window of recent hp values and compute mean and std → adaptive threshold T = mean + k*std.

Use a small state machine: wait for hp > T to start a candidate step, capture the local maximum, then require hp to fall under a low threshold (or a minimum time) before allowing a new step. Enforce a refractory period (e.g., 300 ms) between detected steps.

Increment manual counter when a valid peak is found. Also show the firmware/system counter from Bangle.getStepCount() (and keep it offset to start at 0 as requested).

*/

// --- CONFIG ---
const SAMPLE_MS = 40;        // sampling cadence we expect (approx 25 Hz -> 40 ms)
const MA_WINDOW = 25;        // moving-average window for gravity estimate (~1s at 25Hz)
const STAT_WINDOW = 40;      // window (samples) for mean/std of hp for dynamic threshold
const THRESH_K = 0.8;        // threshold multiplier: mean + k * std
const MIN_STEP_MS = 220;     // refractory period between steps (ms)
const MAX_STEP_MS = 850;
const MAX_GRAPH = 120;       // graph width in pixels (history)
const GRAPH_HEIGHT = 36;     // bottom graph height

// --- STATE ---
let accelBuf = [];      // recent raw mags (for graph)
let hpBuf = [];         // recent high-pass values (for stats & graph)
let maBuf = [];         // moving average buffer (gravity estimate)
let statBuf = [];       // sliding window for mean/std of hp
let manualSteps = 0;
let systemSteps = 0;
let systemStart = 0;    // system offset to zero at start
let manualStart = 0;    // manual offset (kept 0, but left for symmetry)
let lastStepTime = 0;
let candidate = null;   // candidate peak info {t, maxVal, maxTime}
let paused = false;

// Screen geometry
const W = g.getWidth(), H = g.getHeight();
const graphY = H - GRAPH_HEIGHT - 4;
const infoY = 4;

// --- UTIL ---
function mag(x,y,z) { return Math.sqrt(x*x + y*y + z*z); }
function pushBuf(b,v,n) { b.push(v); if (n && b.length>n) b.shift(); }
function mean(arr) { if (!arr.length) return 0; let s=0; for (let v of arr) s+=v; return s/arr.length; }
function stddev(arr,m) { if (!arr.length) return 0; m=(m===undefined)?mean(arr):m; let s=0; for (let v of arr) s += (v-m)*(v-m); return Math.sqrt(s/arr.length||0); }

// --- STEP ALGORITHM (called from accel handler) ---
function processAccelSample(magVal, t) {
  // 1) update moving-average buffer for gravity estimate
  pushBuf(maBuf, magVal, MA_WINDOW);
  const gEst = mean(maBuf);
  
  // FIXME: this is not too useful. We are on earth, so... == 1.025 for me.

  // 2) high-passed signal (magnitude minus low-frequency gravity)
  const hp = magVal - gEst;
  pushBuf(hpBuf, hp, MAX_GRAPH);
  pushBuf(statBuf, hp, STAT_WINDOW);

  // 3) dynamic threshold
  let sMean = mean(statBuf), sStd = stddev(statBuf, sMean);
  if (sStd < 0.03) {
    sStd = 0.03;
  }
  
  const thresh = sMean + THRESH_K*sStd;
  const lowThresh = sMean + 0.2*sStd; // for fall detection

  // 4) state machine: detect candidate peaks
  // If hp exceeds threshold start candidate (or update max), else if candidate exists and hp falls below lowThresh -> finalize
  const now = t || getTime()*1000;
  if (hp > thresh) {
    if (!candidate) {
      // start candidate
      candidate = {maxVal: hp, maxTime: now};
    } else {
      // update candidate max
      if (hp > candidate.maxVal) {
        candidate.maxVal = hp;
        candidate.maxTime = now;
      }
    }
  } else {
    if (candidate) {
      // We had a candidate; only accept if enough time since lastStepTime
      if ((now - lastStepTime) > MIN_STEP_MS && candidate.maxVal > thresh) {
        print("Delta:", now - lastStepTime);
        if ((now - lastStepTime) < MAX_STEP_MS)
          manualSteps++;
        lastStepTime = candidate.maxTime;
      }
      candidate = null;
    }
  }

  // 5) keep accelBuf for graph
  pushBuf(accelBuf, hp, MAX_GRAPH);
  
  let s = " ";
  if (hp > thresh)
    s = "#";
  print(s, 'est', gEst, 'std', sStd, 'thr', thresh, 'cand', candidate);
}

// --- Bangle system step integration ---
// Read the system step counter and zero it at start
function initSystemSteps() {
  try {
    if (typeof Bangle.getStepCount === "function") {
      systemStart = Bangle.getStepCount() || 0;
      systemSteps = 0;
    } else {
      systemStart = 0;
      systemSteps = 0;
    }
  } catch (e) {
    systemStart = 0;
    systemSteps = 0;
  }
}

// update when Bangle emits a step event
Bangle.on('step', function(v){
  // v is number of steps since Bangle started (docs). We'll read getStepCount() to be safe.
  try {
    let s = Bangle.getStepCount();
    if (s===undefined) s = v||0;
    systemSteps = s - systemStart;
  } catch(e){ /* ignore */ }
});

// --- DRAWING ---
function draw() {
  g.clear();

  // Big font for manual and system counters
  g.setFont("Vector", 40);
  g.setColor(0);

  // Manual count (left)
  const manu = manualSteps - manualStart;
  g.drawString(String(manu), 6, infoY);

  // System count (right)
  const sys = systemSteps;
  const sysStr = String(sys);
  // right-align system number
  const sysW = g.stringWidth(sysStr);
  g.drawString(sysStr, W-6-sysW, infoY);

  // small labels
  g.setFont("6x8");
  g.drawString("manual", 6, infoY + 46);
  const lblW = g.stringWidth("system");
  g.drawString("system", W-6-lblW, infoY + 46);

  // small graph at bottom: draw hp values (scaled)
  const gx = 4, gw = W-8, gh = GRAPH_HEIGHT;
  g.drawRect(gx-1, graphY-1, gx+gw, graphY+gh);
  // Determine visual scaling: autoscale using recent stat window std/mean
  const sMean = mean(statBuf), sStd = stddev(statBuf,sMean);
  // Map hp values to graph: center line = sMean, scale = max(0.3, 3*sStd) to be visible
  const scale = Math.max(0.2, 3*sStd);
  const centerY = graphY + Math.floor(gh/2);
  g.setColor(0);
  // draw center line
  g.drawLine(gx, centerY, gx+gw-1, centerY);

  // draw hpBuf as line
  const arr = hpBuf.slice(); // copy
  if (arr.length>1) {
    let step = gw / (arr.length-1);
    let x = gx, prevY = centerY - Math.floor((arr[0]-sMean)/scale * (gh/2));
    for (let i=1;i<arr.length;i++) {
      let v = arr[i];
      let y = centerY - Math.floor((v - sMean)/scale * (gh/2));
      g.drawLine(Math.floor(x), prevY, Math.floor(x+step), y);
      prevY = y;
      x += step;
    }
  }

  // tiny text with stats
  g.setFont("6x8");
  g.drawString("hp mean:"+sMean.toFixed(3), gx, graphY - 12);
  g.drawString("hp std:"+sStd.toFixed(3), gx + 100, graphY - 12);

  // hint: tap bottom-left to reset both counters, bottom-right to pause/resume
  g.drawString("BL reset  BR pause", W/2 - 48, H - 10);

  Bangle.drawWidgets();
}

// --- TOUCH (corner actions) ---
function onTap(data) {
  if (!data || data.x===undefined) return;
  const cornerW = 40, cornerH = 28;
  const x = data.x, y = data.y;
  if (x <= cornerW && y >= H-cornerH) {
    // bottom-left reset
    manualSteps = 0;
    manualStart = 0;
    // reset system offset to current system count so it reads 0
    try {
      systemStart = Bangle.getStepCount() || systemStart;
      systemSteps = 0;
    } catch(e){}
    // clear buffers for nicer display
    accelBuf=[]; hpBuf=[]; maBuf=[]; statBuf=[];
    draw();
    return;
  }
  if (x >= W-cornerW && y >= H-cornerH) {
    paused = !paused;
    draw();
    return;
  }
}

// --- ACCEL HANDLER ---
function onAccel(a) {
  if (!a) return;
  const t = getTime()*1000;
  const magVal = (a.mag!==undefined)? a.mag : mag(a.x,a.y,a.z);
  // Process only when not paused and if enough time passed (to approximate SAMPLE_MS)
  if (paused) return;
  processAccelSample(magVal, t);
  // Update systemSteps from Bangle.getStepCount() to keep display consistent
  try { systemSteps = (Bangle.getStepCount() || 0) - systemStart; } catch(e){}
  // redraw periodically (cheap)
  // we'll throttle redraw to ~10-12Hz for battery; use a simple time guard
  if (!onAccel.lastDraw || (t - onAccel.lastDraw) > 30000) {
    onAccel.lastDraw = t;
    draw();
  }
}

// --- START / STOP ---
function start() {
  initSystemSteps();
  // register listeners
  Bangle.on('accel', onAccel);
  Bangle.on('tap', onTap);
  // try to grab an initial sample
  try {
    const a = Bangle.getAccel && Bangle.getAccel();
    if (a) {
      const magVal = (a.mag!==undefined)? a.mag : mag(a.x,a.y,a.z);
      processAccelSample(magVal, getTime()*1000);
    }
  } catch(e){}
  // initial draw
  draw();
}

function stop() {
  Bangle.removeListener('accel', onAccel);
  Bangle.removeListener('tap', onTap);
  g.clear(); Bangle.drawWidgets();
}

// run and ensure clean exit on button
start();
setWatch(function() { stop(); load(); }, BTN1, {edge:"falling", debounce:50, repeat:false});
