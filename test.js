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
    print("bar");
}

print("Test being loaded");
print("GetPixel:", g.getPixel(12, 34));
setInterval(foo, 2000);
