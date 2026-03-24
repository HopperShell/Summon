#!/usr/bin/env node

const TOKEN = process.env.GROUPME_TOKEN;
const DEFAULT_GROUP_ID = '108900896'; // 14U Eagles

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

async function apiGet(endpoint) {
  const resp = await fetch(`https://api.groupme.com/v3${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${TOKEN}`);
  if (!resp.ok) {
    throw new Error(`GroupMe API error: ${resp.status}`);
  }
  const data = await resp.json();
  return data.response;
}

async function getMessages(groupId, limit = 100) {
  const messages = await apiGet(`/groups/${groupId}/messages?limit=${limit}`);
  return messages.messages.map((m) => ({
    id: m.id,
    name: m.name,
    text: m.text,
    time: new Date(m.created_at * 1000).toISOString(),
    attachments: m.attachments?.length || 0,
  }));
}

async function getMessagesToday(groupId) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const all = await getMessages(groupId, 100);
  return all.filter((m) => new Date(m.time) >= startOfDay);
}

async function getMessagesSince(groupId, hoursAgo) {
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  const all = await getMessages(groupId, 100);
  return all.filter((m) => new Date(m.time) >= cutoff);
}

async function searchMessages(groupId, query) {
  const all = await getMessages(groupId, 100);
  const lower = query.toLowerCase();
  return all.filter((m) => m.text && m.text.toLowerCase().includes(lower));
}

async function listGroups() {
  const groups = await apiGet('/groups?per_page=50');
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    members: g.members?.length || 0,
  }));
}

function printUsage() {
  printJson({
    usage: {
      'today [groupId]': 'Messages from today (default: 14U Eagles)',
      'recent <hours> [groupId]': 'Messages from last N hours',
      'messages [limit] [groupId]': 'Last N messages (default 50)',
      'search <query> [groupId]': 'Search messages for a keyword',
      'groups': 'List all available groups',
    },
  });
}

async function main() {
  if (!TOKEN) {
    printJson({ error: 'GROUPME_TOKEN not set in environment' });
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
      const groupId = args[0] || DEFAULT_GROUP_ID;
      const messages = await getMessagesToday(groupId);
      printJson({ messages, count: messages.length });
      break;
    }

    case 'recent': {
      const hours = parseInt(args[0]) || 24;
      const groupId = args[1] || DEFAULT_GROUP_ID;
      const messages = await getMessagesSince(groupId, hours);
      printJson({ messages, count: messages.length });
      break;
    }

    case 'messages': {
      const limit = parseInt(args[0]) || 50;
      const groupId = args[1] || DEFAULT_GROUP_ID;
      const messages = await getMessages(groupId, limit);
      printJson({ messages, count: messages.length });
      break;
    }

    case 'search': {
      if (!args[0]) {
        printJson({ error: 'Usage: search <query> [groupId]' });
        process.exit(1);
      }
      const groupId = args[1] || DEFAULT_GROUP_ID;
      const messages = await searchMessages(groupId, args[0]);
      printJson({ messages, count: messages.length });
      break;
    }

    case 'groups': {
      const groups = await listGroups();
      printJson({ groups, count: groups.length });
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
