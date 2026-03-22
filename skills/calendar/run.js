#!/usr/bin/env node

import {
  initCalendar,
  getEventsToday,
  getEventsTomorrow,
  getEventsThisWeek,
  getEvents,
  createEvent,
  deleteEvent,
  checkAvailability,
} from '../../src/calendar.js';

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function printUsage() {
  printJson({
    usage: {
      today: 'List today\'s events',
      tomorrow: 'List tomorrow\'s events',
      week: 'List rest of this week\'s events',
      'date <YYYY-MM-DD>': 'List events on a specific date',
      'range <startISO> <endISO>': 'List events in a date range',
      'add <summary> <startISO> <endISO> [location]': 'Create an event',
      'delete <eventId>': 'Delete an event by ID',
      'free <startISO> <endISO>': 'Check if a time slot is free',
    },
  });
}

async function main() {
  const ok = initCalendar();
  if (!ok) {
    printJson({ error: 'Calendar not configured. Ensure credentials.json and token.json exist in the project root.' });
    process.exit(1);
  }

  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command || command === 'help') {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case 'today': {
      const events = await getEventsToday();
      printJson({ events, count: events.length });
      break;
    }

    case 'tomorrow': {
      const events = await getEventsTomorrow();
      printJson({ events, count: events.length });
      break;
    }

    case 'week': {
      const events = await getEventsThisWeek();
      printJson({ events, count: events.length });
      break;
    }

    case 'date': {
      if (!args[0]) {
        printJson({ error: 'Usage: date <YYYY-MM-DD>' });
        process.exit(1);
      }
      const day = new Date(args[0]);
      const startOfDay = new Date(day);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);
      const events = await getEvents(startOfDay, endOfDay);
      printJson({ events, count: events.length });
      break;
    }

    case 'range': {
      if (!args[0] || !args[1]) {
        printJson({ error: 'Usage: range <startISO> <endISO>' });
        process.exit(1);
      }
      const events = await getEvents(args[0], args[1]);
      printJson({ events, count: events.length });
      break;
    }

    case 'add': {
      if (!args[0] || !args[1] || !args[2]) {
        printJson({ error: 'Usage: add <summary> <startISO> <endISO> [location]' });
        process.exit(1);
      }
      const event = await createEvent({
        summary: args[0],
        startTime: args[1],
        endTime: args[2],
        location: args[3] || undefined,
      });
      if (!event) {
        printJson({ error: 'Failed to create event' });
        process.exit(1);
      }
      printJson({ event, created: true });
      break;
    }

    case 'delete': {
      if (!args[0]) {
        printJson({ error: 'Usage: delete <eventId>' });
        process.exit(1);
      }
      await deleteEvent(args[0]);
      printJson({ deleted: true });
      break;
    }

    case 'free': {
      if (!args[0] || !args[1]) {
        printJson({ error: 'Usage: free <startISO> <endISO>' });
        process.exit(1);
      }
      const result = await checkAvailability(args[0], args[1]);
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
