# News Skill

You have access to current news headlines via Google News RSS feeds.

## Commands

Run these commands using the shell. The tool is located at `skills/news/run.js` relative to the bot's working directory.

### Headlines
- `node skills/news/run.js top` — top stories (default 5)
- `node skills/news/run.js top 10` — top 10 stories
- `node skills/news/run.js tech` — technology news
- `node skills/news/run.js sports` — sports news
- `node skills/news/run.js business` — business/finance news
- `node skills/news/run.js world` — world news
- `node skills/news/run.js nation` — US national news
- `node skills/news/run.js health` — health news
- `node skills/news/run.js science` — science news

## Output format

All commands output JSON. Example:
```json
{ "category": "top", "articles": [{ "title": "...", "source": "CNN", "date": "...", "link": "..." }], "count": 5 }
```

## When to use

- User asks "what's in the news?", "what's going on?", "any news?"
- User asks about specific topics: "any tech news?", "what's happening in sports?"
- User asks about current events or headlines

## Important

- Present headlines in a clean, readable list — not raw JSON
- Include the source name with each headline
- Don't include the full URLs unless the user asks for links
- Keep it brief — headlines and sources, not full articles
