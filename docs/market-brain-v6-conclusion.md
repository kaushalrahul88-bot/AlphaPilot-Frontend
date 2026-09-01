# Market Brain v6 — Frozen Dynamic-Context Conclusion

Research completed: 25 August 2026  
Protocol revision: `v6-frozen-2026-08-25`  
Decision: `NO_REPLICATED_DYNAMIC_CONTEXT_EFFECT`

## Frozen protocol

Market Brain v6 tested whether changes or persistence in setup-time market
context change the expectancy of AlphaPilot's existing historical scanner
setups. The protocol was committed before implementation and before any v6
result was viewed.

- Dynamic inputs: breadth impulse, flow impulse, leadership impulse,
  NIFTY/BANKNIFTY alignment, breadth persistence, and flow persistence
- Lookback: the context observation exactly 15 minutes earlier on the same IST
  trading day; no previous-day carry and no future context
- Setup window: 09:45-14:30 IST
- Baseline: all dynamically matched setups in the same LONG or SHORT direction
  within the block
- Minimum group size: 12 trades
- Effect gate: at least +/-0.20R and +/-8 percentage points versus the
  same-direction baseline
- Replication gate: the exact same direction, feature, state, and BOOST/DRAG
  classification in at least three blocks, with no opposite qualifying block

## Block results

| Block | Dates | Setups | Eligible | Dynamic matched | Match rate | Avg R | Win rate | Hypotheses | Eligible H | BOOST | DRAG |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S-0A | 2026-05-25 to 2026-06-05 | 63 | 47 | 43 | 91.5% | +0.001R | 48.8% | 33 | 10 | 0 | 1 |
| S-0B | 2026-06-08 to 2026-06-19 | 63 | 49 | 44 | 89.8% | +0.079R | 45.5% | 29 | 8 | 0 | 0 |
| S-0C | 2026-06-22 to 2026-07-03 | 48 | 38 | 33 | 86.8% | +0.116R | 54.5% | 28 | 6 | 0 | 0 |
| S-1 | 2026-07-06 to 2026-07-17 | 55 | 44 | 39 | 88.6% | +0.017R | 48.7% | 29 | 6 | 0 | 0 |
| S-2 | 2026-07-20 to 2026-07-31 | 59 | 41 | 34 | 82.9% | +0.052R | 50.0% | 31 | 8 | 0 | 0 |
| S-3 | 2026-08-03 to 2026-08-10 | 39 | 28 | 23 | 82.1% | +0.136R | 69.6% | 25 | 4 | 0 | 0 |
| **Total / weighted** | **Six independent blocks** | **327** | **247** | **216** | **87.4%** | **+0.060R** | **51.4%** | **175** | **42** | **0** | **1** |

The dynamically matched population produced +12.90R in total. This is the
aggregate expectancy of the existing scanner setups that had valid prior
context; it is not evidence that a particular dynamic state adds value.

All six blocks completed with zero context-fetch or backtest errors. Thirty-one
otherwise eligible setups were excluded from dynamic matching because the
exact prior same-day 15-minute context observation was unavailable.

## Isolated qualifying effect

| Block | Effect | State | Trades | Avg R | Delta R | Win rate | Delta win |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| S-0A | SHORT · indexAlignment=DIVERGENT_OR_MIXED | DRAG | 12 | -0.122R | -0.242R | 33.3% | -18.7pp |

This label did not qualify again in any of the remaining five blocks. No block
produced a qualifying BOOST.

## Conclusion

The frozen categorical dynamic-context features did not demonstrate a
repeatable change in setup expectancy. No breadth, flow, leadership, or index
alignment state is promoted to a production permission, veto, ranking
adjustment, or execution gate.

The production scanner, strategy parameters, stops, trailing logic, partial
exits, position sizing, risk rules, and execution-quality gates remain
unchanged.

## Research direction after v6

Market Brain v3 through v6 have now closed the static-pair, transition,
setup-conditioned, archetype-conditioned, and categorical dynamic-context
paths without a replicated effect. The next market-understanding experiment
should therefore stop adding categorical crosses.

The next candidate is a pre-registered continuous regime-quality model using
only setup-time NIFTY/BANKNIFTY trend strength, VWAP distance, realized
volatility/ATR expansion, and continuous breadth participation. It should be
trained on earlier blocks and scored once on an untouched later block, with
calibration and Brier/log-loss reported before any expectancy gate is tested.

## Limitations

- Outcomes use the existing underlying-price R backtest, not historical option
  premium P&L.
- Context uses the frozen 30-stock proxy and the 09:45-14:30 IST window.
- Dynamic states compress continuous market information into coarse categories.
- Cross-asset and news history remain excluded because timestamp-aligned
  historical inputs are not yet available.
- A positive pooled average cannot replace the pre-registered replication rule.
