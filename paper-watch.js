#!bin/espruino
/* -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil; -*- */

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

// Draw an envelope at (x, y), scaled to `size`.
// Pass true for `ussd` to add a # badge.
function drawEnvelope(x, y, size, ussd) {
  var w = size;
  var h = Math.round(size * 0.68);
  var mid = Math.round(w / 2);
  var flapY = Math.round(h * 0.48);

  // Envelope outline
  g.drawRect(x, y, x + w, y + h);

  // Top flap: the two lines meet at its tip
  g.drawLine(x, y, x + mid, y + flapY);
  g.drawLine(x + w, y, x + mid, y + flapY);

  if (0) {
  // Lower folds stop short of the flap tip
  var gap = Math.max(2, Math.round(w * 0.12));
  g.drawLine(x, y + h, x + mid - gap, y + flapY + gap);
  g.drawLine(x + w, y + h, x + mid + gap, y + flapY + gap);
  }

  if (ussd) {
    // # badge at the lower-right
    var bx = x + w - Math.round(size * 0.16);
    var by = y + h - Math.round(size * 0.16);
    var r = Math.max(5, Math.round(size * 0.22));

    g.fillCircle(bx, by, r);
    g.setColor(g.theme.bg);
    g.drawLine(bx - 2, by - 3, bx - 1, by + 3);
    g.drawLine(bx + 2, by - 3, bx + 3, by + 3);
    g.drawLine(bx - 4, by - 1, bx + 4, by - 1);
    g.drawLine(bx - 4, by + 2, bx + 4, by + 2);
    g.setColor(g.theme.fg);
  }
}

function drawHandset(x, y, size) {
  var s = size / 24;
  function p(v) { return Math.round(v * s); }

  // Receiver silhouette, traced around its outside and back along its inside
  var points = [
    [5, 3], [3, 4], [2, 7], [3, 11],
    [6, 15], [10, 19], [14, 21], [18, 22],
    [21, 20], [22, 18], [19, 14], [16, 15],
    [14, 17], [11, 16], [8, 13], [7, 10],
    [9, 8], [8, 5]
  ];

  var polygon = [];
  for (var i = 0; i < points.length; i++) {
    polygon.push(x + p(points[i][0]), y + p(points[i][1]));
  }

  g.fillPoly(polygon);
}

function drawWatch(x, y, width, now, signalLevel, battery) {
        var hour = now.getHours();
    var minute = now.getMinutes();

    var height = width;
    var circleSize = width / 20;

        var left = x - width / 2;
        var right = x + width / 2;
        var top = y - height / 2;
        var bottom = y + height / 2;

        ink.setColor();

        // Hour
        g.setFont("Vector", height * 0.70);
        g.setFontAlign(0, 0);
        g.drawString(hour.toString(), x, y);

        // Minute indicator square
        var mx1 = left;
        var mx2 = right;
        var my1 = top;
    var my2 = bottom;

        // Draw minute progress clockwise
    // Starts at the center of the top edge
    function drawMinutes(x1, y1, x2, y2, minute) {
        var width = x2 - x1;
        var height = y2 - y1;

        var perimeter = 2 * (width + height);
        var length = (minute / 60) * perimeter;

        var cx = (x1 + x2) / 2;

        // At zero minutes: just a dot
        if (minute === 0) {
            g.fillCircle(cx, y1, circleSize);
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
                g.fillCircle(lx, ly, circleSize);
            }

            length -= segmentLength;
        }
    }

    // Vertical indicator
    function drawIndicator(x, level) {
        var top = y - height / 2;
        var bottom = y + height / 2;

        var y = bottom - (level / 100) * (bottom - top);

        g.drawLine(x, top, x, bottom);
        g.fillCircle(x, y, circleSize);
    }
    
        drawMinutes(mx1, my1, mx2, my2, minute);

        // Signal indicator
        drawIndicator(
            left - 12,
            signalLevel
        );

        // Battery indicator
        drawIndicator(
            right + 12,
            battery
        );
}

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

    block: 0,
    numx: 3,
    numy: 4,

    last_hour: -1,

    base_x: 0,
    base_y: 0,
    size: 0,

    move: function() {
        this.height = this.width;
        this.fontSize = this.height * 0.70;
        this.circleSize = this.width / 20;
    },

    jump_to: function() {
        var x = this.block % this.numx;
        var y = Math.floor(this.block / this.numx);

        var w = (g.getWidth() / this.numx);
        this.base_x = x*w;
        this.base_y = y*w;
        this.size = w;
        this.width = w - 30;
        this.x = (x+0.5)*w;
        this.y = (y+0.5)*w;
        this.move();
    },

    jump: function(sx, sy) {
        while (1) {
            if (this.block + 1 >= this.numx*this.numy) {
                this.block = 0;
                ink.cls();
                this.jump_to();
                return;
            }
            this.block += 1;

            x = this.block % this.numx;
            y = Math.floor(this.block / this.numx);
            print("Thinking about", x, y, this.block); 
            if (x + sx > this.numx)
                continue;
            if (y + sy > this.numy) {
                this.block = 999;
                continue;
            }

            this.jump_to();
            return;
        }
    },

    newSms: function() {
        this.jump(1, 1);
        drawEnvelope(this.base_x, this.base_y, this.size, false);
        this.jump(1, 1);
    },

    newCall: function() {
        this.jump(1, 1);
        drawHandset(this.base_x, this.base_y, this.size);
        this.jump(1, 1);
    },

    init: function() {
        var self = this;

        this.timer = setInterval(function() {
            self.battery = E.getBattery();
            self.signal = -50;
            self.draw();
        }, 1000);
    },

    draw: function() {
        var now = new Date();

        var hour = now.getHours();
        var minute = now.getMinutes();

        if (hour != this.last_hour) {
            this.jump(1,1);
        }
        this.last_hour = hour;

        drawWatch(this.x, this.y, this.width, now, this.signalLevel(), this.battery);
    },


    // Convert RSSI to percentage
    signalLevel: function() {
        var level = (this.signal + 100) * 100 / 60;
        return Math.max(0, Math.min(100, level));
    },

    stop: function() {
        if (this.timer)
            clearInterval(this.timer);
    }
};

g.reset();

// Start
watch.init();

