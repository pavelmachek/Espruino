// ---

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

Bangle = {};
Bangle.setGPSPower = print;
Bangle.loadWidgets = print;
Bangle.drawWidgets = print;
Bangle.setUI = print;
Bangle.appRect = [0, 0, 1024, 768 ];
Bangle.project = banglejs_project;
WIDGETS = [];
g = Graphics.createSDL(1024, 768, 8);
g.setColor(1,1,1);
g.fillRect(0, 0, 1024, 768);
g.flip = print;

function sdl_poll() {
    e = g.getPixel(0, 0);
    if (e) {
	type = g.getPixel(1, 0);
	switch(type) {
	case 1: //print("...window in?");
	    break;
	case 2: print("...key down", g.getPixel(2, 0)); break;
	case 3: print("...key up"); break;
	case 4: // print("...move");
	    break;
	case 5: print("...mouse down", g.getPixel(5,0), g.getPixel(6.0)); break;
	case 6: print("...mouse up"); break;
	case 12: print("...exit"); break;
	default: print("...type:", type); break;
	}
    }
}

print("Test being loaded");
setInterval(sdl_poll, 10);

// ---
g.setColor(0,0,0).setFont("Vector",25);
g.setFontAlign(0,0);
g.drawString("SDL test", 85,35);
g.setColor(0,0,1).setFont("Vector",18);
g.drawString("input", 85,55);

