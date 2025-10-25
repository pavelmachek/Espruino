// --- Linux - Bangle glue

function bangle_project(latlong) {
  let degToRad = Math.PI / 180; // degree to radian conversion              
  let latMax = 85.0511287798; // clip latitude to sane values          
  let R = 6378137; // earth radius in m                                
  let lat = latlong.lat;
  let lon = latlong.lon;
  if (lat > latMax) lat=latMax;
  if (lat < -latMax) lat=-latMax;
  let s = Math.sin(lat * degToRad);
  let o = {}
  o.x = R * lon * degToRad;
  o.y = R * Math.log((1 + s) / (1 - s)) / 2;
  print("Project", latlong, o);    
  return o;
}

var bangle_on_map = {}

function bangle_on(event, callback) {
  bangle_on_map[event] = callback;
}

function bangle_setUI(map) {
  if (map.drag) {
    bangle_on_map['drag'] = map.drag;
  }
}

function initWindow(x, y) {
  Bangle.appRect = [ 0, 0, x, y ];
  g = Graphics.createSDL(x, y, 16);
  g.setColor(1,1,1);
  g.fillRect(0, 0, x, y);
  g.flip = print;
}

function onTouch(drag) {
  let d = bangle_on_map['drag'];
  if (d) {
    d(drag);
  }
}

Bangle = {};
Bangle.setGPSPower = print;
Bangle.loadWidgets = print;
Bangle.drawWidgets = print;
Bangle.setUI =  bangle_setUI;
Bangle.project = bangle_project;
Bangle.isCharging = function () { return false; }
Bangle.isCompassOn = function () { return false; }
Bangle.setCompassPower = function (v) {}
Bangle.on = bangle_on;
WIDGETS = false;
E = {};
E.getBattery = function () { return 100; }
E.on("touch", onTouch);
//initWindow(1024, 768);
//initWindow(240, 240);
initWindow(360, 660);

function backdoor(x, y) { //return peek8(x);
}
//function backdoor(x, y) { return g.getPixel(x, 0); }

function sdl_drag(is_down) {
  let drag = {}
  drag.b = is_down;
  drag.x = backdoor(5,0);
  drag.y = backdoor(6.0);
  print("...mouse down", drag.x, drag.y);
  let d = bangle_on_map['drag'];
  if (d) {
    d(drag);
  }
}

var sdl_is_down = false;

function sdl_key(key) {
  switch(key) {
  case 65:
    break;
  }
  let d = bangle_on_map['key'];
  if (d) {
    d(key);
  }
}

function sdl_poll() {
  e = backdoor(0, 0);
  while (e) {
    type = backdoor(1, 0);
    switch(type) {
    case 1: //print("...window in?");
      break;
    case 2:
      let key = backdoor(2, 0);
      print("...key down", key);
      sdl_key(key);
      break;
    case 3: print("...key up"); break;
    case 4:
      if (sdl_is_down) {
	print("...move");
	sdl_drag(true);
      }
      break;
    case 5:
      sdl_is_down = true;
      sdl_drag(true);
      break;
    case 6: sdl_is_down = false; sdl_drag(false); print("...mouse up"); break;
    case 12: print("...exit"); quit(); break;
    default: print("...type:", type); break;
    }
    e = backdoor(0, 0);
  }

    if (bangle_on_map["accel"]) {
	print("handle accel");
	emulate_accel();
    }
    if (bangle_on_map["mag"]) {
	print("handle mag");
    }
}

// Sensors handling ------------------------------------------------------------------------------

const fs = require('fs');

const IIO_BASE = '/sys/bus/iio/devices';
const SAMPLE_INTERVAL_MS = 40;

// --- Utility functions ---
function readFloatFile(filePath) {
  try {
    const s = fs.readFileSync(filePath, 'utf8').trim();
    return parseFloat(s);
  } catch (_) {
    return NaN;
  }
}

function path_join(a,b) { return a+'/'+b; }

function listIIODeviceDirs() {
  return fs.readdirSync(IIO_BASE)
           .filter(f => f.startsWith('iio:device'))
           .map(f => path_join(IIO_BASE, f));
}

function fs_existsSync(p) {
    print("Test", p);
    try {
	return require("fs").readFile(p)!==undefined;
    } catch (_) {
	return false;
    }
}

// --- Search for accelerometer device ---
// Librem5:
// echo 80 | sudo tee /sys/bus/iio/devices/iio:device1/sampling_frequency
// echo 119 | sudo tee /sys/bus/iio/devices/iio:device2/sampling_frequency

function findAccelDevice() {
    for (const devPath of listIIODeviceDirs()) {
	print("Probing", devPath);
    const x = path_join(devPath, 'in_accel_x_raw');
    const y = path_join(devPath, 'in_accel_y_raw');
    const z = path_join(devPath, 'in_accel_z_raw');
    if (fs_existsSync(x) && fs_existsSync(y) && fs_existsSync(z)) {
      return devPath;
    }
  }
  return null;
}

// --- Initialize ---
const accelDev = findAccelDevice();
if (!accelDev) {
  console.error('No accelerometer device found under', IIO_BASE);
  process.exit(1);
}
console.log('Using accelerometer at', accelDev);

// --- Read file paths dynamically ---
const RAW_X = path_join(accelDev, 'in_accel_x_raw');
const RAW_Y = path_join(accelDev, 'in_accel_y_raw');
const RAW_Z = path_join(accelDev, 'in_accel_z_raw');

function optionalScaleFile(name) {
  const f = path_join(accelDev, name);
  return fs_existsSync(f) ? f : null;
}

const SCALE_X = optionalScaleFile('in_accel_x_scale');
const SCALE_Y = optionalScaleFile('in_accel_y_scale');
const SCALE_Z = optionalScaleFile('in_accel_z_scale');

// --- Poll accelerometer and emit ---
function readAccelSample() {
  const rawX = readFloatFile(RAW_X);
  const rawY = readFloatFile(RAW_Y);
  const rawZ = readFloatFile(RAW_Z);

  const scaleX = SCALE_X ? readFloatFile(SCALE_X) : 1;
  const scaleY = SCALE_Y ? readFloatFile(SCALE_Y) : 1;
  const scaleZ = SCALE_Z ? readFloatFile(SCALE_Z) : 1;

  const x = rawX * scaleX / 1000;
  const y = rawY * scaleY / 1000;
  const z = rawZ * scaleZ / 1000;
  const mag = Math.sqrt(x*x + y*y + z*z);

  const acc = { x, y, z, mag, td: SAMPLE_INTERVAL_MS/1000 };
  return acc;
}

function emulate_accel() {
  const acc = readAccelSample();
  Bangle._last = acc;
  let d = bangle_on_map['accel'];
  if (d) {
    d(acc);
  }
    
}

print("Test being loaded");
setInterval(sdl_poll, 15000);

// --- end glue
