# Deadline Board

A white home-screen widget for iOS built with [Scriptable](https://scriptable.app), with a scrollable checklist behind it and local reminders.

**Widget.** Your dated to-dos from `items.json`, soonest first, each with a checkbox tinted by urgency. Top right: a counter of active tasks, plus a pill when anything is overdue or due today. The large size groups items under Overdue, Today, This week, Later and Done. Small and medium show the top three.

| Checkbox color | Meaning |
| --- | --- |
| Red | Overdue |
| Orange | Due today |
| Amber | Due within 7 days |
| Blue | Due later |
| Gray | No date |
| Green check | Done |

**Checklist.** iOS widgets can't scroll or take taps on rows, so tapping the widget opens Scriptable with the full list. Tap a task to check it off, tap again to undo. **Add task** at the top opens a form: what to do, and when in plain words. **Clear completed** removes checked tasks. Everything you add or check on the phone is stored on the phone, so no GitHub credentials are needed. Tasks can also live in `items.json` in the repo for anything you want versioned or edited from Claude Code.

The "When" field understands: `tomorrow`, `fri`, `next mon 9:30am`, `nov 12`, `12 nov`, `11/12`, `in 3 days`, `next week`, `2026-11-12 15:00`, a bare time like `5pm` (today), or blank for no date.

**Reminders.** On every refresh the script re-schedules local notifications for open tasks: 9:00 the day before and on the due day, 1 hour before a timed task, and a morning digest when anything is overdue or due today. Checking a task off cancels its reminders on the next refresh. The first time, iOS asks for notification permission: run the script inside Scriptable once and tap Allow.

## Setup

1. In Scriptable, tap `+`, paste the contents of `loader.js`, name the script **Deadline Board**, tap play once and allow notifications.
2. Add a **large** Scriptable widget to the home screen, long-press it, Edit Widget, set Script to Deadline Board.

## Adding tasks from the repo

Tap **Add task** in the checklist for day-to-day use. For tasks you want in the repo, edit `items.json` and push. The widget picks it up on its next refresh (about 15 minutes), or immediately if you open Scriptable and tap play.

```json
{
  "title": "Deadlines",
  "notify": { "enabled": true, "hour": 9, "minute": 0, "daysBefore": [1], "digest": true },
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
| `done` | `true` marks it finished. Done items show with a green check, at most two on the widget. |
| `showDone` | Top level, set `false` to hide finished items from the widget entirely. |
| `notify.hour` / `minute` | When daily reminders fire. |
| `notify.daysBefore` | Extra reminder days ahead of the due date, e.g. `[1, 3]`. The due day itself is always included. |
| `notify.digest` | Morning summary when anything is overdue or due today. |
| `notify.enabled` | `false` turns all reminders off. |
| `tapUrl` | Top level, optional. Where "Edit the shared list on GitHub" in the checklist opens. |

Widget **Parameter** (optional): a URL to a different `items.json`.

## Files

| File | Purpose |
| --- | --- |
| `loader.js` | The only thing pasted into Scriptable. Resolves the branch's latest commit, fetches `board.js` at that commit, caches it, runs it. |
| `board.js` | Widget, checklist and reminder scheduling. |
| `items.json` | Your reminders. |

After merging to `main`, change `branch` in the loader inside Scriptable and in the `SRC` block at the top of `board.js`.
