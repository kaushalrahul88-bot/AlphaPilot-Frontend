# Paper Risk Ledger v1

Paper Risk Ledger v1 adds an automatic, browser-local audit trail to the Portfolio Risk & Discipline Engine.

## Safety boundary

- Records only successful deterministic risk API responses.
- Never changes the risk result, sizing, blockers, or final action.
- Cannot place, arm, or authorize an order.
- `live_execution_enabled` is recorded as `false` for every snapshot.
- A storage failure is ignored so it cannot turn a blocked decision into an allowed decision.
- Browser local storage is editable and is not a tamper-evident compliance record.

## What is recorded

Each snapshot contains the evaluation time and IST session date, mode, contract identifier, correlation group, final action, blocker codes, computed whole-lot sizing, daily/weekly P&L and loss state, loss streak and cooldown, drawdown, open/correlated risk, exposure, budgets, operational gates, and source record counts.

The ledger does not copy individual open-position or closed-trade histories. It stores only the risk engine's aggregate snapshot plus the counts of source records used.

## Retention and export

- Storage key: `alphapilot:risk-decision-ledger.v1`.
- Maximum retained records: 500, newest first.
- Storage scope: the current browser profile and application origin.
- Export: JSON with schema version, export time, record count, and snapshots.

Treat exports as private trading data. Clearing browser site data removes the local ledger; exported files are not removed.

## Interpretation

`PAPER_TRADE_ONLY` means the v1 gates allowed a paper trade at the computed maximum whole-lot size. `NO_TRADE` means at least one hard blocker fired. Controlled-live mode remains a readiness preview only and still records live execution as disabled.
