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
	emulate_mag();
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

function path_join(a, b) { return a + '/' + b; }

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

// --- Generic sensor search ---
function findDevice(prefix) {
  for (const devPath of listIIODeviceDirs()) {
    const x = path_join(devPath, `in_${prefix}_x_raw`);
    const y = path_join(devPath, `in_${prefix}_y_raw`);
    const z = path_join(devPath, `in_${prefix}_z_raw`);
    if (fs_existsSync(x) && fs_existsSync(y) && fs_existsSync(z)) {
      return devPath;
    }
  }
  return null;
}

// --- Initialize ---
const accelDev = findDevice('accel');
const magDev = findDevice('magn');

if (!accelDev) {
  console.error('No accelerometer device found under', IIO_BASE);
  process.exit(1);
}
if (!magDev) {
  console.warn('No magnetometer device found under', IIO_BASE);
}

console.log('Using accelerometer at', accelDev);
if (magDev) console.log('Using magnetometer at', magDev);

// --- Read file paths dynamically ---
function makeRawPaths(devPath, prefix) {
    let scale = null;
    t = path_join(devPath, `in_${prefix}_scale`);
    if (fs_existsSync(t)) scale = t;
    t = path_join(devPath, `in_${prefix}_x_scale`);
    if (fs_existsSync(t)) scale = t;
	
  return {
    x: path_join(devPath, `in_${prefix}_x_raw`),
    y: path_join(devPath, `in_${prefix}_y_raw`),
    z: path_join(devPath, `in_${prefix}_z_raw`),
    scale: scale
  };
}

const accelPaths = makeRawPaths(accelDev, 'accel');
const magPaths = magDev ? makeRawPaths(magDev, 'magn') : null;

print("Have paths: ", accelPaths, magPaths);

// --- Sensor readers ---
function readVectorSample(paths, scaleDiv) {
  const rawX = readFloatFile(paths.x);
  const rawY = readFloatFile(paths.y);
  const rawZ = readFloatFile(paths.z);
  const scale = paths.scale ? readFloatFile(paths.scale) : 1;

  const x = rawX * scale / scaleDiv;
  const y = rawY * scale / scaleDiv;
  const z = rawZ * scale / scaleDiv;
  const mag = Math.sqrt(x * x + y * y + z * z);
  return { x, y, z, mag };
}

function fs_existsSync(p) {
    print("Test", p);
    try {
	return require("fs").readFile(p)!==undefined;
    } catch (_) {
	return false;
    }
}

// Librem5:
// echo 80 | sudo tee /sys/bus/iio/devices/iio:device1/sampling_frequency
// echo 119 | sudo tee /sys/bus/iio/devices/iio:device2/sampling_frequency
// echo 80 | sudo tee /sys/bus/iio/devices/iio:device3/sampling_frequency

function emulate_accel() {
    print("Emulate accel");
    let v = readVectorSample(accelPaths, 10);
    v.x = -v.x;
  let d = bangle_on_map['accel'];
  if (d) {
    d(v);
  }
}

function emulate_mag() {
    print("Emulate mag");
  if (!magPaths) return;
    let v = readVectorSample(magPaths, .01); // magnetometer scaling often in uT already
    v.y = -v.y;
  let d = bangle_on_map['mag'];
  if (d) {
    d(v);
  }
}

// GPS -----------------------------------------------------------------------------------

const GNSS_DEVICE = '/dev/gnss0';

// --- NMEA parsing helpers ---
function parseNMEACoords(coord, hemi) {
  if (!coord) return NaN;
  const deg = parseInt(coord.slice(0, -7), 10);
  const min = parseFloat(coord.slice(-7));
  let val = deg + (min / 60.0);
  if (hemi === 'S' || hemi === 'W') val = -val;
  return val;
}

function knotsToMps(knots) {
  return knots * 0.514444;
}

function gps_parse(v) {
    l = v.split('\n');
    let lat = NaN;
    let lon = NaN;
    let fix = 0
    let alt = NaN;
    let spd = NaN;
    let course = NaN;

    
    for (line of l) {
	print("Line: ", line);
	if (!line.startsWith('$')) continue;
	
	const parts = line.split(',');
	const type = parts[0].substring(3);

	if (type === 'RMC') {
	    lat = parseNMEACoords(parts[3], parts[4]);
	    lon = parseNMEACoords(parts[5], parts[6]);
	    spd = knotsToMps(parseFloat(parts[7]));
	    course = parseFloat(parts[8]);
	}
	
	if (type === 'GGA') {
	    fix = parseInt(parts[6]);
	    alt = parseFloat(parts[9]);
	}
    }

    const gps = { fix, lat, lon, alt, speed: spd, course };
    Bangle._lastGPS = gps;
    print('gps', gps);
}


function test_read() {
    var fd = fs.open("data.bin", "r");
    var buf = new Uint8Array(1);
    for (let i=0; i<100; i++) {
    fs.readSync(fd, buf, 0, 1, 0);
    print("Byte value:", buf[0]);
	fs.closeSync(fd);
    }
}

s = fs.readFileSync("/tmp/delme.gnss", 'utf8');
gps_parse(s);


//f = E.openFile("/etc/passwd")
//f.read(123)?
//test_read();

// Example usage
bangle_on('gps', gps => {
  console.log(`GPS fix=${gps.fix} lat=${gps.lat.toFixed(5)} lon=${gps.lon.toFixed(5)} alt=${gps.alt}`);
});


print("Test being loaded");
setInterval(sdl_poll, 500);

// --- end glue
