#!/usr/bin/env node

import { initGmail, listEmails, getEmail, getUnreadCount } from '../../src/gmail.js';

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function printUsage() {
  printJson({
    usage: {
      'inbox [count]': 'Latest emails (default 5)',
      'unread [count]': 'Unread emails',
      'unread-count': 'Number of unread emails',
      'from <address> [count]': 'Emails from a specific sender',
      'search <query> [count]': 'Search emails (Gmail search syntax)',
      'read <messageId>': 'Read full email by ID',
      'today': 'Emails received today',
    },
  });
}

async function main() {
  const ok = initGmail();
  if (!ok) {
    printJson({ error: 'Gmail not configured. Ensure credentials.json and token.json exist with gmail.readonly scope.' });
    process.exit(1);
  }

  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command || command === 'help') {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case 'inbox': {
      const count = parseInt(args[0]) || 5;
      const emails = await listEmails({ maxResults: count });
      printJson({ emails, count: emails.length });
      break;
    }

    case 'unread': {
      const count = parseInt(args[0]) || 5;
      const emails = await listEmails({ query: 'is:unread', maxResults: count });
      printJson({ emails, count: emails.length });
      break;
    }

    case 'unread-count': {
      const count = await getUnreadCount();
      printJson({ unread: count });
      break;
    }

    case 'from': {
      if (!args[0]) {
        printJson({ error: 'Usage: from <address> [count]' });
        process.exit(1);
      }
      const count = parseInt(args[1]) || 5;
      const emails = await listEmails({ query: `from:${args[0]}`, maxResults: count });
      printJson({ emails, count: emails.length });
      break;
    }

    case 'search': {
      if (!args[0]) {
        printJson({ error: 'Usage: search <query> [count]' });
        process.exit(1);
      }
      const count = parseInt(args[1]) || 5;
      const emails = await listEmails({ query: args[0], maxResults: count });
      printJson({ emails, count: emails.length });
      break;
    }

    case 'read': {
      if (!args[0]) {
        printJson({ error: 'Usage: read <messageId>' });
        process.exit(1);
      }
      const email = await getEmail(args[0]);
      printJson({ email });
      break;
    }

    case 'today': {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      const emails = await listEmails({ query: `after:${today}`, maxResults: 10 });
      printJson({ emails, count: emails.length });
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
