g = Graphics.createSDL(1024, 768, 8);

g.setColor(1,1,1).setFont("Vector",25);
g.setFontAlign(0,0);
g.drawString("SpaceWeaver", 85,35);
g.setColor(1,1,1).setFont("Vector",18);
g.drawString("Vector maps", 85,55);

//E.showMessage("Hello, world");

// Or
//Bangle.setUI({mode:"custom",drag:e=>print(e)});

//    g.flip()

//g.idle();
s = require("http").createServer(print);
s.listen(8080);

function foo() {
    e = g.getPixel(0, 0);
    if (e) {
	type = g.getPixel(1, 0);
	switch(type) {
	case 2: print("...key down"); break;
	case 3: print("...key up"); break;
	case 4: print("...move"); break;
	case 5: print("...mouse down", g.getPixel(5,0), g.getPixel(6.0)); break;
	case 6: print("...mouse up"); break;
	case 12: print("...exit"); break;
	default: print("...type:", type); break;
	}

    }
}

print("Test being loaded");
setInterval(foo, 10);
