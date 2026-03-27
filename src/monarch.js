// Monarch Money integration module
// Uses a session token from browser login for GraphQL queries.
// All data access is read-only.

import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://api.monarch.com';
const TOKEN_PATH = () => path.join(process.cwd(), 'monarch-token.json');

let token = null;

const HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Client-Platform': 'web',
};

function authHeaders() {
  return { ...HEADERS, Authorization: `Token ${token}` };
}

// Load saved token
export function loadSession() {
  const p = TOKEN_PATH();
  if (!fs.existsSync(p)) return false;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  token = data.token;
  return !!token;
}

// Save a token obtained from browser dev tools
export function setToken(t) {
  token = t;
  fs.writeFileSync(TOKEN_PATH(), JSON.stringify({ token }, null, 2));
}

// Check if we have a valid session
export function isLoggedIn() {
  return !!token;
}

// GraphQL query helper
async function gql(operation, query, variables = {}) {
  if (!token) throw new Error('Not logged in. Run: node skills/finance/run.js set-token <token>');
  const resp = await fetch(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ operationName: operation, query, variables }),
  });
  if (resp.status === 401) throw new Error('Session expired. Grab a fresh token from browser dev tools and run: node skills/finance/run.js set-token <token>');
  if (!resp.ok) throw new Error(`GraphQL error: ${resp.status}`);
  const data = await resp.json();
  if (data.errors) throw new Error(data.errors.map(e => e.message).join(', '));
  return data.data;
}

// --- Queries ---

export async function getAccounts() {
  const data = await gql('GetAccounts', `
    query GetAccounts {
      accounts {
        id displayName currentBalance displayBalance
        includeInNetWorth isHidden isAsset
        type { name display }
        subtype { name display }
        institution { name }
        credential { updateRequired }
      }
    }
  `);
  return (data.accounts || [])
    .filter(a => !a.isHidden)
    .map(a => ({
      id: a.id,
      name: a.displayName,
      balance: a.displayBalance ?? a.currentBalance,
      type: a.type?.display || a.type?.name,
      subtype: a.subtype?.display || a.subtype?.name,
      institution: a.institution?.name,
      isAsset: a.isAsset,
      includeInNetWorth: a.includeInNetWorth,
      needsAttention: a.credential?.updateRequired || false,
    }));
}

export async function getTransactions(startDate, endDate, limit = 50) {
  const data = await gql('GetTransactionsList', `
    query GetTransactionsList($offset: Int, $limit: Int, $filters: TransactionFilterInput, $orderBy: TransactionOrdering) {
      allTransactions(filters: $filters) {
        totalCount
        results(offset: $offset, limit: $limit, orderBy: $orderBy) {
          id amount pending date
          category { id name }
          merchant { name }
          account { id displayName }
          tags { name }
          notes
        }
      }
    }
  `, {
    offset: 0,
    limit,
    orderBy: 'date',
    filters: {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
  });
  const txns = data.allTransactions;
  return {
    totalCount: txns.totalCount,
    transactions: txns.results.map(t => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      pending: t.pending,
      merchant: t.merchant?.name,
      category: t.category?.name,
      account: t.account?.displayName,
      tags: t.tags?.map(t => t.name) || [],
      notes: t.notes || null,
    })),
  };
}

export async function getBudgets(startDate, endDate) {
  const data = await gql('Common_GetJointPlanningData', `
    query Common_GetJointPlanningData($startDate: Date!, $endDate: Date!) {
      budgetData(startMonth: $startDate, endMonth: $endDate) {
        monthlyAmountsByCategory {
          category { id name }
          monthlyAmounts {
            month
            plannedAmount
            actualAmount
            remainingAmount
          }
        }
        totalsByMonth {
          month
          totalIncome { plannedAmount actualAmount remainingAmount }
          totalExpenses { plannedAmount actualAmount remainingAmount }
        }
      }
    }
  `, { startDate, endDate });
  return data.budgetData;
}

export async function getNetWorth(startDate) {
  const data = await gql('GetAggregateSnapshots', `
    query GetAggregateSnapshots($filters: AggregateSnapshotFilters) {
      aggregateSnapshots(filters: $filters) {
        date balance
      }
    }
  `, {
    filters: { startDate: startDate || '2020-01-01' },
  });
  return data.aggregateSnapshots || [];
}

export async function getCashflow(startDate, endDate) {
  const data = await gql('Web_GetCashFlowPage', `
    query Web_GetCashFlowPage($filters: TransactionFilterInput) {
      byCategory: aggregates(filters: $filters, groupBy: ["category"]) {
        groupBy { category { id name group { id type } } }
        summary { sum }
      }
      byCategoryGroup: aggregates(filters: $filters, groupBy: ["categoryGroup"]) {
        groupBy { categoryGroup { id name type } }
        summary { sum }
      }
      byMerchant: aggregates(filters: $filters, groupBy: ["merchant"]) {
        groupBy { merchant { id name } }
        summary { sumIncome sumExpense }
      }
      summary: aggregates(filters: $filters, fillEmptyValues: true) {
        summary { sumIncome sumExpense savings savingsRate }
      }
    }
  `, {
    filters: {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
  });
  return {
    summary: data.summary?.[0]?.summary || {},
    byCategory: (data.byCategory || []).map(c => ({
      category: c.groupBy?.category?.name,
      type: c.groupBy?.category?.group?.type,
      amount: c.summary?.sum,
    })),
    byMerchant: (data.byMerchant || [])
      .map(m => ({
        merchant: m.groupBy?.merchant?.name,
        income: m.summary?.sumIncome,
        expense: m.summary?.sumExpense,
      }))
      .sort((a, b) => (a.expense || 0) - (b.expense || 0))
      .slice(0, 20),
  };
}
