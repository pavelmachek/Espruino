eval(require("fs").readFile("sdl.js"));

// Gyro test for Bangle.js2
// - tries to read gyro (Bangle.on('gyro') if available, or MPU6050 module fallback).
// - calibrates bias while stationary, then integrates angular rate -> angle.
// - Shows live rates (deg/s) and integrated angle (deg)
// Written to be robust if 'gyro' API not present.

// This works _way_ better with lower sampling rate on the gyro.
// echo 14 > /sys/bus/iio/devices/iio\:device1/sampling_frequency

const CAL_SAMPLES = 100;       // samples to average for bias (keep watch still)
// Calibration seems to be -0.69, 1.55, -0.08
//                         -0.69, 1.62, 0.16
// Long calibration:       -0.72, 1.49, 0.00
//             .. on flat  -0.79, 1.48, 0.10
// later that day:         -0.48, 1.61, 0.34

  const LOG_EVERY = 10;          // how often to log to console (in iterations)

  let source = null;             // 'event', 'mpu', or null
  let unsub = null;
  let bias = {x:0,y:0,z:0};
  let last = null;
  let angle = {x:0,y:0,z:0};
  let sampleCount = 0;
  let calibrating = true;
  let iter = 0;

  // Helper: deg <-> rad
  const R2D = 180/Math.PI, D2R = Math.PI/180;

  // Calibration: collect N samples of gyro to compute bias (assume deg/s output).
  function startCalibration(onDone) {
    sampleCount = 0;
    bias = {x:0,y:0,z:0};
    calibrating = true;
    g.clear();
    g.setFont("Vector",20);
    g.drawString("Gyro test - keep still\nCalibrating...",10,10);
    // Wait: calibration will be updated by incoming samples
    onDone && onDone();
  }

  // Called by whichever data source when a gyro sample is available.
  // sample: {x:.., y:.., z:.., t: ms timestamp optional}
  function processSample(sample) {
    const t = sample.t || Date.now();
    // convert units: many gyro outputs are deg/s already, others are rad/s or mdps.
    // We'll try to auto-detect common units heuristically:
    // - if values are small (<0.2) we assume rad/s -> convert to deg/s
    // - if values look like mdps (large ~1000s) we scale to deg/s
    let s = {x: sample.x, y: sample.y, z: sample.z};
    // sanitize NaN
    ['x','y','z'].forEach(k=>{ if (!isFinite(s[k])) s[k]=0; });

    if (1) {
	let f = 60;
	s.x *= f; s.y *= f; s.z *= f;
    }
    // else assume deg/s already

    if (calibrating) {
      bias.x += s.x; bias.y += s.y; bias.z += s.z;
      sampleCount++;
	if (sampleCount >= CAL_SAMPLES) {
	    // FIXME: This assumes same sample rate between calibration and run
        bias.x /= sampleCount; bias.y /= sampleCount; bias.z /= sampleCount;
        calibrating = false;
        last = {t:t, x:s.x - bias.x, y:s.y - bias.y, z:s.z - bias.z};
        angle = {x:0,y:0,z:0};
        print("Calibration done. Bias (deg/s):", bias);
        g.clear();
      } else {
        // show progress
          const pct = Math.round(100*sampleCount/CAL_SAMPLES);
	  g.clear();
          g.drawString("Calibrating: "+pct+"%",10,50);
      }
      return;
    }

    // integrate (trapezoid rule)
    if (!last) {
      last = {t:t, x:s.x - bias.x, y:s.y - bias.y, z:s.z - bias.z};
      return;
    }
    const dt = (t - last.t) / 1000; // s
    // current bias-corrected sample
    const vx = s.x - bias.x;
    const vy = s.y - bias.y;
      const vz = s.z - bias.z;
      print("dt", dt);
      

    angle.x += 0.5 * (last.x + vx) * dt;
    angle.y += 0.5 * (last.y + vy) * dt;
    angle.z += 0.5 * (last.z + vz) * dt;

    last = {t:t, x:vx, y:vy, z:vz};

    // UI update
    iter++;
    if ((iter % 1) === 0) {
      // draw
      g.clear();
	g.setFont("Vector",20);
	s = "Angles (deg):\n";
	s += ""+angle.x.toFixed(2)+", " + angle.y.toFixed(2)+", "+angle.z.toFixed(2)+"\n";
	s += "Rates (deg/s):\n";
	s += ""+vx.toFixed(2)+", "+vy.toFixed(2)+", "+vz.toFixed(2)+"\n";
	s += "Bias (deg/s):\n";
	s += ""+bias.x.toFixed(2)+", "+bias.y.toFixed(2)+", "+bias.z.toFixed(2)+"\n";
	g.drawString(s, 5, 10);
    }

    if ((iter % LOG_EVERY) === 0) {
      console.log("t:",t,"rates(deg/s):",vx.toFixed(3),vy.toFixed(3),vz.toFixed(3),
                  "angles(deg):",angle.x.toFixed(3),angle.y.toFixed(3),angle.z.toFixed(3));
    }
  }

  // Setup and detection
  function init(){
    g.clear();
    g.setFont("Vector",20);
    g.drawString("Gyro test init...", 5, 10);

      const hasEvent = 1;
    if (hasEvent) {
      source = 'event';
      g.drawString("Using Bangle 'gyro' event",5,30);
      // subscribe normally
      unsub = function(){ Bangle.removeListener('gyro', onGyro); };
      Bangle.on('gyro', onGyro);
      startCalibration();
      return;
    }
  }

  // Called by Bangle 'gyro' event if present
  function onGyro(gd) {
    // Bangle.gyro event object format varies; try common keys
    // Common patterns: {x:.., y:.., z:.., timestamp:..}
    const s = { x: gd.x!==undefined ? gd.x : (gd[0]||0),
                y: gd.y!==undefined ? gd.y : (gd[1]||0),
                z: gd.z!==undefined ? gd.z : (gd[2]||0),
                t: gd.t || gd.timestamp || Date.now() };
    processSample(s);
  }

  // Stop helper (tap or button)
  Bangle.on('touch', function() {
    if (unsub) unsub();
    try { Bangle.removeListener('gyro', onGyro); } catch(e){}
    g.clear();
    g.setFont("Vector",20);
    g.drawString("Stopped. See console for final angles.",5,30);
    console.log("FINAL ANGLES (deg):", angle);
  });

g.setColor(0);
init();
