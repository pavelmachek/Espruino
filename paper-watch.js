#!bin/espruino

eval(require("fs").readFile("sdl.js"));

var ink = {
  color: 0, /* ink color */
  isInk: function () { return false; },
  update: function () { },
  setColor: function () {
    g.setBgColor(1-this.color, 1-this.color, 1-this.color);
    g.setColor(this.color, this.color, this.color);
  },
  cls: function () {
    g.fillRect(0, 0, g.getWidth(), g.getHeight());
    this.color = 1-this.color;
    this.setColor();
  }
};

var watch = {
  // Configuration
  // middle of the display
    x: 50,
    y: 50,
  width: 70,
  // In reality, +30 pixels horizontally, +15 vertically

    font: "Vector",
    fontSize: 48,

    battery: 0,
    signal: -100,
    timer: undefined,

    init: function() {
        var self = this;

        this.height = this.width;
      this.fontSize = this.height * 0.70;
      this.circleSize = 3;

        this.timer = setInterval(function() {
            self.battery = E.getBattery();
            self.signal = -50;
            self.draw();
        }, 1000);

        this.draw();
    },

    draw: function() {
        var now = new Date();

        var hour = now.getHours();
        var minute = now.getMinutes();

        var x = this.x;
        var y = this.y;

        var left = x - this.width / 2;
        var right = x + this.width / 2;
        var top = y - this.height / 2;
        var bottom = y + this.height / 2;

        ink.setColor();

        // Hour
        g.setFont(this.font, this.fontSize);
        g.setFontAlign(0, 0);
        g.drawString(hour.toString(), x, y);

        // Minute indicator square
      var mx1 = left;
      var mx2 = right;
      var my1 = top;
      var my2 = bottom;

        this.drawMinutes(mx1, my1, mx2, my2, minute);

        // Signal indicator
        this.drawIndicator(
            left - 12,
            this.signalLevel()
        );

        // Battery indicator
        this.drawIndicator(
            right + 12,
            this.battery
        );
    },

    // Draw minute progress clockwise
    // Starts at the center of the top edge
    drawMinutes: function(x1, y1, x2, y2, minute) {
        var width = x2 - x1;
        var height = y2 - y1;

        var perimeter = 2 * (width + height);
        var length = (minute / 60) * perimeter;

        var cx = (x1 + x2) / 2;

        // At zero minutes: just a dot
        if (minute === 0) {
            g.fillCircle(cx, y1, this.circleSize);
            return;
        }

        // Clockwise path starting at top center
        var segments = [
            [cx, y1, x2, y1],
            [x2, y1, x2, y2],
            [x2, y2, x1, y2],
            [x1, y2, x1, y1],
            [x1, y1, cx, y1]
        ];

        var lengths = [
            width / 2,
            height,
            width,
            height,
            width / 2
        ];

        for (var i = 0; i < segments.length; i++) {
            var s = segments[i];
            var segmentLength = lengths[i];

            if (length <= 0)
                break;

          var len = length / segmentLength;
            var fraction = Math.min(1, len);
          var lx = s[0] + (s[2] - s[0]) * fraction;
          var ly = s[1] + (s[3] - s[1]) * fraction;

            g.drawLine(
                s[0],
                s[1],
                lx,
                ly
            );
          if (len <= 1) {
            g.fillCircle(lx, ly, this.circleSize);
          }

            length -= segmentLength;
        }
    },

    // Convert RSSI to percentage
    signalLevel: function() {
        var level = (this.signal + 100) * 100 / 60;
        return Math.max(0, Math.min(100, level));
    },

    // Vertical indicator
    drawIndicator: function(x, level) {
        var top = this.y - this.height / 2;
        var bottom = this.y + this.height / 2;

        var y = bottom - (level / 100) * (bottom - top);

        g.drawLine(x, top, x, bottom);
        g.fillCircle(x, y, this.circleSize);
    },

    stop: function() {
        if (this.timer)
            clearInterval(this.timer);
    }
};

g.reset();

// Start
watch.init();
