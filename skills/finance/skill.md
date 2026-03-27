# Finance Skill (Monarch Money)

Access the user's Monarch Money financial data — accounts, transactions, budgets, net worth, and cashflow. Read-only.

## Commands

Run these commands using the shell. The tool is located at `skills/finance/run.js` relative to the bot's working directory.

### Setup
- `node skills/finance/run.js set-token <token>` — save your Monarch auth token (one-time)

### Account balances
- `node skills/finance/run.js accounts` — all accounts with balances, types, and institutions

### Transactions
- `node skills/finance/run.js transactions` — last 30 days of transactions
- `node skills/finance/run.js transactions 7` — last 7 days

### Budget
- `node skills/finance/run.js budget` — current month budget vs actual
- `node skills/finance/run.js budget 2026-02` — specific month

### Net worth
- `node skills/finance/run.js networth` — net worth history from 2020
- `node skills/finance/run.js networth 2025-01-01` — from a specific date

### Cashflow
- `node skills/finance/run.js cashflow` — income vs spending this month by category and merchant
- `node skills/finance/run.js cashflow 2026-02` — specific month

### Quick overview
- `node skills/finance/run.js summary` — net worth, cashflow, budget status, and top spending in one call

## When to use

- User asks about their finances, money, accounts, or balances
- User asks "how much did I spend on X?", "what's my budget look like?"
- User asks "what's my net worth?", "how are my finances?"
- User asks about specific transactions or spending patterns
- User asks "am I over budget?"

## Important

- This is READ-ONLY — no transfers, payments, or modifications
- Session token lasts several months before needing refresh
- If a command returns "Session expired", the user needs to grab a fresh token from their browser
- Present financial data clearly — use dollar formatting, round to 2 decimal places
- Be mindful of privacy — only share financial details the user specifically asks about
- The summary command is a good starting point for general finance questions
- Negative transaction amounts are expenses, positive are income
