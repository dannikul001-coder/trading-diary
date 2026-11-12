# Authored academy market scenes

The main diary and `academy-preview.html` load the same lesson registry. The preview stores synthetic progress separately and does not load the database client.

The 55 market topics use 27 authored price histories and 28 indicator guides. Every main context starts with at least 60 available intervals. Single-candle anatomy and aggregated candles are explicitly separate detail panels. The remaining 26 lessons retain their decision, timeline and financial calculation models.

Each price definition provides stages, its own annotations and narration, independent practice prices, and applicable comparison cases. A zone appears only after the candles needed to define it are available. Branches preserve their common prefix. Closing a revealed practice and retrying removes its continuation immediately.

The Order Block example uses an explicit teaching convention: the entire last bearish source candle before the specified impulse and observed break. Its fixed boundaries include the wick. The FVG example compares the first high and third low after the third close. Neither model claims to establish actual orders from candles. Order-flow diagrams illustrate two possible intrabar sequences with identical OHLC and are labelled as possibilities.

## Run the checks

From the repository root:

```powershell
node --test tests/academy-market-models.cjs tests/academy-terminal-chart.cjs tests/academy-studio-price.cjs tests/academy-studio-indicators.cjs tests/academy-example-cases.cjs
```

The browser checks require Playwright and Chrome or Chromium. Set `TD_NODE_MODULES` to the directory containing the `playwright` package and `TD_BROWSER` to the browser executable if the local defaults do not apply. Serve the repository with a static HTTP server on port 8767, then run:

```powershell
node tests/academy-market-browser.cjs http://127.0.0.1:8767/academy-preview.html
node tests/academy-annotation-visibility.cjs http://127.0.0.1:8767/academy-preview.html
node tests/academy-market-motion.cjs http://127.0.0.1:8767/academy-preview.html
node tests/academy-reference-browser.cjs http://127.0.0.1:8767/academy-preview.html
node tests/academy-model-controls-browser.cjs http://127.0.0.1:8767/academy-preview.html
node tests/academy-source-material-browser.cjs http://127.0.0.1:8767/academy-preview.html
node tests/academy-theme-browser.cjs http://127.0.0.1:8767/academy-preview.html
```

- `academy-market-models.cjs` verifies exact prices, aggregation, TR/ATR, immutable history, causal annotations and independent exercises.
- `academy-market-browser.cjs` opens all 55 market lessons at 1440, 390 and 320px, traverses every stage and case, checks label bounds and collisions, operates actual controls, and exercises practice, retry, tabs and notes. `TD_MARKET_REPORT` chooses its JSON report path.
- `academy-annotation-visibility.cjs` checks that explanatory labels stay below the price SVG and cannot obscure its zones, candles or points. It exercises highlighting from the label buttons, persistence across chart redraws and annotation toggling for all 55 market lessons at 1440, 390 and 320px.
- `academy-market-motion.cjs` records intermediate geometry for applicable changes, checks immediate removal of future intervals and reduced-motion behaviour, and captures every final theory model. `TD_MOTION_OUTPUT` chooses its report and gallery directory.
- `academy-reference-browser.cjs` completes all 81 lessons, including wrong and correct responses, source cases, save failures, account isolation and completion gates. `TD_REFERENCE_WIDTHS` and `TD_REFERENCE_REPORT` select widths and the report destination.
- The controls and source-material checks exercise parameter changes, numerical inputs, checklists and the additional practice material.
- The theme check covers all 18 diary presets and four lesson tabs. Use `TD_THEME_WIDTHS`, `TD_THEME_NAMES` and `TD_THEME_REPORT` to select a subset and report destination.

All browser checks use isolated synthetic browser state. No database migration, RLS modification or production data mutation is part of this change.
