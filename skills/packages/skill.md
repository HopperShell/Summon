# Package Tracking Skill

Track your packages by searching Gmail for shipping emails. Extracts tracking numbers and tracking URLs from emails sent by Amazon, UPS, FedEx, USPS, DHL, Walmart, Target, and more. No API keys needed — uses Gmail only.

## Commands

Run these commands using the shell. The tool is located at `skills/packages/run.js` relative to the bot's working directory.

### Check all packages
- `node skills/packages/run.js check` — search recent Gmail for shipping emails and show package status + tracking URLs
- `node skills/packages/run.js check 20` — search more emails (default 15)

### Custom Gmail search
- `node skills/packages/run.js search "from:amazon.com shipped"` — search Gmail with a custom query

## Output format

```json
{
  "packages": [
    {
      "trackingNumber": "1Z999AA10123456784",
      "carrier": "UPS",
      "trackingUrl": "https://www.ups.com/track?tracknum=1Z999AA10123456784",
      "status": "Shipped",
      "sender": "Amazon",
      "subject": "Shipped: \"Your Item...\"",
      "date": "Mon, 23 Mar 2026 10:00:00 -0500"
    }
  ],
  "count": 1
}
```

## When to use

- User asks "where's my package?", "any deliveries coming?", "track my packages"
- User asks about a specific shipment or order
- User asks "did my Amazon order ship?"
- User asks "what have I ordered recently?"

## Important

- Requires Gmail access (credentials.json + token.json) — no other API keys needed
- Status is parsed from the email content (shipped, in transit, delivered, etc.)
- Tracking URLs are extracted from email bodies — clicking them takes you to the carrier's live tracking page
- Amazon emails use their own tracking URLs instead of raw tracking numbers — those are captured too
- Present results in a friendly way: item name, status, and a clickable tracking link
- Searches the last 14 days by default
