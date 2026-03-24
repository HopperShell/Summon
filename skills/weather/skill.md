# Weather Skill

You have access to weather forecasts. Default location is the Knoxville, TN area.

## Commands

Run these commands using the shell. The tool is located at `skills/weather/run.js` relative to the bot's working directory.

### Weather
- `node skills/weather/run.js now` — current weather
- `node skills/weather/run.js today` — today's forecast
- `node skills/weather/run.js forecast` — 3-day forecast
- `node skills/weather/run.js forecast 7` — 7-day forecast

### Other locations
- `node skills/weather/run.js now Nashville` — current weather in Nashville
- `node skills/weather/run.js forecast 3 Atlanta` — 3-day forecast for Atlanta

### Lookup
- `node skills/weather/run.js location "New York"` — get coordinates for a city

## Output format

All commands output JSON. Example:
```json
{ "location": "Knoxville area", "temperature": "72°F", "feels_like": "70°F", "condition": "Partly cloudy", "wind": "8 mph" }
```

## When to use

- User asks about weather, temperature, rain, forecast
- User asks "will it rain tomorrow?", "what's the weather for the game?"
- User asks about weather in a specific city
- User mentions outdoor plans and weather might be relevant (games, practice, etc.)

## Important

- Temperatures are in Fahrenheit
- Default location is Knoxville, TN — use a different city if the user specifies
- Present weather in a friendly, conversational way
- When the user asks about game/practice weather, combine with GroupMe info if you know the location
