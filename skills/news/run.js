#!/usr/bin/env node

const FEEDS = {
  top: 'https://news.google.com/rss',
  tech: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB',
  sports: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pWVXlnQVAB',
  business: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB',
  world: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB',
  nation: 'https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNRGxqTjNjd0VnSmxiaWdBUAE',
  health: 'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ',
  science: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB',
};

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function parseItems(xml, limit) {
  const items = [];
  const regex = /<item>[\s\S]*?<\/item>/g;
  let match;

  while ((match = regex.exec(xml)) !== null && items.length < limit) {
    const item = match[0];
    const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
    const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || '';

    // Clean HTML entities
    const cleanTitle = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

    items.push({
      title: cleanTitle,
      source,
      date: pubDate,
      link,
    });
  }

  return items;
}

async function fetchFeed(url, limit) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch feed: ${resp.status}`);
  const xml = await resp.text();
  return parseItems(xml, limit);
}

function printUsage() {
  printJson({
    usage: {
      'top [count]': 'Top stories (default 5)',
      'tech [count]': 'Technology news',
      'sports [count]': 'Sports news',
      'business [count]': 'Business news',
      'world [count]': 'World news',
      'nation [count]': 'US national news',
      'health [count]': 'Health news',
      'science [count]': 'Science news',
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

  const feedUrl = FEEDS[command];
  if (!feedUrl) {
    printJson({ error: `Unknown category: ${command}. Available: ${Object.keys(FEEDS).join(', ')}` });
    process.exit(1);
  }

  const limit = parseInt(args[0]) || 5;
  const articles = await fetchFeed(feedUrl, limit);
  printJson({ category: command, articles, count: articles.length });
}

main().catch((err) => {
  printJson({ error: err.message });
  process.exit(1);
});
