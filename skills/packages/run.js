#!/usr/bin/env node

import { initGmail, listEmails, getEmail } from '../../src/gmail.js';
import { extractTrackingNumbers, extractTrackingUrls, getTrackingUrl, parseStatusFromEmail, detectSender } from '../../src/tracking.js';

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function printUsage() {
  printJson({
    usage: {
      'check': 'Search Gmail for recent shipping emails and show package status',
      'check <count>': 'Search more emails (default 15)',
      'search <query>': 'Search Gmail with a custom query for shipping info',
    },
  });
}

// Gmail search queries for shipping/delivery emails
const SHIPPING_SENDERS = [
  'ups.com', 'fedex.com', 'usps.com', 'amazon.com', 'narvar.com',
  'aftership.com', 'shopify.com', 'shop.app', 'walmart.com', 'target.com',
  'bestbuy.com', 'ebay.com', 'etsy.com', 'dhl.com',
];

const SHIPPING_QUERY = [
  `from:(${SHIPPING_SENDERS.join(' OR ')})`,
  'subject:(shipped OR tracking OR delivery OR delivered OR "out for delivery" OR "in transit" OR shipment OR "has shipped" OR "on its way")',
  'newer_than:14d',
].join(' ');

async function findPackages(count = 15, customQuery = null) {
  const ok = initGmail();
  if (!ok) {
    return { error: 'Gmail not configured. Ensure credentials.json and token.json exist.' };
  }

  const query = customQuery || SHIPPING_QUERY;
  const emails = await listEmails({ query, maxResults: count });

  // Group by tracking number to dedupe and get latest status
  const packages = new Map();

  for (const email of emails) {
    // Get full email body for better extraction
    let fullBody = email.body || '';
    if (fullBody.endsWith('...') || fullBody.length >= 490) {
      try {
        const full = await getEmail(email.id);
        fullBody = full.body || fullBody;
      } catch { /* use truncated body */ }
    }

    const textToSearch = `${email.subject} ${fullBody}`;
    const found = extractTrackingNumbers(textToSearch);
    const foundUrls = extractTrackingUrls(textToSearch);
    const sender = detectSender(email.from);
    const status = parseStatusFromEmail(email.subject, fullBody);

    if (found.length > 0) {
      // Has tracking numbers — create entry per tracking number
      for (const { number, carrier } of found) {
        if (!packages.has(number)) {
          packages.set(number, {
            trackingNumber: number,
            carrier,
            trackingUrl: getTrackingUrl(number, carrier),
            status,
            sender,
            subject: email.subject,
            date: email.date,
          });
        }
      }
    } else if (foundUrls.length > 0) {
      // No raw tracking number but found tracking URLs in the email
      for (const { url, carrier } of foundUrls) {
        const key = url.slice(0, 120);
        if (!packages.has(key)) {
          packages.set(key, {
            trackingNumber: null,
            carrier,
            trackingUrl: url,
            status,
            sender,
            subject: email.subject,
            date: email.date,
          });
        }
      }
    } else {
      // No tracking info at all — still show the shipping email
      const key = `${sender}:${email.subject}`.slice(0, 80);
      if (!packages.has(key)) {
        packages.set(key, {
          trackingNumber: null,
          carrier: null,
          trackingUrl: null,
          status,
          sender,
          subject: email.subject,
          date: email.date,
        });
      }
    }
  }

  return {
    packages: Array.from(packages.values()),
    count: packages.size,
    emailsSearched: emails.length,
  };
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command || command === 'help') {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case 'check': {
      const count = parseInt(args[0]) || 15;
      const result = await findPackages(count);
      if (result.error) {
        printJson(result);
        process.exit(1);
      }
      printJson(result);
      break;
    }

    case 'search': {
      const query = args.join(' ');
      if (!query) {
        printJson({ error: 'Usage: search <gmail-query>' });
        process.exit(1);
      }
      const result = await findPackages(15, query);
      if (result.error) {
        printJson(result);
        process.exit(1);
      }
      printJson(result);
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
