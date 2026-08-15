#!bin/espruino
eval(require("fs").readFile("sdl.js"));

// Storm watch

// Line clock -- provides +-45 min display

// TODO: logarithmic precipation
// show precipation probability?
// something to do with cape?

/* topHalf library v0.0
   draws time in space-effecient manner */

class topHalf {
  draw() {
    g.reset();
    var y = 24;
    // Clear the screen area below the widgets (assuming widgets are at the top, roughly 24px)
    g.clearRect(0, y, g.getWidth(), g.getHeight()/2);

    var d = new Date();
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
    let bat = E.getBattery();
    if (bat < 30)
      dateStr += " \nBAT";
    g.setFont("Vector", 25);
    g.drawString(dateStr, 2, startY);

    this.draw_bottom(startY + 60);
  }
  draw_bottom(startY) {
    g.setFont("Vector", 30);
    g.drawString("10:30 Rain\n11:15 Frogs\n11:40 Armageddon", 2, startY);
  }
  init() {
    g.reset().clear();
    this.draw();
    Bangle.drawWidgets();
    var timer = setInterval(this.draw, 60000);
  }
}

/* rich text library -- ... */
/**
 * Render text with inline font sizes and explicit wrap points.
 *
 * Rich text format:
 *   - Font size changes are written as "<N>" (e.g., "<12>" or "<20>")
 *   - Wrap points are written as "|" and are the ONLY allowed places to wrap
 *   - "|" is not drawn.
 *
 * @param {object} g        - Graphics context (e.g., Bangle's global g)
 * @param {string} str      - Rich text string
 * @param {number} x0       - Start x
 * @param {number} y0       - Start y
 * @param {number} maxW     - Max line width in pixels
 * @param {number} maxLines - Max number of lines to draw (optional; Infinity ok)
 * @param {object} opts      - Options
 *        opts.baseSize   - Default font size before any "<N>" tag (default 10)
 *        opts.lineGap    - Extra pixels between lines (default 2)
 *        opts.align      - "left" | "center" | "right" (default "left")
 */
function renderRichTextWrap(g, str, x0, y0, maxW, maxLines, opts) {
  const baseSize = opts.baseSize ?? 25;
  const lineGap = opts.lineGap ?? 2;
  const align = opts.align ?? "left";
  const scale = opts.scale ?? 1;

  // --------- Font API hook ----------
  // Change this if your Bangle environment uses a different way to set font size.
  // Must also make measureText work consistently with the chosen font.
  function setFontSize(size) {
    // Common on Bangle graphics: g.setFont("6x8", size) isn't standard.
    // Vector fonts often support: g.setFont("Vector", size)
    // If "Vector" isn't available, replace with the correct call for your firmware.
    g.setFont("Vector", size*scale);
  }

  function measureTextWidth(text, size) {
    setFontSize(size);
    return g.stringWidth(text);
  }

  // Height model for line spacing:
  function lineHeight(size) {
    // Vector font often uses size as cap height-ish; this is a practical approximation.
    // If you know exact metrics for your font, adjust here.
    return size + lineGap;
  }

  // --------- Parse into tokens ----------
  // We'll convert the rich string into an array of tokens:
  // - {type:"text", text:"abc", size:N}
  // - {type:"wrap"} for '|'
  const tokens = [];
  let i = 0;
  let currentSize = baseSize;
  let buf = "";

  function flushBuf() {
    if (buf.length) {
      tokens.push({ type: "text", text: buf, size: currentSize });
      buf = "";
    }
  }

  while (i < str.length) {
    const ch = str[i];

    // Wrap point
    if (ch === "|") {
      flushBuf();
      tokens.push({ type: "wrap" });
      i++;
      continue;
    }

    // Font tag: <N>
    if (ch === "<") {
      // find closing '>'
      const j = str.indexOf(">", i + 1);
      if (j !== -1) {
        // flush current before changing size
        flushBuf();
        const numStr = str.slice(i + 1, j).trim();
        const parsed = parseInt(numStr, 10);
        if (!isNaN(parsed) && parsed > 0) {
          currentSize = parsed;
        } else {
          currentSize = baseSize;
        }
        i = j + 1;
        continue;
      }
      // If malformed tag, just treat '<' as normal text
    }

    // Normal character
    buf += ch;
    i++;
  }
  flushBuf();

  // --------- Build wrapped lines ----------
  // Each line will contain segments: {text, size, w}
  const lines = [];
  let line = [];
  let lineW = 0;

  // For "wrap only at |": we need to remember the last wrap point within the current line.
  // We'll track the index in `line` where we can break and the width before it.
  let lastWrap = {
    lineSegCount: null,
    lineWidthAtWrap: null
  };

  function startNewLine() {
    lines.push(line);
    line = [];
    lineW = 0;
    lastWrap = { lineSegCount: null, lineWidthAtWrap: null };
  }

  function alignX(lineSegments, baseX, lineWidth) {
    if (align === "left") return baseX;
    if (align === "center") return baseX - lineWidth / 2;
    if (align === "right") return baseX - lineWidth;
    return baseX;
  }

  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];

    if (tok.type === "wrap") {
      // Candidate wrap point at the current position.
      // Record that if we must break because of width, we can break here.
      lastWrap = {
        lineSegCount: line.length,
        lineWidthAtWrap: lineW
      };
      continue;
    }

    // tok is text segment with fixed size
    const w = measureTextWidth(tok.text, tok.size);

    // If token alone is wider than maxW, we'll still place it, but allow wrapping
    // only at prior '|' points. If no such point exists, we just draw it overflow.
    if (lineW + w > maxW && line.length > 0) {
      // We must wrap. Since wrapping is allowed only at '|' points, use lastWrap if available.
      if (lastWrap.lineSegCount !== null) {
        // Break line at lastWrap
        const keep = line.slice(0, lastWrap.lineSegCount);
        const rest = line.slice(lastWrap.lineSegCount);

        // Commit current line with kept segments
        lines.push(keep);

        // Start new line with the rest segments
        line = rest;
        lineW = lines[lines.length - 1].reduce((acc, s) => acc + s.w, 0);
        // After moving, we should reset wrap markers; but note that we might have been in the
        // middle of a region with earlier '|' markers. Since '|' tokens were not inserted into segments,
        // the marker resets here is correct.
        lastWrap = { lineSegCount: null, lineWidthAtWrap: null };

        // Now try to add current token to new line
        if (lineW + w > maxW && line.length > 0) {
          // If still doesn't fit, but no more wrap points exist, force placement (overflow).
          // That's consistent with "wrap only at |".
        }
        const seg = { text: tok.text, size: tok.size, w };
        line.push(seg);
        lineW += w;
      } else {
        // No wrap point available on this line: we can't legally wrap.
        // Place anyway (overflow) to respect "wrap only at |".
        const seg = { text: tok.text, size: tok.size, w };
        line.push(seg);
        lineW += w;
      }
    } else {
      const seg = { text: tok.text, size: tok.size, w };
      line.push(seg);
      lineW += w;
    }
  }

  // Commit final line
  if (line.length) lines.push(line);

  // --------- Render lines ----------
  let y = y0;
  let drawn = 0;

  for (let li = 0; li < lines.length && drawn < maxLines; li++, drawn++) {
    const segs = lines[li];
    const totalW = segs.reduce((acc, s) => acc + s.w, 0);
    let x = alignX(segs, x0, totalW);

    // Use line height based on the maximum size in this line (more stable)
    let maxSizeInLine = 0;
    for (const s of segs) maxSizeInLine = Math.max(maxSizeInLine, s.size);
    const lh = lineHeight(maxSizeInLine);

    for (const s of segs) {
      setFontSize(s.size);
      // Bangle vector fonts: drawString x,y uses baseline at y (implementation-dependent).
      // If you see vertical misalignment, adjust by a small offset.
      g.drawString(s.text, x, y+(lh-s.size)*0.7);
      x += s.w;
    }

    y += lh;
  }
  return y;
}

top = new topHalf();

const LOCATION_FILE = "mylocation.json";
let pos;

// requires the myLocation app
function loadLocation() {
  pos = require("Storage").readJSON(LOCATION_FILE,1)||{"lat":50,"lon":14.75,"location":"Czechia"};
}

loadLocation();

function msg(s) {
  print("msg", s);
  g.reset().clear();
  g.setFont("Vector", 48);
  g.drawString(s, 10, 10);
  g.flip();
}

function BgetUrl(url, cb) {
  Bangle.http(url).then(result => {
    print("Got http data");
    cb(result.resp)
  }).catch(err => {
    draw_msg("http\nerror");
  });
}

let w_current = null;
let w_hourly = null;
let w_daily = null;
let w_minutely = JSON.parse('{"latitude":50.0,"longitude":14.759998,"generationtime_ms":0.21791458129882812,"utc_offset_seconds":0,"timezone":"GMT","timezone_abbreviation":"GMT","elevation":436.0,"minutely_15_units":{"time":"unixtime","weather_code":"wmo code","temperature_2m":"°C","precipitation":"mm","wind_speed_10m":"km/h","cloud_cover":"%","pressure_msl":"hPa","precipitation_probability":"%","is_day":""},"minutely_15":{"time":[1786649400,1786650300,1786651200,1786652100,1786653000,1786653900,1786654800,1786655700,1786656600,1786657500,1786658400,1786659300,1786660200,1786661100,1786662000,1786662900,1786663800,1786664700,1786665600,1786666500,1786667400,1786668300,1786669200,1786670100,1786671000,1786671900,1786672800,1786673700],"weather_code":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"temperature_2m":[18.6,18.5,18.3,18.2,18.1,17.9,17.8,17.7,17.6,17.5,17.4,17.4,17.4,17.4,17.4,17.4,17.5,17.5,17.4,17.3,17.1,16.8,16.6,16.4,16.1,15.9,15.7,15.4],"precipitation":[0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00],"wind_speed_10m":[7.3,7.8,7.9,8.0,7.9,7.8,8.0,8.0,8.0,8.0,8.2,8.4,8.9,9.6,10.0,10.1,10.0,9.8,9.7,9.2,8.9,8.6,8.1,7.6,7.2,7.1,6.6,6.3],"cloud_cover":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"pressure_msl":[1025.3,1025.3,1025.3,1025.3,1025.2,1025.2,1025.1,1025.0,1025.0,1025.0,1024.9,1024.8,1024.8,1024.7,1024.7,1024.7,1024.6,1024.6,1024.6,1024.6,1024.5,1024.5,1024.5,1024.5,1024.4,1024.4,1024.4,1024.4],"precipitation_probability":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"is_day":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}}').minutely_15;
let mode = "gwarn";

print(w_minutely);

function draw_msg(s) {
  g.reset().setColor(1,1,1);
  g.fillRect(0, 88, 176, 176);
  
  g.setColor(0,0,0);
  g.setFont("Vector", 29);
  g.drawString(s, 2, 88);
  g.flip();
}

function draw_rich(s) {
  g.reset().setColor(1,1,1);
  g.fillRect(0, 88, 176, 176);

  g.setColor(0,0,0);
  renderRichTextWrap(g, s, 0, 88, 176, 3, {});  
  g.flip();
}

let rich = 1;

function draw_current() {
  let w = w_current;
  if (!w)
    return;
  if (!rich) 
    draw_msg(w.temperature_2m + "C " + w.cloud_cover + "%\n" + w.precipitation + "mm " + w.wind_speed_10m + "km/h\n" + w.pressure_msl + "hPa " + w.elevation + "m");
  else {
    let s = "<>" + w.temperature_2m + "<15>C,|";
    s += "<>" + w.cloud_cover + "<15>%,|";
    s += "<>" + w.precipitation + "<15>mm,|";
    s += "<>" + w.wind_speed_10m + "<10>km/h,|"
    s += "<>" + w.pressure_msl + "<10>hPa,|"
    s += "<>" + w.elevation + "<10>m"
    draw_rich(s);
  }
}

function draw_warn() {
  function fmt_time(i) {
    let r = Math.floor(i/4);
    if (0) {
      return "" + Math.floor((i - getTime()) / 60) + "m:";
    }
    const d = new Date(i * 1000); // convert to ms

    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");

    if (!rich)
      return `${HH}:${MM}:`; // e.g. "14:30"

    return `<15>${HH[0]}<>${HH[1]}:${MM[0]}<15>${MM[1]}:`

  }
  // .':| ... same width; space is way wider; , is wider 

  let data = w_minutely;
  if (!data)
    return;
  let n = data.temperature_2m.length;
  let s = "", t = "";
  let f = 4;
  let temp_base = data.temperature_2m[f];
  let wind_base = 3;
  let day = data.is_day[f];
  let temp_min = 99;
  let temp_max = -99;
  let wind_max = 0;
  let times = data.time;

  for (let i = f; i < n - 1; i++) {
    let v;
    let ft = fmt_time(times[i]);
    
    v = data.temperature_2m[i];
    if (Math.abs(v-temp_base) > 5) {
      s += fmt_time(i) + "<>" + v + "<15>C,|";
      temp_base = v;
    }
    if (v < temp_min)
      temp_min = v;
    if (v > temp_max)
      temp_max = v;

    v = data.wind_speed_10m[i];
    if (Math.abs(v-wind_base) > 5) {
      s += ft + "<>w<15>ind <>" + v + "<15>km/h,|";
      wind_base = v;
    }
    if (v > wind_max)
      wind_max = v;

    v = data.precipitation[i];
    if (v > 1.0)
      s += ft + "<>R<15>AIN,|";

    v = data.is_day[i];
    if (v != day) {
      s += ft + "<>s<15>unset,|";
      day = v;
    }
    
    if (s.length > 1) {
      t = t + s + "\n";
      s = "";
    }
  }

  let res = t + s + "<>" + temp_min + "C.." + temp_max + "C|<>w<15>ind <>" + wind_max + "<15>km/h";
  print("res: "+res);
  draw_rich(res);
}

function draw_gwarn() {
  function fmt_time(i) {
    let r = Math.floor(i/4);
    if (0) {
      return "" + Math.floor((i - getTime()) / 60) + "m:";
    }
    const d = new Date(i * 1000); // convert to ms

    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");

    if (!rich)
      return `${HH}:${MM}:`; // e.g. "14:30"

    return `<15>${HH[0]}<>${HH[1]}:${MM[0]}<15>${MM[1]}:`

  }
  // .':| ... same width; space is way wider; , is wider 

  let data = w_minutely;
  if (!data)
    return;
  let n = data.temperature_2m.length;
  let s = "", t = "";
  let f = 4;
  let temp_base = data.temperature_2m[f];
  let wind_base = 3;
  let day = data.is_day[f];
  let temp_min = 99;
  let temp_max = -99;
  let wind_max = 0;
  let times = data.time;

  g.reset().setColor(1,1,1);
  g.fillRect(0, 88, 176, 176);

  for (let i = f; i < n - 1; i++) {
    let v;
    let ft = fmt_time(times[i]);
    let x = 10 + i * 10;
    let y = 95;
    
    v = data.temperature_2m[i];
    if (Math.abs(v-temp_base) > 1) {
      g.setColor(1, 0, 0);
      g.fillCircle(x, y, 3);
      if (v < temp_base) {
        g.fillCircle(x, y+10, 3);
        temp_base = temp_base - 1;
      } else {
        temp_base = temp_base + 1;
      }
    }
  }
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
function scale_rain(y0, h, v) { return scale(y0, h, v); }
function scale_cloud(y0, h, v) { return scale(y0, h, 1 - (v / 100)); }

function thickLine(a, b, c, d) {
  g.drawLine(a, b-2, c, d-2);
  g.drawLine(a, b-1, c, d-1);
  g.drawLine(a, b, c, d);
  g.drawLine(a, b+1, c, d+1);
  g.drawLine(a, b+2, c, d+2);
}

function thickLineV(a, b, c, d) {
  g.drawLine(a-1, b, c-1, d);
  g.drawLine(a, b, c, d);
  g.drawLine(a+1, b, c+1, d);
}

function get_url(mode) {
  // https does not work on Linux espruino
  let url = "http://api.open-meteo.com/v1/forecast?latitude="+pos.lat+"&longitude="+pos.lon;
  url += "&timeformat=unixtime";  
  // ,precipitation_hours,precipitation_probability_max
  let daily = "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max";
  // ,cape,is_day,sunshine_duration"
  let detail = "weather_code,temperature_2m,precipitation,wind_speed_10m,cloud_cover,pressure_msl,precipitation_probability,is_day";

  let hourly = "&hourly="+detail
  let minutely = "&minutely_15="+detail
  if (mode == "cur")
    return url+"&current="+detail;
  // forecast\?latitude\=40\&longitude\=14.45\&daily\=sunrise\,sunset\,moonrise\,moonset\,moon_phase\,precipitation_sum\,precipitation_hours\,precipitation_probability_max\&hourly\=precipitation_probability\,cloud_cover\&models\=best_match\&current\=is_day\&m

  // it is possible to get just hours around current
  // &forecast_hours=6&past_hours=1
  let today = "&forecast_days=2";
  let past_future = "&past_days=1&forecast_days=16";
  let short = "&forecast_minutely_15\=24\&past_minutely_15\=4";
  if (mode == "daily")
    return url+daily+past_future;
  if (mode == "hourly")
    return url+hourly+today;
  if (mode == "minutely")
    return url+short+minutely;
}

function download(mode) {
  let url = get_url(mode);
  draw_msg(".oO\n"+mode);
  BgetUrl(url, result => {
    print("Got result", result);
    let data = JSON.parse(result);
    if (mode == "cur") {
      w_current = data.current;
      w_current.elevation = data.elevation;
    }
    if (mode == "daily")
      w_daily = data.daily;
    if (mode == "hourly")
      w_hourly = data.hourly;
    if (mode == "minutely")
      w_minutely = data.minutely_15;
    draw_any();
  });
}

function draw_any() {
  if (mode == "cur")
    return draw_current();
  if (mode == "warn")
    return draw_warn();
  if (mode == "gwarn")
    return draw_gwarn();

  g.setColor(1,1,1);
  g.fillRect(0, 88, 176, 176);
  if (mode == "daily")
    return draw_common(w_daily);
  if (mode == "hourly")
    return draw_common(w_hourly);
  if (mode == "minutely")
    return draw_common(w_minutely);
}

function draw_common(data) {
  if (!data)
    return;

  // Title
  g.setColor(0,0,0);
  g.setFont("6x15", 1);
  if (mode == "daily")
    g.drawString("Daily Weather", 5, 89);
  if (mode == "hourly")
    g.drawString("         Hourly Weather", 5, 89);
  if (mode == "minutely")
    g.drawString("                      Minutely", 5, 89);

  let times = data.time;
  let utcHour = 0;
  if (mode == "hourly") {
    // Slice next 6 hours
    times = data.time.slice(0, 48);
    // FIXME: this will start at midnight
    // print(times, temps);

    let d = new Date();
    // Get the current hour in UTC (0-23)
    utcHour = d.getHours() - (d.getTimezoneOffset() / 60);
  }
  if (mode == "minutely") {
    utcHour = 4;
  }

  print("utc:", utcHour);

  let x0 = 20, y0 = 165, w = 140, h = 50;
  let n = times.length;
  let dx = w / (n - 1);

  // Draw axes
  g.setColor(0.5, 0.5, 0.5);
  g.drawLine(x0, y0, x0 + w, y0);
  g.drawLine(x0, y0, x0, y0 - h);

  // Plot lines
  for (let i = 0; i < n - 1; i++) {
    let px1 = x0 + (i * dx), px2 = x0 + ((i + 1) * dx);

    if (mode == "daily") {
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
    } else {
      if (i == utcHour) {
        g.setColor(0, 0, 0);
        thickLine(0, y0-h, px1, y0-h);
        thickLineV(px1, y0-h, px1, y0);
      }      
      
      let tY1 = scale_temp(y0, h, data.temperature_2m[i]);
      let tY2 = scale_temp(y0, h, data.temperature_2m[i+1]);

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

      g.setColor(1, 1, 0); // Yellow four cloud cover
      Y1 = scale_cloud(y0, h, data.cloud_cover[i]);
      Y2 = scale_cloud(y0, h, data.cloud_cover[i+1]);
      thickLine(px1, Y1, px2, Y2);
      
      // Draw small time indicators at the bottom
      g.setColor(0.7, 0.7, 0.7);
    }
  }
}

function draw() {
  draw_any();
}

function cycle() {
  if (mode == "cur") {
    mode = "minutely";
  } else if (mode == "minutely") {
    mode = "hourly";
  } else if (mode == "hourly") {
    mode = "daily";
  } else if (mode == "daily") {
    mode = "warn";
  } else if (mode == "warn") {
    mode = "gwarn";
  } else if (mode == "gwarn") {
    mode = "cur";
  }
  draw_msg(mode);    
}

let prev_button = 0;

Bangle.on('drag', function(xy) {
  print("button", prev_button, xy.b);
  if (!xy.b || prev_button) {
    prev_button = xy.b;
    return;
  }
  prev_button = xy.b;

  let xLimit = g.getHeight() / 2; // Bottom active zone                       
  let yLimit = g.getHeight() / 2; // Bottom active zone                       
  
  if (xy.y <= yLimit) {
    if (xy.x <= xLimit) {
      download(mode);
    } else {
      cycle();
    }
  } else {
    if (xy.x <= xLimit) {
      draw_current();
    } else {
      cycle();
    }
  }    
});

let interval;
function setupRefreshInterval() {
  if (interval) clearInterval(interval);
  // Display update is way too slow
  let rate = Bangle.isLocked() ? 60000 : 5000;
  interval = setInterval(draw, rate);
  draw();
}

// This causes [object] on screen
//Bangle.on('GB', (s) => { msg(s); });
if (0) {
  download("minutely");
  mode = "warn";
}

msg("weather\nfor\n" + pos.location);
Bangle.on('lock', setupRefreshInterval);
//draw_any();

top.init();
