# Market Brain v7 — Frozen Continuous-Regime Conclusion

Research completed: 25 August 2026  
Protocol revision: `v7-frozen-2026-08-25`  
Decision: `NO_VALIDATED_CONTINUOUS_REGIME_QUALITY_EDGE`

## Frozen protocol

Market Brain v7 tested one deterministic, interpretable continuous model after
Market Brain v3 through v6 closed the categorical context paths.

- Development period: 25 May through 10 August 2026
- Locked holdout H-1: 11 through 21 August 2026
- Setup population: the unchanged historical scanner for RELIANCE, HDFCBANK,
  ICICIBANK, SBIN, TCS, INFY, TATASTEEL, and MARUTI
- Setup window: 09:45-14:30 IST
- Features: direction-signed continuous breadth, flow, NIFTY/BANKNIFTY VWAP
  distance, NIFTY/BANKNIFTY trend strength, and unsigned volatility expansion
- Model: one L2-regularized logistic regression
- Standardization: development observations only
- Fit: fixed 1,200 full-batch iterations, learning rate 0.05 and L2 0.20
- Holdout use: scored once with no refit, feature change, threshold search or
  calibration adjustment

The protocol and gates were committed before implementation and before H-1 was
collected.

## Development collection

| Block | Dates | Setups | Eligible | Matched | Match rate | Avg R | Win rate | Context errors | Backtest errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S-0A | 2026-05-25 to 2026-06-05 | 63 | 47 | 47 | 100.0% | -0.037R | 46.8% | 0 | 0 |
| S-0B | 2026-06-08 to 2026-06-19 | 63 | 49 | 49 | 100.0% | +0.106R | 46.9% | 0 | 0 |
| S-0C | 2026-06-22 to 2026-07-03 | 48 | 38 | 38 | 100.0% | +0.159R | 55.3% | 0 | 0 |
| S-1 | 2026-07-06 to 2026-07-17 | 55 | 44 | 44 | 100.0% | -0.007R | 43.2% | 0 | 0 |
| S-2 | 2026-07-20 to 2026-07-31 | 59 | 41 | 41 | 100.0% | +0.059R | 51.2% | 0 | 0 |
| S-3 | 2026-08-03 to 2026-08-10 | 39 | 28 | 28 | 100.0% | +0.167R | 67.9% | 0 | 0 |
| **Total / weighted** | **Six development blocks** | **327** | **247** | **247** | **100.0%** | **+0.066R** | **50.6%** | **0** | **0** |

The development sample contained 125 wins from 247 observations.

## Locked holdout result

| Block | Dates | Setups | Eligible | Matched | Match rate | Avg R | Win rate | Total R | Errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| H-1 | 2026-08-11 to 2026-08-21 | 52 | 48 | 48 | 100.0% | -0.132R | 37.5% | -6.34R | 0 |

H-1 contained 18 wins and 30 non-wins. It passed the frozen sample gate:
at least 36 observations, at least 10 wins and 10 non-wins, and 16
observations in each probability band.

## Probability performance

| Metric | Model | Constant baseline | Improvement | Frozen gate | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Brier score | 0.253218 | 0.251555 | -0.66% | at least +10% | FAIL |
| Log loss | 0.699604 | 0.696258 | -0.48% | at least +5% | FAIL |
| ROC AUC | 0.505556 | — | — | at least 0.60 | FAIL |

The model was slightly worse than predicting the development win rate of
50.6073% for every H-1 setup. Its AUC was effectively random.

## Probability-band economics

| Band | Trades | Avg predicted probability | Actual win rate | Avg R | Total R |
| --- | ---: | ---: | ---: | ---: | ---: |
| LOW | 16 | 47.28% | 31.2% | -0.221R | -3.54R |
| MID | 16 | 50.62% | 43.8% | -0.094R | -1.51R |
| HIGH | 16 | 55.22% | 37.5% | -0.081R | -1.29R |

- HIGH-minus-LOW win-rate spread: +6.3 percentage points; frozen gate +10pp
- HIGH-minus-LOW average-R spread: +0.140R; frozen gate +0.20R
- HIGH average R: -0.081R; frozen gate at least +0.10R

All three economic gates failed. The HIGH band lost less than the LOW band, but
the difference was too small and did not produce a positive high-quality group.

## Standardized coefficients

| Feature | Coefficient |
| --- | ---: |
| breadth_alignment | -0.009147 |
| flow_alignment | -0.028349 |
| nifty_vwap_alignment | 0.000000 |
| bank_vwap_alignment | 0.000000 |
| nifty_trend_alignment | -0.102623 |
| bank_trend_alignment | +0.160381 |
| volatility_expansion | +0.088928 |

These coefficients are descriptive fitted parameters, not validated trading
weights. None may be reused as a production score.

## Acceptance decision

| Gate | Result |
| --- | --- |
| Holdout sample | PASS |
| Brier improvement at least 10% | FAIL |
| Log-loss improvement at least 5% | FAIL |
| ROC AUC at least 0.60 | FAIL |
| HIGH-minus-LOW win spread at least 10pp | FAIL |
| HIGH-minus-LOW average-R spread at least +0.20R | FAIL |
| HIGH average R at least +0.10R | FAIL |

The preregistered decision is therefore
`NO_VALIDATED_CONTINUOUS_REGIME_QUALITY_EDGE`.

## Conclusion

The continuous market regime measurements did not calibrate setup win
probability better than the constant baseline and did not create a sufficiently
strong economic ordering in the untouched H-1 period.

No v7 probability, coefficient, feature, band or threshold is promoted to a
production permission, veto, ranking adjustment, position-size adjustment or
execution gate. Strategy parameters, stops, trailing logic, partial exits,
portfolio rules and live execution remain unchanged.

## Market Brain research direction after v7

Market Brain v3 through v7 have now tested static interactions, transitions,
setup-conditioned context, archetype-conditioned context, categorical dynamic
context and a continuous calibrated model without a replicated or validated
predictive edge.

Predictive Market Brain feature expansion is closed. AlphaPilot should retain
Market Brain as descriptive situational awareness, diagnostics and a research
record, not as a trade permission engine.

The next development priority is software-enforced risk and discipline:

1. portfolio-level position sizing and capital-at-risk accounting;
2. daily loss and consecutive-loss lockouts;
3. maximum concurrent and correlated exposure;
4. cooldown and no-revenge-trade enforcement; and
5. paper-to-controlled-live execution validation.

## Evidence

- Frozen runner: GitHub Actions run `32829764385`
- Evidence artifact: `market-brain-v7-frozen-evidence`, artifact ID
  `9556799107`, retained for 30 days
- Artifact SHA-256:
  `767b093c98b9e768dc44d9d0a61d212afb254ff615d988e98f27e85b80b3be1e`

## Limitations

- Outcomes use underlying-price R rather than historical option-premium P&L.
- Breadth uses the frozen 30-stock proxy rather than the full NSE universe.
- H-1 contains 48 observations; it passes the frozen floor but remains a short
  validation period.
- Cross-asset and news history remain excluded without timestamp-aligned data.
- The result closes the frozen v7 hypothesis; it does not prove that all
  possible market-context models can never work.
