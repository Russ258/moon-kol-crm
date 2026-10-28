# Bitcoin Studio Board

A home-screen widget for iOS built with [Scriptable](https://scriptable.app). Shows live BTC price and 24h change, perp funding rate, Fear & Greed, block height and fees, plus a guest line and posting tally that you edit in `board.json`.

The widget pulls `board.js` from this repo on every refresh. Push a change to GitHub and the home screen updates within about 10 minutes. No copy-paste after the first setup.

## Setup (about 3 minutes)

1. Install Scriptable from the App Store.
2. In Scriptable, tap `+`, paste the contents of `loader.js`, and name the script **Bitcoin Studio Board**.
3. Run it once inside Scriptable to confirm it renders (it shows a medium preview).
4. Long-press the home screen, add a **Scriptable** widget (medium is the intended size, small and large also work), then long-press it, choose **Edit Widget**, and set **Script** to Bitcoin Studio Board.

Optional **Parameter** field on the widget:

| Value | Effect |
| --- | --- |
| `compact` | Force the small layout in any widget size |
| any `https://` URL | Use that JSON instead of this repo's `board.json` |

## Files

| File | Purpose |
| --- | --- |
| `loader.js` | The only thing pasted into Scriptable. Fetches `board.js` from GitHub, caches it, runs it. |
| `board.js` | The widget itself. Edit this to change layout or data sources. |
| `board.json` | Guest, posting goal, tap URL, title. Edit this from Claude Code mobile for day-to-day changes. |

## Editing the board

`board.json`:

```json
{
  "title": "BITCOIN STUDIO BOARD",
  "guest": { "name": "Lyn Alden", "when": "Tue 2pm ET", "topic": "Fiscal dominance and the halving" },
  "posts": { "done": 3, "goal": 6 },
  "note": "",
  "tapUrl": "https://mempool.space"
}
```

`topic` and `note` only show in the large widget. `tapUrl` is what opens when you tap the widget.

## Data sources

All public, no keys. Each stat tries sources in order and falls back to the last good value (header shows `cached`) if every source fails.

| Stat | Sources tried in order |
| --- | --- |
| Price and 24h change | CoinGecko, Coinbase Exchange, Kraken |
| Funding rate | Bybit, OKX, Binance Futures |
| Fear & Greed | alternative.me |
| Block height | mempool.space, blockstream.info |
| Fees | mempool.space |

## Branch note

`loader.js` and `board.js` both point at the branch `claude/phone-widget-idea-h8ttos`. After merging to `main`, change `branch` in the loader inside Scriptable and in the `SRC` block at the top of `board.js`.
