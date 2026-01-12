#!bin/espruino

eval(require("fs").readFile("sdl.js"));

while (1) {
  r = peek8(17);
  if (r)
    print(r);
}

g.clear();
g.setColor(0, 0, 0);
g.setFont("Vector", 20);
g.drawString("Press buttons", 20, 100);
g.flip();

// button: 1,2,3  (BTN1, BTN2, BTN3)
// state: 1 = pressed, 0 = released
Bangle.on('button', function (button, state) {
  console.log("Button", button, state ? "DOWN" : "UP");

  g.clear();
  g.drawString(
    "BTN" + button + " " + (state ? "DOWN" : "UP"),
    40, 110
  );
  g.flip();
});

