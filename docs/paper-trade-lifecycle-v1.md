# Paper Trade Lifecycle v1 frontend

The Risk Center can open an exact NSE option paper position from a successful PAPER risk decision and maintain it using the backend's live Groww option-chain observations.

## Workflow

1. Enter the underlying, exact expiry, strike, option type, premium stop/target, lot size, and expected costs.
2. Pass the deterministic operational and portfolio risk gates.
3. Open the exact paper position within two minutes.
4. The backend fetches live Groww LTP, replaces the estimated entry, and re-runs all hard gates.
5. While Risk Center is visible, open trades are marked every 60 seconds during weekday 09:15–15:30 IST.
6. Stop or target crossings close automatically. Manual paper close is also available at a freshly fetched LTP.
7. Open defined risk/exposure and verified closed P&L are fed into the next discipline evaluation.

## Safety

No broker order API is present. Every lifecycle state must keep paper-only true, live execution false, and order endpoint called false. Mock data, stale decisions, contract mismatch, non-whole-lot state, failed operational gates, and out-of-session marks fail closed.

The browser must remain open for automatic checks. Local storage is not tamper-evident. Groww LTP is not guaranteed executable bid/ask fill evidence. Clean paper sessions remain zero until a separate session-quality attestation is built, so lifecycle outcomes alone cannot unlock controlled-live eligibility.
