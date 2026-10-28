// DEADLINE_BOARD — Scriptable widget
// White board of dated to-dos from items.json in this folder. Every item gets a
// flag colored by urgency: red overdue, orange today, amber within 7 days, blue
// later. Sorted soonest first. Loaded on each refresh by loader.js, so pushing
// a new items.json to GitHub updates the home screen.
//
// items.json:
//   { "title": "DEADLINES", "showDone": false,
//     "items": [ { "text": "Send captions", "due": "2026-10-30", "done": false },
//                { "text": "Call at 3", "due": "2026-10-28 15:00" } ] }
// "due" is YYYY-MM-DD or YYYY-MM-DD HH:mm in your local time.
//
// Widget parameter (optional): a URL to a different items.json.

const SRC = (typeof BSB !== "undefined" && BSB) || {
  repo: "Russ258/moon-kol-crm",
  branch: "claude/phone-widget-idea-h8ttos",
  dir: "widgets/deadline-board",
  sha: null,
};

const RAW = `https://raw.githubusercontent.com/${SRC.repo}/${SRC.sha || SRC.branch}/${SRC.dir}`;
const ITEMS_URL = `${RAW}/items.json`;
const REFRESH_MINUTES = 15;
const DAY = 86400000;

const C = {
  bg: new Color("#FFFFFF"),
  text: new Color("#111827"),
  muted: new Color("#6B7280"),
  dim: new Color("#9CA3AF"),
  line: new Color("#E5E7EB"),
  red: new Color("#DC2626"),
  orange: new Color("#EA580C"),
  amber: new Color("#D97706"),
  blue: new Color("#2563EB"),
  green: new Color("#16A34A"),
};

const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), "deadline-board.items.json");

// ---------- data ----------

async function fetchItems() {
  const param = (args.widgetParameter || "").trim();
  const url = /^https?:\/\//.test(param) ? param : ITEMS_URL;
  try {
    const r = new Request(url);
    r.timeoutInterval = 8;
    const j = await r.loadJSON();
    if (!j || !Array.isArray(j.items)) throw new Error("items.json has no items array");
    try { fm.writeString(CACHE, JSON.stringify(j)); } catch (e) {}
    return { cfg: j, stale: false };
  } catch (e) {
    if (fm.fileExists(CACHE)) {
      try { return { cfg: JSON.parse(fm.readString(CACHE)), stale: true }; } catch (e2) {}
    }
    return { cfg: { title: "DEADLINES", items: [], error: String(e) }, stale: true };
  }
}

// "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" in local time. Returns { date, hasTime } or null.
function parseDue(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const hasTime = m[4] !== undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hasTime ? Number(m[4]) : 0, hasTime ? Number(m[5]) : 0, 0, 0);
  if (isNaN(d.getTime())) return null;
  return { date: d, hasTime };
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function prepare(cfg) {
  const today = startOfDay(new Date());
  const now = new Date();
  const out = [];
  for (const raw of cfg.items) {
    if (!raw || !raw.text) continue;
    if (raw.done && !cfg.showDone) continue;
    const due = parseDue(raw.due);
    let days = null, overdue = false;
    if (due) {
      days = Math.round((startOfDay(due.date) - today) / DAY);
      overdue = due.hasTime ? due.date < now : days < 0;
    }
    out.push({ text: String(raw.text), due, days, overdue, done: !!raw.done });
  }
  out.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ta = a.due ? a.due.date.getTime() : Infinity;
    const tb = b.due ? b.due.date.getTime() : Infinity;
    return ta - tb;
  });
  return out;
}

// ---------- formatting ----------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtClock(d) {
  const df = new DateFormatter();
  df.useShortTimeStyle();
  return df.string(d).replace(/\s/g, "").toLowerCase();
}

function fmtWhen(item, wide) {
  if (!item.due) return "no date";
  const d = item.due.date, days = item.days;
  const time = item.due.hasTime ? " " + fmtClock(d) : "";
  if (days < 0) return days === -1 ? "Yesterday" : `${-days}d overdue`;
  if (days === 0) return "Today" + time;
  if (days === 1) return "Tomorrow" + time;
  if (days < 7) return WEEKDAYS[d.getDay()] + (wide ? time : "");
  const md = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return wide ? `${WEEKDAYS[d.getDay()]} ${md}` : md;
}

function flagColor(item) {
  if (item.done) return C.green;
  if (!item.due) return C.dim;
  if (item.overdue) return C.red;
  if (item.days === 0) return C.orange;
  if (item.days < 7) return C.amber;
  return C.blue;
}

function tracked(s) {
  return s.split("").join(" ");
}

// ---------- UI ----------

function label(stack, text, size, color, font) {
  const t = stack.addText(text);
  t.font = font || Font.systemFont(size);
  t.textColor = color || C.text;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

function symbol(stack, name, size, color, fallback) {
  try {
    const sym = SFSymbol.named(name);
    if (sym && sym.image) {
      sym.applyFont(Font.boldSystemFont(size));
      const img = stack.addImage(sym.image);
      img.imageSize = new Size(size, size);
      img.tintColor = color;
      return img;
    }
  } catch (e) {}
  return label(stack, fallback, size, color);
}

function pill(stack, text, color, size) {
  const p = stack.addStack();
  p.layoutHorizontally();
  p.centerAlignContent();
  p.backgroundColor = new Color(color.hex, 0.12);
  p.cornerRadius = 6;
  p.setPadding(1.5, 6, 1.5, 6);
  label(p, text, size, color, Font.boldSystemFont(size));
  return p;
}

function header(w, cfg, items, stale, size) {
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const overdue = items.filter((i) => i.overdue && !i.done).length;
  const today = items.filter((i) => i.days === 0 && !i.overdue && !i.done).length;
  symbol(row, "flag.fill", size, overdue ? C.red : today ? C.orange : C.text, "⚑");
  row.addSpacer(6);
  label(row, tracked(((cfg && cfg.title) || "DEADLINES").toUpperCase()), size - 1, C.text, Font.heavySystemFont(size - 1));
  row.addSpacer();
  if (overdue) pill(row, `${overdue} overdue`, C.red, size - 2);
  else if (today) pill(row, `${today} today`, C.orange, size - 2);
  else if (stale) pill(row, "offline", C.dim, size - 2);
  else pill(row, `${items.filter((i) => !i.done).length} open`, C.muted, size - 2);
}

function itemRow(w, item, textSize, wide) {
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const col = flagColor(item);
  symbol(row, item.done ? "checkmark.circle.fill" : "flag.fill", textSize - 1, col, item.done ? "✓" : "⚑");
  row.addSpacer(6);
  const t = label(row, item.text, textSize, item.done ? C.dim : C.text, Font.mediumSystemFont(textSize));
  t.minimumScaleFactor = 0.85;
  row.addSpacer(6);
  const when = label(row, fmtWhen(item, wide), textSize - 1.5, item.done ? C.dim : item.overdue || item.days === 0 ? col : C.muted, Font.semiboldSystemFont(textSize - 1.5));
  when.lineLimit = 1;
}

function emptyRow(w, cfg, size) {
  w.addSpacer();
  const msg = cfg.error ? "Couldn't load items.json" : "Nothing due. Add items in items.json";
  const t = w.addText(msg);
  t.font = Font.mediumSystemFont(size);
  t.textColor = C.muted;
  t.centerAlignText();
  w.addSpacer();
}

function moreRow(w, n, size) {
  const row = w.addStack();
  row.layoutHorizontally();
  row.addSpacer(size + 5);
  label(row, `+${n} more`, size - 1, C.dim, Font.mediumSystemFont(size - 1));
}

function build(items, cfg, stale, family) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  const spec = {
    small: { pad: [11, 12, 11, 12], head: 11, text: 10, rows: 5, gap: 5, wide: false },
    medium: { pad: [12, 14, 12, 14], head: 12, text: 11.5, rows: 5, gap: 6, wide: true },
    large: { pad: [14, 16, 14, 16], head: 13, text: 12.5, rows: 12, gap: 7, wide: true },
  }[family] || {};
  w.setPadding(...spec.pad);
  header(w, cfg, items, stale, spec.head);
  w.addSpacer(spec.gap + 2);

  if (items.length === 0) {
    emptyRow(w, cfg, spec.text);
    return w;
  }
  const shown = items.slice(0, spec.rows);
  shown.forEach((item, i) => {
    if (i > 0) w.addSpacer(spec.gap);
    itemRow(w, item, spec.text, spec.wide);
  });
  if (items.length > shown.length) {
    w.addSpacer(spec.gap);
    moreRow(w, items.length - shown.length, spec.text);
  }
  w.addSpacer();
  return w;
}

// ---------- main ----------

const { cfg, stale } = await fetchItems();
const items = prepare(cfg);
const fam = config.widgetFamily || "medium";
const family = fam === "small" ? "small" : fam === "large" || fam === "extraLarge" ? "large" : "medium";
const widget = build(items, cfg, stale, family);
widget.url = cfg.tapUrl || `https://github.com/${SRC.repo}/edit/${SRC.branch}/${SRC.dir}/items.json`;
widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else if (family === "small") {
  await widget.presentSmall();
} else if (family === "large") {
  await widget.presentLarge();
} else {
  await widget.presentMedium();
}
Script.complete();
