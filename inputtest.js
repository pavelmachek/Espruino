#!bin/espruino

eval(require("fs").readFile("sdl.js"));

g.reset().clear();
g.setColor(1, 0, 0);
g.setFont("Vector", 40);
g.drawString("Press buttons", 20, 30);
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

