#!bin/espruino

var pc = 1;
if (pc)
  eval(require("fs").readFile("sdl.js"));

// in ~/g/tui/bwatch/ there's version that can do post
// curl -s "ntfy.sh/bangle/json?poll=1&since=latest"

// -> chit chat?

class Ntfy {
  constructor() {
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

ntfy = new Ntfy();
// Run immediately on boot / upload
ntfy.fetch();

// Optional: Refresh data if the user presses the physical button
//setWatch(fetch, BTN1, { repeat: true, edge: "rising" });


