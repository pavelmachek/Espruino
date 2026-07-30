#!bin/espruino
eval(require("fs").readFile("sdl.js"));

// Storm watch

let pos = { lat : 50, lon : 14 };

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
    msg("http\nerror");
  });
}

let cur_weather = {};

function draw_weather(w) {
  msg(w.temperature + " C\n" + w.weathercode + "\n" + w.windspeed + "km/h\n");
}

function get_url(mode) {
  let url = "https://api.open-meteo.com/v1/forecast?latitude="+pos.lat+"&longitude="+pos.lon;
  if (mode == "cur")
    return url+"&current_weather=true";
  let daily = "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max";
  let hourly = "&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m&current=temperature_2m,weather_code,precipitation,cloud_cover,wind_speed_10m";
  let today = "&forecast_days=1";
  let past_future = "&past_days=1&forecast_days=3";
  if (mode == "daily")
    return url+daily+past_future;
  if (mode == "hourly")
    return url+hourly+today;
}

// future daily/hourly 
// including past      https://api.open-meteo.com/v1/forecast?latitude=50&longitude=14&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m&current=temperature_2m,weather_code,precipitation,cloud_cover,wind_speed_10m&past_days=1&forecast_days=1

function dl_current() {
  let url = get_url("cur");
  msg(".oO\ncur");
  BgetUrl(url, result => {
    print("Go result", result);
    let data = JSON.parse(result);
    cur_weather = data.current_weather;
    draw_weather(cur_weather);
  });
}

function dl_daily() {
  let url = get_url("daily");
  msg(".oO\ndaily");
  BgetUrl(url, result => {
    print("Go result", result);
    let data = JSON.parse(result);
  });
}

function dl_hourly() {
  let url = get_url("hourly");
  msg(".oO\ndaily");
  BgetUrl(url, result => {
    print("Go result", result);
    let data = JSON.parse(result);
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
      dl_current();
    } else {
      draw_weather(cur_weather);
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
//dl_daily();
dl_hourly();
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
