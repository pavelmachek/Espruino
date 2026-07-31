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

function draw_current() {
  w = w_current;
  g.setColor(1,1,1);
  g.fillRect(0, 88, 176, 176);
  
  g.setColor(0,0,0);
  g.setFont("Vector", 29);
  g.drawString(w.temperature + " C\n" + w.weathercode + "\n" + w.windspeed + "km/h\n", 2, 88);
}

function temp_scale(y0, h, v) {
  return y0 - ((v - 10) / 30) * h;
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

  var x0 = 20, y0 = 165, w = 140, h = 50;
  var n = data.time.length;
  var dx = w / (n - 1);

  // Draw axes
  g.setColor(0.5, 0.5, 0.5);
  g.drawLine(x0, y0, x0 + w, y0);
  g.drawLine(x0, y0, x0, y0 - h);

  // Plot lines
  for (let i = 0; i < n - 1; i++) {
    let px1 = x0 + (i * dx), px2 = x0 + ((i + 1) * dx);

    // Scaling factor (Temp range roughly 10 to 40)
    let tMaxY1 = temp_scale(y0, h, data.temperature_2m_max[i]);
    let tMaxY2 = temp_scale(y0, h, data.temperature_2m_max[i+1]);
    g.setColor(1, 0, 0); // Red for Max Temp
    g.drawLine(px1, tMaxY1, px2, tMaxY2);

    let tMinY1 = temp_scale(y0, h, data.temperature_2m_min[i]);
    let tMinY2 = temp_scale(y0, h, data.temperature_2m_min[i+1]);
    g.setColor(1, 0, 0);
    g.drawLine(px1, tMinY1, px2, tMinY2);
  }
}

function draw_hourly() {
  var fullData = {"time":["2026-07-31T00:00","2026-07-31T01:00","2026-07-31T02:00","2026-07-31T03:00","2026-07-31T04:00","2026-07-31T05:00","2026-07-31T06:00","2026-07-31T07:00","2026-07-31T08:00","2026-07-31T09:00","2026-07-31T10:00","2026-07-31T11:00","2026-07-31T12:00","2026-07-31T13:00","2026-07-31T14:00","2026-07-31T15:00","2026-07-31T16:00","2026-07-31T17:00","2026-07-31T18:00","2026-07-31T19:00","2026-07-31T20:00","2026-07-31T21:00","2026-07-31T22:00","2026-07-31T23:00"],"temperature_2m":[24.4,21.8,20.0,17.9,16.4,18.0,21.5,25.1,28.5,31.2,32.9,32.8,33.9,34.3,35.8,35.9,35.7,34.8,32.0,27.8,27.7,26.5,24.3,21.8],"precipitation":[0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00]};

  // Slice next 6 hours
  var times = fullData.time.slice(0, 6);
  var temps = fullData.temperature_2m.slice(0, 6);

  g.setColor(1,1,1);
  g.fillRect(0, 88, 176, 176);

  // Title
  g.setColor(0,0,0);
  g.setFont("6x15", 1);
  g.drawString("Next 6h Temp", 5, 92);

  var x0 = 20, y0 = 165, w = 140, h = 50;
  var n = times.length;
  var dx = w / (n - 1);

  // Draw axes
  g.setColor(0.5, 0.5, 0.5);
  g.drawLine(x0, y0, x0 + w, y0);
  g.drawLine(x0, y0, x0, y0 - h);

  // Plot temperature line (Yellow/Green)
  for (let i = 0; i < n - 1; i++) {
    let px1 = x0 + (i * dx), px2 = x0 + ((i + 1) * dx);
    
    // Scaling factor (Temp range roughly 15 to 30 for these hours)
    let tY1 = y0 - ((temps[i] - 15) / 20) * h;
    let tY2 = y0 - ((temps[i+1] - 15) / 20) * h;

    g.setColor(1, 0, 0);
    g.drawLine(px1, tY1, px2, tY2);
    
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
  let today = "&forecast_days=1";
  let past_future = "&past_days=1&forecast_days=3";
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
    g.drawString(timeStr, xstart, 30, fontSize);
  }

  //draw_current(w_current);
  draw_daily();
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
//dl_current();
dl_daily();
//dl_hourly();
msg("droid\ntest\nready");
Bangle.on('lock', setupRefreshInterval);
//draw_current();
//draw_daily();
//draw_hourly();

