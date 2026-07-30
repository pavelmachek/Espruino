#!bin/espruino
eval(require("fs").readFile("sdl.js"));

// Storm watch

print("uploading droid test");

function msg(s) {
  print(s);
  g.clear();
  g.setFont("Vector", 48);
  g.drawString(s, 10, 10);
  g.flip();
}

msg("uploading\ndroid");

function getUrl(url, cb) {
  const https = require("http");
  console.log("Fetching url...");

  https.get(url, (res) => {
    let rawData = "";

    // A chunk of data has been received
    res.on("data", (chunk) => {
      rawData += chunk;
    });

    // The whole response has been received
    res.on("end", () => {
      cb(rawData);
    });
  });
}

function BgetUrl(url, cb) {
  Bangle.http(url).then(result => {
    print("Got http data");
    cb(result.resp)
  }).catch(err => {
    print("http\nerror");
  });
}

function htest() {
  let url = "https://api.open-meteo.com/v1/forecast?latitude=51.5085&longitude=-0.1257&current_weather=true";
  
  msg(".oO\nhttp");
  getUrl(url, result => {
    print("Go result", result);
    let data = JSON.parse(result);
    let temp = data.current_weather.temperature;
    let weatherCode = data.current_weather.weathercode;
  
    msg("Temp:\n" + temp + "\nC");
  });
}

function draw() {
  g.reset().clear();
  let now = new Date();

  // 1. Draw Date & Day of Week
  let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let dateStr = days[now.getDay()] + " " + now.getDate();
  let bat = E.getBattery();
  if (bat < 30)
    dateStr += " BAT";
  g.setFont("Vector", 28);
  g.setColor(0, 0, 0);
  g.setFontAlign(0, -1);
  g.drawString(dateStr, g.getWidth() / 2, 2);

  // 2. Build Time String
  let num = 10;
  let fontSize = 58;
  let xstart = 12;
  g.setFont("Vector", fontSize);

  {
    let n = now;
  
    let hours = ("0" + n.getHours()).slice(-2);
    let minutes = ("0" + n.getMinutes()).slice(-2);
    let timeStr = hours + ":" + minutes;
  
    g.setColor(0, 0, 0); // Black text
    g.setFontAlign(-1, -1);
    g.drawString(timeStr, xstart, 25+fontSize / 2, fontSize);
  }

  // 4. Draw Status Area (Uncertainty & GPS status)
  fontSize = 28;
  g.setFont("Vector", fontSize);
  g.setFontAlign(-1, -1);
  g.setColor(0, 0, 0);

  let statusText = "(hello)";
  g.drawString(statusText, 5, g.getHeight() - 2 - fontSize);
  
  //let step = Bangle.getStepCount();
  let step = Bangle.getHealthStatus("day").steps;
  let s;
  let dist = step*0.179*0.001;
  s = dist.toFixed(3) + " km";
  g.drawString(s, 5, g.getHeight() - 2 - fontSize*2);

  if (bat < 65) {
    s = bat + "%";
    g.drawString(s, 5, g.getHeight() - 2 - fontSize*3);
  }

  return;
}

Bangle.on('touch', function(button, xy) {
  let xLimit = g.getHeight() / 2; // Bottom active zone                       
  let yLimit = g.getHeight() / 2; // Bottom active zone                       
  msg("button");
  
  if (xy.y > yLimit) {
    if (xy.x > xLimit) {
      htest();
    }
  }
});

let interval;
function setupRefreshInterval() {
  if (interval) clearInterval(interval);
  let rate = Bangle.isLocked() ? 60000 : 1000;
  interval = setInterval(draw, rate);
  draw();
}

Bangle.on('lock', setupRefreshInterval);
Bangle.on('GB', (s) => { msg(s); });
htest();
msg("droid\ntest\nready");

// weather.js

// Example coordinates for London, UK (Latitude: 51.5074, Longitude: -0.1278)
const LATITUDE = 51.5074;
const LONGITUDE = -0.1278;

const city = "London";

function printWeather(rawData) {
  const data = JSON.parse(rawData);
  const current = data.current_weather;

  console.log("\n--- Current Weather ---");
  console.log(`City          : ${city}`);
  console.log(`Temperature   : ${current.temperature} °C`);
  console.log(`Wind Speed    : ${current.windspeed} km/h`);
  console.log(`Wind Direction: ${current.winddirection}°`);
  console.log(`Time          : ${current.time}`);
}

function getWeather() {
  getUrl(`https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current_weather=true`, printWeather);
}

//getWeather();
