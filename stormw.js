
// weather.js

// Example coordinates for London, UK (Latitude: 51.5074, Longitude: -0.1278)
const LATITUDE = 51.5074;
const LONGITUDE = -0.1278;

const https = require("http");
const city = "London";

function getWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current_weather=true`;

  console.log("Fetching weather data...");

  https.get(url, (res) => {
    let rawData = "";

    // A chunk of data has been received
    res.on("data", (chunk) => {
      rawData += chunk;
    });

    // The whole response has been received
    res.on("end", () => {
      try {
        const data = JSON.parse(rawData);
        const current = data.current_weather;

        console.log("\n--- Current Weather ---");
        console.log(`City          : ${city}`);
        console.log(`Temperature   : ${current.temperature} °C`);
        console.log(`Wind Speed    : ${current.windspeed} km/h`);
        console.log(`Wind Direction: ${current.winddirection}°`);
        console.log(`Time          : ${current.time}`);
      } catch (e) {
        console.error("Error parsing JSON:", e.message);
      }
    });

  });
}

getWeather();
