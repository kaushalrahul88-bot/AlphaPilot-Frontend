# Portfolio Risk & Discipline Engine v1 UI

The Risk Center now exposes an isolated deterministic decision simulator backed by `POST /v1/risk/discipline/evaluate`.

- It reads browser-local portfolio and resolved journal records and labels that source as potentially containing demo data.
- Operational gates are explicit manual simulation inputs and default to failed, including verification that browser portfolio/journal records are not seed/demo data.
- It displays the maximum whole-lot quantity, available trade risk, net R:R, daily P&L, open risk, loss streak, drawdown, and every hard blocker.
- The only positive action is `PAPER_TRADE_ONLY`.
- Controlled-live mode is readiness preview only. It always shows live execution disabled and cannot send an order.
