#!bin/espruino

var pc = 1;
if (pc)
  eval(require("fs").readFile("sdl.js"));

// in ~/g/tui/bwatch/ there's version that can do post
// curl -s "ntfy.sh/bangle/json?poll=1&since=latest"

// -> chit chat?

/* SecClock library v0.2
   clocks with seconds
   draws time in space-effecient manner */

/* calling parent methods like super...() does not really
   work. super() works with constructor.
   
   callbacks with class functions do not really work.
   Use => to get something working.
 */

class SecClock {
  constructor() {
    this.show_seconds = false;
    this.debug = false;
    this.timeout = 0;
  }
  draw() {
    this.now = new Date();
    this.draw_all();
  }
  draw_all() {
    g.reset().setColor(1,1,1);
    // Clear the screen area below the widgets (assuming widgets are at the top, roughly 24px)
    let y = 24;
    g.fillRect(0, y, g.getWidth(), g.getHeight());
    
    if (!this.debug) {
    y = this.draw_top(24);
    y = this.draw_bottom(y);
    } else this.draw_debug();
    this.schedule_draw();
    return y;
  }
  draw_top(y) {
    g.setColor(0,0,0);

    var d = this.now;
    var h = d.getHours();
    var m = d.getMinutes();

    var hStr = (" " + h).slice(-2);
    var mStr = ("0" + m).slice(-2);

    var tensH = hStr.charAt(0);
    var onesH = hStr.charAt(1);
    var tensM = mStr.charAt(0);
    var onesM = mStr.charAt(1);

    // Layout configuration
    var startX = 47;
    var startY = y + 2;

    // 1. Tens of Hours (Even smaller font)
    g.setFont("Vector", 40);
    g.drawString(tensH, startX, startY + 10);
    var w1 = g.stringWidth(tensH);

    // 2. Ones of Hours (Vector 60)
    g.setFont("Vector", 60);
    g.drawString(onesH, startX + w1, startY);
    var w2 = g.stringWidth(onesH);

    g.fillCircle(startX + w1 + w2 - 1, startY + 25, 3);
    g.fillCircle(startX + w1 + w2 - 1, startY + 40, 3);

    // 3. Tens of Minutes (Vector 60)
    g.setFont("Vector", 60);
    g.drawString(tensM, startX + w1 + w2 + 6, startY);
    var w3 = g.stringWidth(tensM);

    // 4. Ones of Minutes (Smaller font)
    g.setFont("Vector", 50);
    g.drawString(onesM, startX + w1 + w2 + w3 + 3, startY + 5);
    
    let now = d;
    let days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    let dateStr = days[now.getDay()] + "\n" + now.getDate();
    dateStr += "\n" + this.get_extra();
    g.setFont("Vector", 25);
    g.drawString(dateStr, 2, startY);
    return startY + 60;
  }
  draw_bottom(startY) {
    if (!this.show_seconds)
      return;
    this.draw_bottom_seconds(startY);
  }
  draw_bottom_seconds(startY) {
    let d = this.now;
    var m = d.getSeconds();
    var s = ("0" + m).slice(-2);

    g.setFont("Vector", 30);
    g.drawString(s, 140, startY);
  }
  get_extra() {
    let bat = E.getBattery();
    if (bat < 30)
      return "BAT"; 
    return "";
  }
  on_lock() {
    this.show_seconds = !Bangle.isLocked();
    this.draw();
  }
  cancel_draw() {
    if (this.timeout)
      clearTimeout(this.timeout);
    this.timeout = 0;
  }
  schedule_draw() {
    if (!this.show_seconds)
      next = 60000;
    else
      next =  1000;
    this.cancel_draw();
    this.timeout = setTimeout(() => this.draw(), next - (Date.now() % next));
  }
  click_top_left() {}
  click_top_right() {}
  click_bottom_left() {
    this.debug = !this.debug;
  }
  click_bottom_right() {}
  on_touch(button, xy) {
    let yLimit = g.getHeight() / 2; // Bottom active zone
    if (xy.y > yLimit) {
      if (xy.x < g.getWidth() / 2) {
        this.click_bottom_left();
      } else {
        this.click_bottom_right();
      }
    } else {
      if (xy.x < g.getWidth() / 2) {
        this.click_top_left();
      } else {
        this.click_top_right();
      }
    }
    Bangle.buzz(50);
    clock.draw();
  }
}

class Ntfy extends SecClock {
  constructor() {
    super();
    this.url = "http://ntfy.sh/bangle/json?poll=1&since=latest";
  }

  draw(text) {
    // Clear the screen
    g.reset().clear();

    g.setFont("Vector", 36);
    g.setFontAlign(0, 0); // Center horizontally & vertically
    g.drawString(text, g.getWidth()/2, 20);

    // Refresh screen (for Bangle.js 2 memory-LCD)
    g.flip();
  }

  fetch() {
    g.clear();
    g.setFont("Vector", 24);
    g.setFontAlign(0, 0);
    g.drawString("Loading...", g.getWidth()/2, g.getHeight()/2);
    g.flip();

    // Use Bangle.http to offload the request via the connected phone
    Bangle.http(this.url, { method: "GET" })
      .then(data => {
        // Parse the JSON response text
        let json = JSON.parse(data.resp);
        
        this.draw(json.title + "\n" + json.message);
      })
      .catch(err => {
        console.log("Error fetching weather:", err);
        g.reset().clear();
        g.setFont("Vector", 24);
        g.drawString("Fetch Failed!\nCheck phone\nlink.", 10, g.getHeight()/2);
        g.flip();
      });
  }
}

var clock = new SecClock();

Bangle.on('touch', (button, xy) => clock.on_touch(button, xy));
Bangle.on('lock', () => clock.on_lock());

if (0) {
Bangle.loadWidgets();
Bangle.drawWidgets();
}

clock.draw();

ntfy = new Ntfy();
// Run immediately on boot / upload
ntfy.fetch();


