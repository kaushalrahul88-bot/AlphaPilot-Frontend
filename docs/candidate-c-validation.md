# Candidate C — Frozen OOS Protocol

Candidate C is frozen from Setup Discovery v2 as **PULLBACK_CONTINUATION · SHORT**.

Rule: EMA20 < EMA50; the prior 5-minute candle touches EMA20 and closes at/below EMA20; the signal candle closes below the prior low. Entry is the next 5-minute open. Stop is `max(prior high, EMA20 + 0.35 ATR)`. Target is fixed at 1R. No additional filters are allowed.

Untouched forward validation window: **11-Aug-2026 through 24-Aug-2026**. The 24-symbol OOS universe is split into three disjoint eight-symbol blocks. The pre-registered PASS gate is: at least 50 combined resolved trades, average R at least +0.10R, win rate at least 55%, profit factor at least 1.20, and positive average R in at least two of three blocks.

A PASS permits only a separate option-premium OOS stage. It does not modify production AlphaPilot rules.
