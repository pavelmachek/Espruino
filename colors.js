#!bin/espruino

eval(require("fs").readFile("sdl.js"));

R = Bangle.appRect;

function introScreen() {
  g.reset().clearRect(R);
  g.setColor(0,0,0).setFont("Vector",25);
  g.setFontAlign(0,0);
  g.drawString("Hello", 85,35);
  g.setColor(0,0,0).setFont("Vector",18);
  g.drawString("Press button", 85,55);
}

function redraw() {
}

function emptyMap() {
  Bangle.setUI({mode:"custom",drag:e=>{
      g.reset().clearRect(R);
      redraw();    
  }, btn: btn=>{
    print("Button pressed");
  }});
}

introScreen();
emptyMap();




