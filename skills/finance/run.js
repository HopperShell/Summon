#!/usr/bin/env node

import {
  loadSession, setToken, isLoggedIn,
  getAccounts, getTransactions, getBudgets, getNetWorth, getCashflow,
} from '../../src/monarch.js';

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function printUsage() {
  printJson({
    usage: {
      'set-token <token>': 'Save your Monarch auth token (one-time setup)',
      'accounts': 'Show all account balances',
      'transactions [days]': 'Recent transactions (default 30 days)',
      'budget [YYYY-MM]': 'Budget status for a month (default current)',
      'networth [YYYY-MM-DD]': 'Net worth history from start date (default 2020-01-01)',
      'cashflow [YYYY-MM]': 'Income vs spending for a month (default current)',
      'summary': 'Quick financial overview',
    },
  });
}

function getMonthRange(monthStr) {
  const now = new Date();
  let year, month;
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    [year, month] = monthStr.split('-').map(Number);
  } else {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function ensureLoggedIn() {
  if (!loadSession()) {
    printJson({
      error: 'No token found.',
      setup: {
        step1: 'Log in to app.monarch.com in your browser',
        step2: 'Open DevTools (F12) → Network tab',
        step3: 'Click any page in Monarch to trigger a request',
        step4: 'Find a request to api.monarch.com → look at the Authorization header',
        step5: 'Copy the token value (after "Token ") and run: node skills/finance/run.js set-token <token>',
      },
    });
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command || command === 'help') {
    printUsage();
    process.exit(0);
  }

  if (command === 'set-token') {
    const t = args[0];
    if (!t) {
      printJson({ error: 'Usage: set-token <token>' });
      process.exit(1);
    }
    setToken(t);
    printJson({ success: true, message: 'Token saved. Try: node skills/finance/run.js accounts' });
    return;
  }

  // All other commands require auth
  ensureLoggedIn();

  switch (command) {
    case 'accounts': {
      const accounts = await getAccounts();
      const totalAssets = accounts.filter(a => a.isAsset).reduce((s, a) => s + (a.balance || 0), 0);
      const totalLiabilities = accounts.filter(a => !a.isAsset).reduce((s, a) => s + (a.balance || 0), 0);
      printJson({ accounts, totalAssets, totalLiabilities, netWorth: totalAssets + totalLiabilities });
      break;
    }

    case 'transactions': {
      const days = parseInt(args[0]) || 30;
      const result = await getTransactions(daysAgo(days), today(), 50);
      printJson(result);
      break;
    }

    case 'budget': {
      const { startDate, endDate } = getMonthRange(args[0]);
      const result = await getBudgets(startDate, endDate);
      printJson(result);
      break;
    }

    case 'networth': {
      const startDate = args[0] || '2020-01-01';
      const snapshots = await getNetWorth(startDate);
      const latest = snapshots[snapshots.length - 1];
      const oldest = snapshots[0];
      printJson({
        current: latest?.balance,
        change: latest && oldest ? latest.balance - oldest.balance : null,
        dataPoints: snapshots.length,
        from: oldest?.date,
        to: latest?.date,
        snapshots: snapshots.slice(-12),
      });
      break;
    }

    case 'cashflow': {
      const { startDate, endDate } = getMonthRange(args[0]);
      const result = await getCashflow(startDate, endDate);
      printJson(result);
      break;
    }

    case 'summary': {
      const { startDate, endDate } = getMonthRange();
      const [accounts, cashflow, budgets] = await Promise.all([
        getAccounts(),
        getCashflow(startDate, endDate),
        getBudgets(startDate, endDate),
      ]);
      const totalAssets = accounts.filter(a => a.isAsset).reduce((s, a) => s + (a.balance || 0), 0);
      const totalLiabilities = accounts.filter(a => !a.isAsset).reduce((s, a) => s + (a.balance || 0), 0);
      const totals = budgets.totalsByMonth?.[0];
      printJson({
        netWorth: totalAssets + totalLiabilities,
        totalAssets,
        totalLiabilities,
        accountCount: accounts.length,
        cashflow: cashflow.summary,
        budgetTotals: totals ? {
          income: totals.totalIncome,
          expenses: totals.totalExpenses,
        } : null,
        topSpending: cashflow.byMerchant.slice(0, 10),
      });
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
