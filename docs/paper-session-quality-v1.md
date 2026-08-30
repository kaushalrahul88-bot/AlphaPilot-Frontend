# Paper Session Quality Attestation v1 frontend

AlphaPilot records browser-local session evidence and asks the deterministic backend whether a unique paper-session date is clean.

## Automatic health capture

The global recorder runs only while AlphaPilot is visible and a lifecycle paper trade exists for the IST session date. It captures one snapshot for every exact underlying/expiry contract in each window:

- Early: 09:15–10:30 IST
- Mid: 11:00–13:30 IST
- Late: 14:00–15:30 IST

Each snapshot checks:

- API health with Groww configured
- successful Groww quote response for the traded underlying
- a fresh latest 5-minute candle, no more than 20 minutes old
- a positive LTP for the exact strike, expiry, and CE/PE contract

Relevant API, provider, lifecycle-mark, rate-limit, and server errors are recorded as incidents. A failed phase is retained; a later pass cannot overwrite it.

## Clean-session evidence

After 15:35 IST, the Risk Center can evaluate the session. A clean result is stored once per unique session date and is automatically supplied as `clean_paper_sessions` to the controlled-live preview.

Trade count, expectancy, profit factor, drawdown, and clean sessions are now derived from browser-local lifecycle evidence. Manual trade outcomes cannot increase these values.

## Limitations

The browser must stay open during all three health windows. Browser local storage is not tamper-evident, and Groww option LTP is not guaranteed executable fill evidence. The attestation remains paper-only; it neither enables live execution nor calls a broker order endpoint.
