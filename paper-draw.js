#!bin/espruino

eval(require("fs").readFile("sdl.js"));

/*
Bangle.js2, give me simple, black & white drawing application. Should allow brush selection and white/black color select.

*/

if (1) {
  var W = g.getWidth();
  var H = g.getHeight();
  var WIDGETS = 24;
  var TOOLBAR = 50;
  var color = 0;
  var brush = 2;
  var brushes = [1, 2, 4];
  var last = null;

  function black() {
    g.setColor(0, 0, 0);
  }

  function white() {
    g.setColor(1, 1, 1);
  }

  function toolbar() {
    white();
    g.fillRect(0, WIDGETS, W, TOOLBAR);

    black();
    g.drawLine(0, TOOLBAR, W, TOOLBAR);

    g.setFont("Vector", (TOOLBAR - WIDGETS) * 0.5);

    // Black brush
    g.fillRect(5, 29, 40, 46);
    g.setColor(1, 1, 1);
    g.drawString("B", 19, 33);

    // White brush
    g.setColor(1, 1, 1);
    g.fillRect(48, 29, 83, 46);
    black();
    g.drawRect(48, 29, 83, 46);
    g.drawString("W", 58, 33);

    // Brush size
    black();
    g.drawString("S" + brush, 91, 33);

    // Clear
    g.drawRect(137, 29, 171, 46);
    g.drawString("CLR", 140, 33);
  }

  function clearCanvas() {
    white();
    g.fillRect(0, 51, W - 1, H - 1);
  }

  function drawPoint(x, y, px, py) {
    g.setColor(color, color, color);
    //g.setLineWidth(brushes[brush - 1]);

    if (px !== undefined) {
      g.drawLine(px, py, x, y);
    } else {
      g.fillCircle(x, y, brushes[brush - 1]);
    }
  }

  function redraw() {
    toolbar();
  }

  function touch(e) {
    if (e.y < WIDGETS || e.y > TOOLBAR) return;

    if (e.x < 46) {
      print("Draw");
      color = 0;
    } else if (e.x < 87) {
      print("Erase");
      color = 1;
    } else if (e.x < 134) {
      brush++;
      if (brush > 3) brush = 1;
      print("Brush", brush);
    } else {
      print("Clear");
      clearCanvas();
    }

    last = null;
    redraw();
  }

  function drag(e) {
    if (e.b) {
      if (e.y > TOOLBAR) {
        var y = e.y;
        var x = e.x;

        drawPoint(x, y,
                  last ? last.x : undefined,
                  last ? last.y : undefined);

        last = {x:x, y:y};
      } else touch(e);
    } else {
      last = null;
    }
  }

  // Start application
  g.clear(1);
  clearCanvas();
  Bangle.loadWidgets();
  Bangle.drawWidgets();
  toolbar();

  Bangle.on('drag', drag);

  if (0)
  Bangle.setUI({
    mode: "custom",
    back: function() {
      load();
    },
    drag: drag
  });
}
