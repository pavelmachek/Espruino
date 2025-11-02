/* This is primarily maintained in the tui/bwatch . */

eval(require("fs").readFile("sdl.js"));

/* Compass calibration code.

   adapted from tui/tricorder/compass.py
   
   This is not great, really needs tilt calibration. To 
   demonstrate, turn the watch so that north is at 45 degrees,
   then play with tilt.
   
   magnav app includes tilt compensation.
   
   This works fairly well when 
   
   >calib_scale
={ x: 0.82581648522, y: 0.89393939393, z: 1.49157303370 }
>calib_offset
={ x: -619.5, y: 925, z: 645 }

*/

let vMin;
let vMax;
let heading = 0;
let sc = [0, 0, 0];
let vh = [0, 0, 0];
let vFirst = [0, 0, 0];

// Reset calibration
function resetCalib() {
  vMin = [10000, 10000, 10000];
  vMax = [-10000, -10000, -10000];
}

// Update calibration
function stepCalib(v) {
  let bad = false;
  for (let i = 0; i < 3; i++) {
    if (v[i] < vMin[i]) {
      vMin[i] = v[i];
      bad = true;
    }
    if (v[i] > vMax[i]) {
      vMax[i] = v[i];
      bad = true;
    }
  }
  return bad;
}

// Normalize vector
function magNorm(x, y, z) {
  return Math.sqrt(x * x + y * y + z * z);
}

let v = [0, 0, 0];
let bad = false;

// --- utilities ---
function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }
function degreesToPixels(deg, width) { return (deg / 90) * (width / 2.1); }
function toPos(incl, az, width, height) {
  let h = toRad(az);
  let x = Math.sin(h) * degreesToPixels(incl, width);
  let y = -Math.cos(h) * degreesToPixels(incl, width);
  x = width / 2 + x;
  y = height / 2 + y;
  return { x, y };
}

// --- drawing ---
function drawBackground(g, width, height) {
  g.reset().clear();
  g.setColor(0, 0, 0);
  const cx = width / 2, cy = height / 2;

  // Crosshair
  g.drawLine(0, cy, width, cy);
  g.drawLine(cx, 0, cx, height);

  // Circles
  for (let rdeg of [30, 60, 90]) {
    g.drawCircle(cx, cy, degreesToPixels(rdeg, width));
  }
}

function drawCompass(g, width, height, heading) {
  const cx = width / 2, cy = height / 2;

  // Heading arrow
  const rad = -toRad(heading);
  const x2 = cx + Math.sin(rad - 0.1) * 80;
  const y2 = cy - Math.cos(rad - 0.1) * 80;
  const x3 = cx + Math.sin(rad + 0.1) * 80;
  const y3 = cy - Math.cos(rad + 0.1) * 80;
  
  g.fillPoly([cx, cy, x2, y2, x3, y3]);
}

function drawAccel(g, width, height) {
  const cx = width / 2, cy = height / 2;
  const acc = Bangle.getAccel();

  const x2 = cx + acc.x * width;
  const y2 = cy + acc.y * width;
  g.setColor(0,0,1);
  
  g.drawCircle(x2, y2, width/8);
}

function drawCalibBox(g, width, height) {
  let scale = 0.15;
  let boxW = (vMax[0] - vMin[0]) * scale;
  let boxH = (vMax[1] - vMin[1]) * scale;
  let boxX = (vMin[0] - vFirst[0]) * scale + width / 2;
  let boxY = (vMin[1] - vFirst[1]) * scale + height / 2;
  
  let x = (v[0] - vFirst[0]) * scale + width / 2;
  let y = (v[1] - vFirst[1]) * scale + height / 2;
  
  //print("box:", boxX, boxY, boxX + boxW, boxY + boxH, x, y);

  g.setColor(bad ? 1 : 0, bad ? 0 : 0.6, 0);
  g.fillRect(boxX, boxY, boxX + boxW, boxY + boxH);

  // Current magnetometer point
  g.setColor(1, 1, 0);
  g.fillCircle(x, y, 3);
}

function readCompass() {
  const c = Bangle.getCompass();
  if (!c) return null;
  v = [c.x, c.y, c.z];
  return v;  
}

// --- update loop ---
function update() {
  v = readCompass();
  if (v == null)
    return;
  bad = stepCalib(v);

  // Calibration compensation
  let vh = [], sc = [];
  for (let i = 0; i < 3; i++) {
    vh[i] = v[i] - (vMin[i] + vMax[i]) / 2;
    sc[i] = (v[i] - vMin[i]) / (vMax[i] - vMin[i]) * 2 - 1;
  }
  heading = (Math.atan2(sc[1], sc[0]) * 180 / Math.PI) - 90;
  while (heading < 0) heading += 360;

  // Draw everything
  g.clear();
  let s = g.getWidth();
  drawBackground(g, s, s);
  drawCalibBox(g, s, s);
  drawAccel(g, s, s);
  g.setColor(1, 0, 0);
  drawCompass(g, s, s, heading);
  g.setColor(0, 0, 0);
  if (calib_done) {
  heading2 = tiltfixread(calib_offset, calib_scale);
    drawCompass(g, s, s, heading2);
    
    
  // Label
    g.setColor(0);
  g.setFont("Vector", 20);
  g.drawString(heading2.toFixed(0) + "°", 10, 10);

  }
}

// "Calibrate" soft button
Bangle.setUI("updown", dir => {
  if (dir === 1) resetCalib();
});

// Paint debug visualization on screen
function paint(v) {
  g.clear();
  
  const s = g.getWidth();

  const cx = s/2, cy = s/2;
  const si = s * 0.45;
  g.setColor(1);
  g.drawCircle(cx, cy, si);

  // Debug axes
  g.drawLine(cx, cy, cx + v[0] * si, cy);
  g.drawLine(cx, cy, cx, cy - v[1] * si);

  // Heading arrow
  const rad = heading * Math.PI / 180;
  const x2 = cx + Math.cos(rad + 0.1) * si * 0.8;
  const y2 = cy - Math.sin(rad + 0.1) * si * 0.8;
  const x3 = cx + Math.cos(rad - 0.1) * si * 0.8;
  const y3 = cy - Math.sin(rad - 0.1) * si * 0.8;
  g.fillPoly([cx, cy, x2, y2, x3, y3]);

  // Label
  g.setFont("Vector", 20);
  g.drawString(heading.toFixed(0) + "°", 10, 10);

  g.flip();
}

// Compute heading and calibration
function update_old() {
  const c = Bangle.getCompass();
  if (!c) return;

  const v = [c.x, c.y, c.z];
  stepCalib(v);

  for (let i = 0; i < 3; i++) {
    vh[i] = v[i] - (vMin[i] + vMax[i]) / 2;
    sc[i] =
      (v[i] - vMin[i]) / (vMax[i] - vMin[i]) * 2 - 1;
  }

  // Compute heading
  heading = (Math.atan2(sc[1], sc[0]) * 180 / Math.PI) - 270;
  while (heading < 0) heading += 360;

  paint(sc);
}

function updateCompass() {
  update();
}

function tiltCalibrate(min, max) {
       var offset = {x:(max.x+min.x)/2,y:(max.y+min.y)/2,z:(max.z+min.z)/2};
       var delta  = {x:(max.x-min.x)/2,y:(max.y-min.y)/2,z:(max.z-min.z)/2};
       var avg = (delta.x+delta.y+delta.z)/3;
       var scale = {x:avg/delta.x, y:avg/delta.y, z:avg/delta.z};
       calib_offset = offset;
       calib_scale = scale;
       calib_done = true;
       print("Calibration done", offset, scale);
}

calibrate = () => {
  var max={x:-32000, y:-32000, z:-32000},
      min={x:32000, y:32000, z:32000};
  var ref = setInterval(()=>{
      var m = Bangle.getCompass();
      max.x = m.x>max.x?m.x:max.x;
      max.y = m.y>max.y?m.y:max.y;
      max.z = m.z>max.z?m.z:max.z;
      min.x = m.x<min.x?m.x:min.x;
      min.y = m.y<min.y?m.y:min.y;
      min.z = m.z<min.z?m.z:min.z;
  }, 100);
  return new Promise((resolve) => {
     setTimeout(()=>{
       if(ref) clearInterval(ref);
       tiltCalibrate(min, max);
       resolve({offset:calib_offset,scale:calib_scale});
     },20000);
  });
};

function tiltfixread(O,S) {
  var m = Bangle.getCompass();
  var g = Bangle.getAccel();
  m.dx =(m.x-O.x)*S.x; m.dy=(m.y-O.y)*S.y; m.dz=(m.z-O.z)*S.z;
  var d = Math.atan2(-m.dx,m.dy)*180/Math.PI;
  if (d<0) d+=360;
  var phi = Math.atan(-g.x/-g.z);
  var cosphi = Math.cos(phi), sinphi = Math.sin(phi);
  var theta = Math.atan(-g.y/(-g.x*sinphi-g.z*cosphi));
  var costheta = Math.cos(theta), sintheta = Math.sin(theta);
  var xh = m.dy*costheta + m.dx*sinphi*sintheta + m.dz*cosphi*sintheta;
  var yh = m.dz*sinphi - m.dx*cosphi;
  var psi = Math.atan2(yh,xh)*180/Math.PI;
  if (psi<0) psi+=360;
  return psi;
}

function calib_done(v) {
  print("Calibration done: ",v);
}

var calib_done = false;
calibrate(calib_done);

Bangle.loadWidgets();
Bangle.drawWidgets();

resetCalib();
vFirst = readCompass();
setInterval(updateCompass, 100);

Bangle.setCompassPower(1);
