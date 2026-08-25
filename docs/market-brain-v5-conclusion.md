# Market Brain v5 — Frozen Six-Block Conclusion

Research completed: 25 August 2026  
Protocol revision: `v5-frozen-2026-08-25`  
Decision: `NO_REPLICATED_ARCHETYPE_CONTEXT_EFFECT`

## Frozen protocol

Market Brain v5 tested whether the existing Market Brain context changes the
expectancy of specific historical scanner setup archetypes. Nothing was retuned
after observing a block.

- Alpha archetype: `HIGH_ALPHA` at MTF Alpha >= 75, otherwise `STANDARD_ALPHA`
- R:R archetype: `HIGH_RR` at underlying R:R >= 2.0, otherwise `STANDARD_RR`
- Time archetype: `EARLY_SETUP` through 11:30 IST, otherwise `LATE_SETUP`
- Minimum group size: 10 trades
- Effect gate: at least +/-0.20R and +/-8 percentage points versus the
  same-direction, same-archetype baseline
- Replication gate: the exact same BOOST or DRAG in at least three independent
  blocks, with no opposite qualifying block

## Block results

| Block | Dates | Setups | Eligible | Matched | Avg R | Win rate | Hypotheses | Eligible H | BOOST | DRAG |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S-0A | 2026-05-25 to 2026-06-05 | 63 | 47 | 47 | -0.037R | 46.8% | 213 | 31 | 0 | 2 |
| S-0B | 2026-06-08 to 2026-06-19 | 63 | 49 | 49 | +0.106R | 46.9% | 218 | 39 | 1 | 1 |
| S-0C | 2026-06-22 to 2026-07-03 | 48 | 38 | 38 | +0.159R | 55.3% | 189 | 25 | 0 | 2 |
| S-1 | 2026-07-06 to 2026-07-17 | 55 | 44 | 44 | -0.007R | 43.2% | 214 | 25 | 1 | 1 |
| S-2 | 2026-07-20 to 2026-07-31 | 59 | 41 | 41 | +0.059R | 51.2% | 220 | 26 | 0 | 0 |
| S-3 | 2026-08-03 to 2026-08-10 | 39 | 28 | 28 | +0.167R | 67.9% | 180 | 5 | 0 | 0 |
| **Total / weighted** | **Six independent blocks** | **327** | **247** | **247** | **+0.066R** | **50.6%** | **1,234** | **151** | **2** | **6** |

Every eligible setup matched its timestamp-aligned context observation. The
aggregate result is descriptive only; the replication decision is based on
repeated effect labels, not pooled average R.

## Isolated qualifying effects

| Block | Effect | State | Trades | Avg R | Delta R | Win rate | Delta win |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| S-0A | LONG · STANDARD_RR × leaders=3-5_LEADERS | DRAG | 11 | -0.464R | -0.252R | 18.2% | -21.8pp |
| S-0A | LONG · EARLY_SETUP × leaders=3-5_LEADERS | DRAG | 10 | -0.500R | -0.222R | 20.0% | -15.7pp |
| S-0B | LONG · STANDARD_RR × breadth=BROAD_RISK_ON | DRAG | 12 | -0.214R | -0.327R | 16.7% | -27.4pp |
| S-0B | LONG · EARLY_SETUP × breadth=MIXED | BOOST | 15 | +0.417R | +0.236R | 66.7% | +16.7pp |
| S-0C | LONG · STANDARD_RR × metals=LAGGING | DRAG | 12 | -0.305R | -0.222R | 8.3% | -22.1pp |
| S-0C | LONG · EARLY_SETUP × leaders=6+_LEADERS | DRAG | 11 | -0.280R | -0.203R | 18.2% | -13.0pp |
| S-1 | LONG · EARLY_SETUP × metals=LEADING | DRAG | 10 | -0.166R | -0.292R | 20.0% | -27.4pp |
| S-1 | LONG · STANDARD_RR × financials=LEADING | BOOST | 14 | +0.238R | +0.271R | 50.0% | +10.0pp |

None of these exact labels qualified in three blocks. S-2 and S-3 produced no
qualifying BOOST or DRAG.

## Conclusion

Market Brain context did not demonstrate a repeatable expectancy effect within
the frozen alpha, R:R and entry-time archetypes. No v5 context state is promoted
to a production permission, veto, ranking adjustment or execution gate.

The production scanner, strategy parameters, stops, trailing logic, partial
exits, position sizing and execution-quality gates remain unchanged.

## Limitations

- Outcomes use the existing underlying-price R backtest, not historical option
  premium P&L.
- Context uses the frozen 30-stock proxy and the 09:45-14:30 IST window.
- Cross-asset and news history remain excluded because timestamp-aligned
  historical inputs are not yet available.
- A pooled positive average cannot replace the pre-registered replication rule.
