# Bitcoin Studio Board

A square home-screen widget for iOS built with [Scriptable](https://scriptable.app). Shows live BTC price with a 24h sparkline, perp funding rate, Fear & Greed, block height and fees, plus a guest line and posting tally that you edit in `board.json`.

The widget pulls `board.js` from this repo on every refresh. Push a change to GitHub and the home screen updates on the next refresh, usually within 10 minutes, or immediately if you open Scriptable and run the script. No copy-paste after the first setup.

## Setup (about 3 minutes)

1. Install Scriptable from the App Store.
2. In Scriptable, tap `+`, paste the contents of `loader.js`, and name the script **Bitcoin Studio Board**.
3. Run it once inside Scriptable to confirm it renders (it shows a medium preview).
4. Long-press the home screen, add a **Scriptable** widget (the square 2x2 size is the intended one, medium and large also work), then long-press it, choose **Edit Widget**, and set **Script** to Bitcoin Studio Board.

Optional **Parameter** field on the widget:

| Value | Effect |
| --- | --- |
| `compact` | Force the small layout in any widget size |
| any `https://` URL | Use that JSON instead of this repo's `board.json` |

## Files

| File | Purpose |
| --- | --- |
| `loader.js` | The only thing pasted into Scriptable. Looks up the branch's latest commit, fetches `board.js` at that commit, caches it, runs it. |
| `board.js` | The widget itself. Edit this to change layout or data sources. |
| `board.json` | Guest, posting goal, tap URL, title. Edit this from Claude Code mobile for day-to-day changes. |

## Editing the board

`board.json`:

```json
{
  "title": "BITCOIN STUDIO BOARD",
  "shortTitle": "STUDIO BOARD",
  "guest": { "name": "Lyn Alden", "when": "Tue 2pm ET", "topic": "Fiscal dominance and the halving" },
  "posts": { "done": 3, "goal": 6 },
  "note": "",
  "tapUrl": "https://mempool.space"
}
```

`shortTitle` is the header on the square widget. `topic` and `note` only show in the large widget. `tapUrl` is what opens when you tap the widget.

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

## Why the commit lookup

`raw.githubusercontent.com` caches branch URLs for 5 minutes and ignores query strings, so a plain branch URL can serve the previous version right after a push. The loader asks the GitHub API for the branch's current commit (unauthenticated, 60 requests per hour is plenty for a widget) and fetches the file at that commit, which is immutable. If the API call fails it falls back to the branch URL.
