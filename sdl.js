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

function sdl_key(key) {
    switch(key) {
    case 65:
	break;
    }
}

function sdl_poll() {
    e = g.getPixel(0, 0);
    if (e) {
	type = g.getPixel(1, 0);
	switch(type) {
	case 1: //print("...window in?");
	    break;
	case 2:
	    let key = g.getPixel(2, 0);
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
	case 12: print("...exit"); break;
	default: print("...type:", type); break;
	}
    }
}

print("Test being loaded");
setInterval(sdl_poll, 10);

// --- end glue
