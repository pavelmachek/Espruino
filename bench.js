// --- Linux - Bangle glue

function banglejs_project(latlong) {
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

var banglejs_on_map = {}

function banglejs_on(event, callback) {
  banglejs_on_map[event] = callback;
}

function banglejs_setUI(map) {
  if (map.drag) {
    banglejs_on_map['drag'] = map.drag;
  }
}

Bangle = {};
Bangle.setGPSPower = print;
Bangle.loadWidgets = print;
Bangle.drawWidgets = print;
Bangle.setUI =  banglejs_setUI;
Bangle.appRect = [0, 0, 1024, 768 ];
Bangle.project = banglejs_project;
Bangle.on = banglejs_on;
WIDGETS = [];
g = Graphics.createSDL(1024, 768, 8);
g.setColor(1,1,1);
g.fillRect(0, 0, 1024, 768);
g.flip = print;

function sdl_drag(is_down) {
  let drag = {}
  drag.b = is_down;
  drag.x = g.getPixel(5,0);
  drag.y = g.getPixel(6.0);
  print("...mouse down", drag.x, drag.y);
  let d = banglejs_on_map['drag'];
  if (d) {
    d(drag);
  }
}

var sdl_is_down = false;

function sdl_poll() {
    e = g.getPixel(0, 0);
    if (e) {
	type = g.getPixel(1, 0);
	switch(type) {
	case 1: //print("...window in?");
	    break;
	case 2: print("...key down", g.getPixel(2, 0)); break;
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
	case 12: print("...exit"); break;
	default: print("...type:", type); break;
	}
    }
}

print("Test being loaded");
setInterval(sdl_poll, 10);

// --- end glue

R = Bangle.appRect;

function introScreen() {
  g.reset().clearRect(R);
  g.setColor(0,0,0).setFont("Vector",25);
  g.setFontAlign(0,0);
  g.drawString("Benchmark", 85,35);
  g.setColor(0,0,0).setFont("Vector",18);
  g.drawString("Press button", 85,55);
}
function lineBench() {
  /* 500 lines a second on hardware, 125 lines with flip */
  for (let i=0; i<1000; i++) {
    let x1 = Math.random() * 160;
    let y1 = Math.random() * 160;
    let x2 = Math.random() * 160;
    let y2 = Math.random() * 160;
    
    g.drawLine(x1, y1, x2, y2);
    //g.flip();
  }
}
function polyBench() {
  /* 275 hollow polygons a second on hardware, 99 with flip */
  /* 261 filled polygons a second on hardware, 99 with flip */
  for (let i=0; i<1000; i++) {
    let x1 = Math.random() * 160;
    let y1 = Math.random() * 160;
    let x2 = Math.random() * 160;
    let y2 = Math.random() * 160;
    let c = Math.random();
    
    g.setColor(c, c, c);
    g.fillPoly([80, x1, y1, 80, 80, x2, y2, 80], true);
    //g.flip();
  }
}
function checksum(d) {
  let sum = 0;
  for (i=0; i<d.length; i++) {
    sum += (d[i]*1);
  }
  return sum;
}
function linearRead() {
  /* 10000b block -> 8.3MB/sec, 781..877 IOPS
      1000b block -> 920K/sec, 909 IOPS, 0.55 sec
       100b block -> 100K/sec
        10b block -> 10K/sec, 1020 IOPS, 914 IOPS with ops counting
        
      1000b block backwards -- 0.59 sec.
       100b block -- 5.93.
                  backwards -- 6.27
                  random -- 7.13
     checksum 5.97 -> 351 seconds with checksum. 1400bytes/second
   */
     
  let size = 500000;
  let block = 100;
  let i = 0;
  let ops = 0;
  let sum = 0;
  while (i < size) {
    //let pos = Math.random() * size;
    let pos = i;
    //let pos = size-i;
    let d = require("Storage").read("delme.mtar", pos, block);
    //sum += checksum(E.toUint8Array(d));
    i += block;
    ops ++;
  }
  print(ops, "ops", sum);
}
function drawBench(name) {
  g.setColor(0,0,0).setFont("Vector",25);
  g.setFontAlign(0,0);
  g.drawString(name, 85,35);
  g.setColor(0,0,0).setFont("Vector",18);
  g.drawString("Running", 85,55);
  g.flip();
}
function runBench(b, name) {
  drawBench(name);
  g.reset().clearRect(R);

  let t1 = getTime();
  print("--------------------------------------------------");
  print("Running",name);
  b();
  let m = (getTime()-t1) + " sec";
  print("..done in", m);
  drawBench(name);
  g.setColor(0,0,0).setFont("Vector",18);
  g.drawString(m, 85,85);

}
function redraw() {
  //runBench(lineBench, "Lines");
  runBench(polyBench, "Polygons");
  //runBench(linearRead, "Linear read");
}
function showMap() {
  g.reset().clearRect(R);
  redraw();
  emptyMap();
}
function emptyMap() {
  Bangle.setUI({mode:"custom",drag:e=>{
      g.reset().clearRect(R);
      redraw();    
  }, btn: btn=>{
    mapVisible = false;
    var menu = {"":{title:"Benchmark"},
    "< Back": ()=> showMap(),
    /*LANG*/"Run": () =>{
      showMap();
    }};
    E.showMenu(menu);
  }});
}

const st = require('Storage');
const hs = require('heatshrink');

introScreen();
emptyMap();
