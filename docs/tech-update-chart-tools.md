# Tech update: terminal chart tools

17 Nov 2026

## Shipped

The `/simulate` terminal chart now has indicators and drawing tools, built on TradingView's
open source lightweight-charts. It shipped in two rounds of separate commits and deploys,
taking the repo from 28 to 58 commits.

**Indicators** (round one)

- Over the candles: Moving Average, EMA, Bollinger Bands (shaded band), VWAP (resets 00:00 UTC)
- In their own panes: RSI, MACD, Stochastic, ATR. The panes take at most 40% of the chart height.
- Legend rows show values at the cursor, with hide, settings (length, color) and remove buttons
- Values follow TradingView's definitions. MA, EMA, VWAP, RSI, MACD, Stochastic and ATR matched
  an independent calculation from Hyperliquid candles exactly. Bollinger Bands agreed within the
  price movement between readings.
- Remembered in the browser across markets and visits

**Drawing tools** (round one)

- Trend line, horizontal line, vertical line, Fib retracement, rectangle, measure, long and
  short position with risk to reward
- Select, move, reshape by handle, delete (Delete or Backspace, or the button under the chart)
- Magnet that snaps to the candle's open, high, low or close
- Hide all drawings; remove all (second click confirms)
- Anchored to time and price, so they hold across intervals; saved per market in the browser

**Drawing tools** (round two)

- Text notes: click to place, type, Enter to keep; double click or Edit to change
- Ray and extended line
- Parallel channel with a shaded band and midline; the third handle sets the width
- Fib extension: swing, pullback, and the 0.618 to 2.618 targets projected from the pullback
- Arrow and freehand brush
- Undo and redo for the last 50 drawing changes, including Remove all
- Lock drawings, so they can't be moved or deleted by a stray click
- Stay in drawing mode, to draw several in a row

**Shortcuts:** Alt+T trend line, Alt+H horizontal line, Alt+V vertical line, Alt+F Fib
retracement, Alt+R rectangle, Alt+M measure, Alt+L long, Alt+S short, Alt+N text note,
Ctrl or Cmd+Z undo, Ctrl or Cmd+Shift+Z (or Ctrl+Y) redo, Esc cursor, Delete removes the
selected drawing.

## Compared with TradingView's chart

| TradingView | Kinfield |
| --- | --- |
| Cursor and crosshair modes | Cursor only, no dot or arrow modes |
| Line tools | Trend line, ray, extended line, horizontal line, vertical line, parallel channel, arrow |
| Fibonacci and Gann tools | Fib retracement and Fib extension; no fan, time zones or Gann |
| Patterns (XABCD, head and shoulders, Elliott waves) | None |
| Forecasting (long and short position, projections) | Long and short position |
| Brushes and shapes | Brush and rectangle; no circle or path |
| Text and notes | Text notes |
| Icons and emojis | None |
| Measure | Yes |
| Zoom tool | None (scrolling zooms) |
| Magnet | Yes |
| Stay in drawing mode | Yes |
| Lock all drawings | Yes |
| Hide all drawings | Yes |
| Remove drawings | Yes |
| Undo and redo | Yes, for drawings |

Not yet in Kinfield from TradingView's top bar: Alert, Replay, chart type switching and symbol
comparison.

## Known limits

- Indicators and drawings are saved in the browser, not the account, so they don't follow a
  user to another device
- Drawing works on the candle chart only, not inside indicator panes
- The tool column holds 23 buttons and scrolls on shorter screens; TradingView groups its tools
  into fly-out menus
- Tested with a mouse and at phone width, not yet drawing with a finger on a real phone

## Next, in priority order

1. Group the tool column into fly-out menus, like TradingView
2. Save indicators and drawings to the account
3. Price alerts on drawings and levels
4. Chart patterns and the remaining Fib and Gann tools
