#!/usr/bin/env node

const DEFAULT_LAT = 35.96;
const DEFAULT_LON = -83.92;
const DEFAULT_TIMEZONE = 'America/New_York';

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

const WMO_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Light snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Severe thunderstorm',
};

async function geocode(query) {
  const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`);
  const data = await resp.json();
  if (!data.results?.length) return null;
  const r = data.results[0];
  return { name: `${r.name}, ${r.admin1 || r.country}`, lat: r.latitude, lon: r.longitude, timezone: r.timezone };
}

async function getForecast(lat, lon, timezone, days) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&current=temperature_2m,weathercode,apparent_temperature,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${timezone}&forecast_days=${days}`;
  const resp = await fetch(url);
  return resp.json();
}

function formatForecast(data) {
  const current = {
    temperature: `${Math.round(data.current.temperature_2m)}°F`,
    feels_like: `${Math.round(data.current.apparent_temperature)}°F`,
    condition: WMO_CODES[data.current.weathercode] || 'Unknown',
    wind: `${Math.round(data.current.wind_speed_10m)} mph`,
  };

  const daily = data.daily.time.map((date, i) => ({
    date,
    high: `${Math.round(data.daily.temperature_2m_max[i])}°F`,
    low: `${Math.round(data.daily.temperature_2m_min[i])}°F`,
    rain_chance: `${data.daily.precipitation_probability_max[i]}%`,
    condition: WMO_CODES[data.daily.weathercode[i]] || 'Unknown',
  }));

  return { current, forecast: daily };
}

function printUsage() {
  printJson({
    usage: {
      'now [location]': 'Current weather (default: Knoxville area)',
      'today [location]': 'Today\'s forecast',
      'forecast [days] [location]': 'Multi-day forecast (default 3 days)',
      'location <city name>': 'Look up coordinates for a city',
    },
  });
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command || command === 'help') {
    printUsage();
    process.exit(0);
  }

  let lat = DEFAULT_LAT;
  let lon = DEFAULT_LON;
  let timezone = DEFAULT_TIMEZONE;
  let locationName = 'Knoxville area';

  // Check if last arg is a location name (not a number)
  async function resolveLocation(locArg) {
    if (locArg && isNaN(locArg)) {
      const geo = await geocode(locArg);
      if (!geo) {
        printJson({ error: `Could not find location: ${locArg}` });
        process.exit(1);
      }
      lat = geo.lat;
      lon = geo.lon;
      timezone = geo.timezone;
      locationName = geo.name;
    }
  }

  switch (command) {
    case 'now': {
      await resolveLocation(args[0]);
      const data = await getForecast(lat, lon, timezone, 1);
      const result = formatForecast(data);
      printJson({ location: locationName, ...result.current });
      break;
    }

    case 'today': {
      await resolveLocation(args[0]);
      const data = await getForecast(lat, lon, timezone, 1);
      const result = formatForecast(data);
      printJson({ location: locationName, current: result.current, today: result.forecast[0] });
      break;
    }

    case 'forecast': {
      const days = parseInt(args[0]) || 3;
      await resolveLocation(args[1] || args[0]?.match(/\D/) ? args[0] : undefined);
      const data = await getForecast(lat, lon, timezone, days);
      const result = formatForecast(data);
      printJson({ location: locationName, current: result.current, forecast: result.forecast });
      break;
    }

    case 'location': {
      if (!args[0]) {
        printJson({ error: 'Usage: location <city name>' });
        process.exit(1);
      }
      const geo = await geocode(args.join(' '));
      if (!geo) {
        printJson({ error: `Could not find: ${args.join(' ')}` });
        process.exit(1);
      }
      printJson(geo);
      break;
    }

    default:
      printJson({ error: `Unknown command: ${command}` });
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  printJson({ error: err.message });
  process.exit(1);
});
