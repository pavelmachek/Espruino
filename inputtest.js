#!bin/espruino

eval(require("fs").readFile("sdl.js"));

while (1) {
  r = peek8(17);
  if (r)
    print(r);
}
