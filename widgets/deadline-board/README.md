# Deadline Board

A white home-screen widget for iOS built with [Scriptable](https://scriptable.app). It lists dated to-dos from `items.json` in this folder, soonest first, and flags every one by urgency:

| Flag | Meaning |
| --- | --- |
| Red | Overdue |
| Orange | Due today |
| Amber | Due within 7 days |
| Blue | Due later |
| Gray | No date |
| Green check | Done (only shown when `showDone` is true) |

The header pill shows the overdue count, otherwise today's count, otherwise how many are open. Tapping the widget opens `items.json` on GitHub for editing.

## Setup

1. In Scriptable, tap `+`, paste the contents of `loader.js`, name the script **Deadline Board**, tap play once.
2. Add a Scriptable widget to the home screen (square shows 5 items, medium 5 with fuller dates, large 12), long-press it, Edit Widget, set Script to Deadline Board.

## Adding reminders

Edit `items.json` in Claude Code mobile and push. The widget picks it up on its next refresh (about 15 minutes), or immediately if you open Scriptable and tap play.

```json
{
  "title": "DEADLINES",
  "showDone": false,
  "items": [
    { "text": "Send speaker captions", "due": "2026-10-30" },
    { "text": "Call with legal", "due": "2026-11-03 15:00" },
    { "text": "Renew domain", "due": "2026-11-20", "done": true }
  ]
}
```

| Field | Notes |
| --- | --- |
| `text` | What to do. One line; long text shrinks to fit. |
| `due` | `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`, local time. Optional. |
| `done` | `true` hides the item unless `showDone` is on. |
| `showDone` | Top level. Show finished items with a green check at the bottom. |
| `tapUrl` | Top level, optional. Override what opens when you tap the widget. |

Widget **Parameter** (optional): a URL to a different `items.json`.

## Files

| File | Purpose |
| --- | --- |
| `loader.js` | The only thing pasted into Scriptable. Resolves the branch's latest commit, fetches `board.js` at that commit, caches it, runs it. |
| `board.js` | The widget. |
| `items.json` | Your reminders. |

After merging to `main`, change `branch` in the loader inside Scriptable and in the `SRC` block at the top of `board.js`.
