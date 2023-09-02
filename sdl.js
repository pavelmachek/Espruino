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

Bangle = {};
Bangle.setGPSPower = print;
Bangle.loadWidgets = print;
Bangle.drawWidgets = print;
Bangle.setUI = print;
Bangle.appRect = [0, 0, 1024, 768 ];
Bangle.project = banglejs_project;
Bangle.on = banglejs_on;
WIDGETS = [];
g = Graphics.createSDL(1024, 768, 8);
g.setColor(1,1,1);
g.fillRect(0, 0, 1024, 768);
g.flip = print;

function sdl_drag() {
	    let drag = {}
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
		sdl_drag();
	    }
	    break;
	case 5:
	    sdl_is_down = true;
	    sdl_drag();
	    break;
	case 6: sdl_is_down = false; print("...mouse up"); break;
	case 12: print("...exit"); break;
	default: print("...type:", type); break;
	}
    }
}

print("Test being loaded");
setInterval(sdl_poll, 10);

// --- end glue

function touchHandler(d) {
  let x = Math.floor(d.x);
  let y = Math.floor(d.y);

  if (1) { /* Just a debugging feature */
    g.setColor(0.25, 0, 0);
    g.fillCircle(x, y, 5);
  }
}

g.setColor(0,0,0).setFont("Vector",25);
g.setFontAlign(0,0);
g.drawString("SDL test", 85,35);
g.setColor(0,0,1).setFont("Vector",18);
g.drawString("input", 85,55);

Bangle.on("drag", touchHandler);
