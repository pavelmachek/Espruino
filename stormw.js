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

let w_current = null;
let w_hourly = null;
let w_daily = null;
let mode = "hourly";

function draw_current() {
  w = w_current;
  g.setColor(1,1,1);
  g.fillRect(0, 88, 176, 176);
  
  g.setColor(0,0,0);
  g.setFont("Vector", 29);
  g.drawString(w.temperature + " C\n" + w.weathercode + "\n" + w.windspeed + "km/h\n", 2, 88);
}

function scale(y0, h, v) {
  if (v < 0)
    v = 0;
  if (v > 1)
    v = 1;
  return y0 - v * h;
}
function scale_temp(y0, h, v) { return scale(y0, h, (v - 10) / 30); }
function scale_wind(y0, h, v) { return scale(y0, h, v / 30); }
function scale_rain(y0, h, v) { return scale(y0, h, v / 10); }

function thickLine(a, b, c, d) {
  g.drawLine(a, b-1, c, d-1);
  g.drawLine(a, b, c, d);
  g.drawLine(a, b+1, c, d+1);
}

function draw_daily() {
  g.setColor(1,1,1);
  g.fillRect(0, 88, 176, 176);

  let data = w_daily;
  if (!data)
    return;
  print(data);

  // Title
  g.setColor(0,0,0);
  g.setFont("6x15", 1);
  g.drawString("Daily Weather", 5, 92);

  let x0 = 20, y0 = 165, w = 140, h = 50;
  let n = data.time.length;
  let dx = w / (n - 1);

  // Draw axes
  g.setColor(0.5, 0.5, 0.5);
  g.drawLine(x0, y0, x0 + w, y0);
  g.drawLine(x0, y0, x0, y0 - h);

  // Plot lines
  for (let i = 0; i < n - 1; i++) {
    let px1 = x0 + (i * dx), px2 = x0 + ((i + 1) * dx);

    // Scaling factor (Temp range roughly 10 to 40)
    g.setColor(1, 0, 0); // Red for Max Temp
    let tMaxY1 = scale_temp(y0, h, data.temperature_2m_max[i]);
    let tMaxY2 = scale_temp(y0, h, data.temperature_2m_max[i+1]);
    thickLine(px1, tMaxY1, px2, tMaxY2);

    let tMinY1 = scale_temp(y0, h, data.temperature_2m_min[i]);
    let tMinY2 = scale_temp(y0, h, data.temperature_2m_min[i+1]);
    thickLine(px1, tMinY1, px2, tMinY2);

    g.setColor(0, 1, 0); // Green for wind
    let Y1 = scale_wind(y0, h, data.wind_speed_10m_max[i]);
    let Y2 = scale_wind(y0, h, data.wind_speed_10m_max[i+1]);
    thickLine(px1, Y1, px2, Y2);

    g.setColor(0, 0, 1); // Blue for rain
    Y1 = scale_rain(y0, h, data.precipitation_sum[i]);
    Y2 = scale_rain(y0, h, data.precipitation_sum[i+1]);
    thickLine(px1, Y1, px2, Y2);
  }
}

function draw_hourly() {
  g.setColor(1,1,1);
  g.fillRect(0, 88, 176, 176);

  let data = w_hourly;
  if (!data)
    return;
  print(data);

  // Slice next 6 hours
  let times = data.time.slice(0, 48);
  let temps = data.temperature_2m.slice(0, 48);
  // FIXME: this will start at midnight
  // print(times, temps);

  let d = new Date();

  // Get the current hour in UTC (0-23)
  let utcHour = d.getHours() - (d.getTimezoneOffset() / 60);

  print("utc:", utcHour);

  // Title
  g.setColor(0,0,0);
  g.setFont("6x15", 1);
  g.drawString("Hourly", 5, 92);

  let x0 = 20, y0 = 165, w = 140, h = 50;
  let n = times.length;
  let dx = w / (n - 1);

  // Draw axes
  g.setColor(0.5, 0.5, 0.5);
  g.drawLine(x0, y0, x0 + w, y0);
  g.drawLine(x0, y0, x0, y0 - h);

  // Plot temperature line (Yellow/Green)
  for (let i = 0; i < n - 1; i++) {
    let px1 = x0 + (i * dx), px2 = x0 + ((i + 1) * dx);

    if (i == utcHour) {
      g.setColor(0, 0, 0);
      thickLine(0, y0-h, px1, y0-h);
      thickLine(px1, y0-h, px1, y0);
    }      
    
    // Scaling factor (Temp range roughly 15 to 30 for these hours)
    let tY1 = scale_temp(y0, h, temps[i]);
    let tY2 = scale_temp(y0, h, temps[i+1]);

    g.setColor(1, 0, 0);
    thickLine(px1, tY1, px2, tY2);

    g.setColor(0, 1, 0); // Green for wind
    let Y1 = scale_wind(y0, h, data.wind_speed_10m[i]);
    let Y2 = scale_wind(y0, h, data.wind_speed_10m[i+1]);
    thickLine(px1, Y1, px2, Y2);

    g.setColor(0, 0, 1); // Blue for rain
    Y1 = scale_rain(y0, h, data.precipitation[i]);
    Y2 = scale_rain(y0, h, data.precipitation[i+1]);
    thickLine(px1, Y1, px2, Y2);
    
    // Draw small time indicators at the bottom
    g.setColor(0.7, 0.7, 0.7);
    let hourStr = times[i].split("T")[1];
    g.drawString(hourStr, px1 - 6, y0 + 3);
  }
}

function get_url(mode) {
  let url = "https://api.open-meteo.com/v1/forecast?latitude="+pos.lat+"&longitude="+pos.lon;
  if (mode == "cur")
    return url+"&current_weather=true";
  let daily = "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max";
  let hourly = "&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m&current=temperature_2m,weather_code,precipitation,cloud_cover,wind_speed_10m";
  let today = "&forecast_days=2";
  let past_future = "&past_days=1&forecast_days=16";
  if (mode == "daily")
    return url+daily+past_future;
  if (mode == "hourly")
    return url+hourly+today;
}

function dl_current() {
  let url = get_url("cur");
  msg(".oO\ncur");
  BgetUrl(url, result => {
    print("Go result", result);
    let data = JSON.parse(result);
    w_current = data.current_weather;
    draw_current();
  });
}

function dl_daily() {
  let url = get_url("daily");
  msg(".oO\ndaily");
  BgetUrl(url, result => {
    print("Go result", result);
    let data = JSON.parse(result);
    print(data);
    w_daily = data.daily;
  });
}

function dl_hourly() {
  let url = get_url("hourly");
  msg(".oO\ndaily");
  BgetUrl(url, result => {
    print("Go result", result);
    let data = JSON.parse(result);
    print(data);
    w_hourly = data.hourly;
  });
}

function download() {
  if (mode == "cur")
    return dl_current();
  if (mode == "daily")
    return dl_daily();
  if (mode == "hourly")
    return dl_hourly();
}

function draw_any() {
  if (mode == "cur")
    return draw_current();
  if (mode == "daily")
    return draw_daily();
  if (mode == "hourly")
    return draw_hourly();
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
    g.drawString(timeStr, xstart, 30, fontSize);
  }

  //draw_current(w_current);
  draw_any();
  return;

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
      draw_current();
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

Bangle.on('GB', (s) => { msg(s); });
download();
msg("droid\ntest\nready");
Bangle.on('lock', setupRefreshInterval);
//draw_current();
//draw_daily();
//draw_hourly();

