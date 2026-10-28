// DEADLINE_BOARD — Scriptable widget + in-app checklist + reminders
//
// Widget: white board of dated to-dos from items.json, soonest first, each
//   with a checkbox tinted by urgency (red overdue, orange today, amber this
//   week, blue later). Tap the widget to open the full list.
// In app (tap the widget, or run the script): a scrollable checklist. Tap a
//   task to check it off, "Add task" at the top to add one. Added tasks and
//   check-offs are stored on this phone, so no GitHub credentials are needed.
//   Tasks can also live in items.json in the repo; "done": true works there.
// Notifications: on every refresh the script re-schedules local reminders for
//   open tasks (default: 9:00 the day before and on the due day, 1 hour before
//   a timed task, and a morning digest when anything is overdue or due today).
//   iOS asks for notification permission the first time; run the script in
//   Scriptable once and tap Allow.
//
// items.json:
//   { "title": "Deadlines",
//     "notify": { "enabled": true, "hour": 9, "minute": 0, "daysBefore": [1], "digest": true },
//     "items": [ { "text": "Send captions", "due": "2026-10-30" },
//                { "text": "Call at 3", "due": "2026-10-28 15:00" },
//                { "text": "Finished thing", "due": "2026-10-26", "done": true } ] }
// "due" is YYYY-MM-DD or YYYY-MM-DD HH:mm in your local time. Optional.
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
const NOTIF_PREFIX = "deadline-board:";
const MAX_NOTIFS = 40;

const C = {
  bg: new Color("#FFFFFF"),
  text: new Color("#1F2937"),
  muted: new Color("#6B7280"),
  dim: new Color("#A1A1AA"),
  line: new Color("#F1F5F9"),
  red: new Color("#DC2626"),
  orange: new Color("#EA580C"),
  amber: new Color("#D97706"),
  blue: new Color("#2563EB"),
  green: new Color("#16A34A"),
};

const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), "deadline-board.items.json");
const STATE = fm.joinPath(fm.documentsDirectory(), "deadline-board.state.json");

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
    return { cfg: { title: "Deadlines", items: [], error: String(e) }, stale: true };
  }
}

// Phone-side state:
//   overrides: { "<text>|<due>": true|false }   check-offs for repo items
//   hidden:    { "<text>|<due>": true }          repo items cleared from the list
//   local:     [ { id, text, due, done, created } ]  tasks added on the phone
function readState() {
  let s = {};
  try {
    if (fm.fileExists(STATE)) {
      const parsed = JSON.parse(fm.readString(STATE));
      if (parsed && typeof parsed === "object") s = parsed;
    }
  } catch (e) {}
  return Object.assign({ overrides: {}, hidden: {}, local: [] }, s);
}

function writeState(state) {
  try { fm.writeString(STATE, JSON.stringify(state)); } catch (e) {}
}

function itemKey(raw) {
  return `${String(raw.text).trim()}|${raw.due ? String(raw.due).trim() : ""}`;
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

function prepare(cfg, state) {
  const today = startOfDay(new Date());
  const now = new Date();
  const out = [];
  const repo = (cfg.items || []).map((r) => Object.assign({}, r, { source: "repo" }));
  const local = (state.local || []).map((l) => Object.assign({}, l, { source: "local" }));
  for (const raw of repo.concat(local)) {
    if (!raw || !raw.text) continue;
    const key = raw.source === "local" ? `local:${raw.id}` : itemKey(raw);
    if (raw.source === "repo" && state.hidden[key]) continue;
    const override = raw.source === "repo" ? state.overrides[key] : undefined;
    const done = typeof override === "boolean" ? override : !!raw.done;
    const due = parseDue(raw.due);
    let days = null, overdue = false;
    if (due) {
      days = Math.round((startOfDay(due.date) - today) / DAY);
      overdue = due.hasTime ? due.date < now : days < 0;
    }
    out.push({ key, text: String(raw.text), due, days, overdue, done, source: raw.source, id: raw.id });
  }
  out.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ta = a.due ? a.due.date.getTime() : Infinity;
    const tb = b.due ? b.due.date.getTime() : Infinity;
    return ta - tb;
  });
  return out;
}

function groupOf(item) {
  if (item.done) return "done";
  if (!item.due) return "nodate";
  if (item.overdue) return "overdue";
  if (item.days === 0) return "today";
  if (item.days < 7) return "week";
  return "later";
}

const GROUP_LABEL = { overdue: "Overdue", today: "Today", week: "This week", later: "Later", nodate: "No date", done: "Done" };

// ---------- formatting ----------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtClock(d) {
  const df = new DateFormatter();
  df.useShortTimeStyle();
  return df.string(d).replace(/\s/g, "").toLowerCase();
}

function fmtWhen(item, wide) {
  if (!item.due) return "No date";
  const d = item.due.date, days = item.days;
  const time = item.due.hasTime ? " " + fmtClock(d) : "";
  if (days < 0) return days === -1 ? "Yesterday" : `${-days} days ago`;
  if (days === 0) return item.overdue ? "Earlier today" : "Today" + time;
  if (days === 1) return "Tomorrow" + time;
  if (days < 7) return WEEKDAYS[d.getDay()] + (wide ? time : "");
  const md = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return wide ? `${WEEKDAYS[d.getDay()]}, ${md}` : md;
}

function fmtToday() {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function urgencyColor(item) {
  if (item.done) return C.green;
  if (!item.due) return C.dim;
  if (item.overdue) return C.red;
  if (item.days === 0) return C.orange;
  if (item.days < 7) return C.amber;
  return C.blue;
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

// ---------- notifications ----------

async function scheduleNotifications(items, cfg) {
  const prefs = Object.assign({ enabled: true, hour: 9, minute: 0, daysBefore: [1], digest: true }, cfg.notify || {});
  try {
    const pending = await Notification.allPending();
    const ours = pending.filter((n) => n.identifier && n.identifier.startsWith(NOTIF_PREFIX)).map((n) => n.identifier);
    if (ours.length) await Notification.removePending(ours);
  } catch (e) {}
  if (!prefs.enabled) return 0;

  const now = new Date();
  const open = items.filter((i) => !i.done && i.due);
  let count = 0;

  async function add(id, when, title, body) {
    if (when <= now || count >= MAX_NOTIFS) return;
    const n = new Notification();
    n.identifier = NOTIF_PREFIX + id;
    n.title = title;
    n.body = body;
    n.sound = "default";
    n.threadIdentifier = "deadline-board";
    try { n.scriptName = Script.name(); } catch (e) {}
    n.setTriggerDate(when);
    await n.schedule();
    count++;
  }

  for (const it of open) {
    const dueDay = startOfDay(it.due.date);
    const offsets = Array.from(new Set([0].concat(prefs.daysBefore || []))).filter((d) => Number.isInteger(d) && d >= 0);
    for (const db of offsets) {
      const t = new Date(dueDay);
      t.setDate(t.getDate() - db);
      t.setHours(prefs.hour, prefs.minute, 0, 0);
      const title = db === 0 ? "Due today" : db === 1 ? "Due tomorrow" : `Due in ${db} days`;
      const body = it.text + (it.due.hasTime ? ` · ${fmtClock(it.due.date)}` : "");
      await add(hash(it.key + "|d" + db), t, title, body);
    }
    if (it.due.hasTime) {
      const t = new Date(it.due.date.getTime() - 3600 * 1000);
      await add(hash(it.key + "|h1"), t, "Due in 1 hour", `${it.text} · ${fmtClock(it.due.date)}`);
    }
  }

  if (prefs.digest) {
    const t = new Date();
    t.setHours(prefs.hour, prefs.minute, 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    const byThen = open.filter((i) => startOfDay(i.due.date) <= startOfDay(t));
    if (byThen.length) {
      const overdue = byThen.filter((i) => startOfDay(i.due.date) < startOfDay(t)).length;
      const title = overdue ? `${byThen.length} pending, ${overdue} overdue` : `${byThen.length} due today`;
      const body = byThen.slice(0, 3).map((i) => i.text).join(" · ") + (byThen.length > 3 ? ` · +${byThen.length - 3} more` : "");
      await add("digest-" + hash(String(startOfDay(t).getTime())), t, title, body);
    }
  }
  return count;
}

// ---------- widget UI ----------

function label(stack, text, size, color, font) {
  const t = stack.addText(text);
  t.font = font || Font.systemFont(size);
  t.textColor = color || C.text;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.8;
  return t;
}

function symbol(stack, name, size, color, fallback) {
  try {
    const sym = SFSymbol.named(name);
    if (sym && sym.image) {
      sym.applyFont(Font.semiboldSystemFont(size));
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
  p.backgroundColor = new Color(color.hex, 0.10);
  p.cornerRadius = 8;
  p.setPadding(3, 8, 3, 8);
  label(p, text, size, color, Font.semiboldSystemFont(size));
  return p;
}

function summary(items) {
  const open = items.filter((i) => !i.done);
  return {
    open: open.length,
    overdue: open.filter((i) => i.overdue).length,
    today: open.filter((i) => i.days === 0 && !i.overdue).length,
  };
}

function countBadgeImage(n, size, color) {
  const ctx = new DrawContext();
  const w = n >= 10 ? size * 1.45 : size;
  ctx.size = new Size(w, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const p = new Path();
  p.addRoundedRect(new Rect(0, 0, w, size), size / 2, size / 2);
  ctx.setFillColor(color);
  ctx.addPath(p);
  ctx.fillPath();
  ctx.setFont(Font.boldSystemFont(size * 0.56));
  ctx.setTextColor(Color.white());
  ctx.setTextAlignedCenter();
  ctx.drawTextInRect(String(n), new Rect(0, size * 0.14, w, size));
  return { image: ctx.getImage(), width: w };
}

// Active-task counter for the top right. Drawn as an image so the number can't
// get squeezed out of a fixed-size stack.
function countBadge(stack, n, color, size) {
  const b = countBadgeImage(n, size, color);
  const img = stack.addImage(b.image);
  img.imageSize = new Size(b.width, size);
  img.resizable = false;
  return img;
}

function header(w, cfg, items, stale, spec) {
  const s = summary(items);
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const title = (cfg && cfg.title) || "Deadlines";
  label(row, title, spec.title, C.text, Font.boldSystemFont(spec.title));
  row.addSpacer();
  if (s.overdue) {
    pill(row, `${s.overdue} overdue`, C.red, spec.pill);
    row.addSpacer(6);
  } else if (s.today) {
    pill(row, `${s.today} today`, C.orange, spec.pill);
    row.addSpacer(6);
  }
  const badgeColor = s.open === 0 ? C.green : s.overdue ? C.red : s.today ? C.orange : C.text;
  countBadge(row, s.open, badgeColor, spec.title + 6);
  if (spec.subtitle) {
    w.addSpacer(2);
    const open = s.open === 0 ? "All clear" : `${s.open} active task${s.open === 1 ? "" : "s"}`;
    label(w, `${fmtToday()}  ·  ${open}${stale ? "  ·  offline copy" : ""}`, spec.sub, C.muted, Font.mediumSystemFont(spec.sub));
  }
}

function sectionLabel(w, text, size) {
  label(w, text.toUpperCase(), size, C.dim, Font.semiboldSystemFont(size));
}

function itemRow(w, item, spec) {
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.cornerRadius = 10;
  row.setPadding(spec.rowPad, 8, spec.rowPad, 8);
  const col = urgencyColor(item);
  if (!item.done && (item.overdue || item.days === 0)) row.backgroundColor = new Color(col.hex, 0.07);

  symbol(row, item.done ? "checkmark.circle.fill" : "circle", spec.text + 4, item.done ? C.green : col, item.done ? "☑" : "☐");
  row.addSpacer(9);
  const t = label(row, item.text, spec.text, item.done ? C.dim : C.text, Font.mediumSystemFont(spec.text));
  t.minimumScaleFactor = 0.85;
  row.addSpacer(8);
  const hot = !item.done && (item.overdue || item.days === 0);
  label(row, fmtWhen(item, spec.wide), spec.text - 3, item.done ? C.dim : hot ? col : C.muted, Font.semiboldSystemFont(spec.text - 3));
}

function emptyState(w, cfg, spec) {
  w.addSpacer();
  const row = w.addStack();
  row.layoutHorizontally();
  row.addSpacer();
  symbol(row, cfg.error ? "wifi.exclamationmark" : "checkmark.seal.fill", spec.text + 10, cfg.error ? C.dim : C.green, "✓");
  row.addSpacer();
  w.addSpacer(6);
  const t = w.addText(cfg.error ? "Couldn't load items.json" : "Nothing to do");
  t.font = Font.mediumSystemFont(spec.text);
  t.textColor = C.muted;
  t.centerAlignText();
  w.addSpacer();
}

function buildWidget(items, cfg, stale, family) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  // "scale" in items.json multiplies every font size (1 = default, 1.2 = 20% bigger).
  // Fewer rows fit as it grows; the checklist always has the full list.
  const k = Math.min(1.6, Math.max(0.8, Number(cfg.scale) || 1));
  const base = {
    small: { pad: [12, 12, 12, 12], title: 16, pill: 10.5, sub: 10, subtitle: false, text: 13, rowPad: 4, gap: 2, rows: 3, wide: false, sections: false },
    medium: { pad: [13, 14, 13, 14], title: 19, pill: 11.5, sub: 11, subtitle: false, text: 15, rowPad: 5, gap: 3, rows: 3, wide: true, sections: false },
    large: { pad: [16, 16, 16, 16], title: 26, pill: 13, sub: 13, subtitle: true, text: 18, rowPad: 8, gap: 3, rows: 5, wide: true, sections: true },
  }[family];
  const spec = Object.assign({}, base, {
    title: base.title * k, pill: base.pill * k, sub: base.sub * k, text: base.text * k,
    rowPad: base.rowPad * k, section: 10.5 * k,
    rows: Math.max(2, Math.floor(base.rows / k)),
  });
  w.setPadding(...spec.pad);
  header(w, cfg, items, stale, spec);
  w.addSpacer(spec.subtitle ? 10 : 8);

  const visible = items.filter((i) => !i.done || cfg.showDone !== false);
  if (visible.length === 0) {
    emptyState(w, cfg, spec);
    return w;
  }

  // Keep at most 2 done items so finished work doesn't crowd out what's due.
  let shown = visible.filter((i) => !i.done).slice(0, spec.rows);
  const doneSlots = Math.max(0, Math.min(2, spec.rows - shown.length));
  shown = shown.concat(visible.filter((i) => i.done).slice(0, doneSlots));

  let lastGroup = null;
  shown.forEach((item, i) => {
    const g = groupOf(item);
    if (spec.sections && g !== lastGroup) {
      if (i > 0) w.addSpacer(6);
      sectionLabel(w, GROUP_LABEL[g], spec.section);
      w.addSpacer(2);
      lastGroup = g;
    } else if (i > 0) {
      w.addSpacer(spec.gap);
    }
    itemRow(w, item, spec);
  });

  const hidden = visible.length - shown.length;
  if (hidden > 0) {
    w.addSpacer(4);
    const row = w.addStack();
    row.layoutHorizontally();
    row.addSpacer(8);
    label(row, `+${hidden} more · tap to see all`, spec.text - 3, C.dim, Font.mediumSystemFont(spec.text - 3));
  }
  w.addSpacer();
  return w;
}

// ---------- plain-words due dates ----------

const WEEKDAY_NAMES = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const MONTH_NAMES = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDueString(d, time) {
  const base = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return time ? `${base} ${pad2(time.h)}:${pad2(time.m)}` : base;
}

// "tomorrow", "fri 3pm", "nov 12", "12 nov", "11/12", "2026-11-12 15:00", "in 3 days",
// "next week", "3pm" (today), "" (no date). Returns { due } or { error }.
function parseLoose(input) {
  let s = String(input || "").toLowerCase().replace(/[,.]/g, " ").replace(/\b(at|on|by|due)\b/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return { due: null };

  let time = null;
  s = s.replace(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/, (m, h, mi, ap) => {
    let hh = Number(h) % 12;
    if (ap === "pm") hh += 12;
    time = { h: hh, m: Number(mi || 0) };
    return " ";
  });
  if (!time) {
    s = s.replace(/\b(\d{1,2}):(\d{2})\b/, (m, h, mi) => {
      time = { h: Number(h), m: Number(mi) };
      return " ";
    });
  }
  if (!time) {
    s = s.replace(/\b(noon|midday)\b/, () => { time = { h: 12, m: 0 }; return " "; });
    s = s.replace(/\b(midnight|eod|end of day)\b/, () => { time = { h: 23, m: 59 }; return " "; });
  }
  if (time && (time.h > 23 || time.m > 59)) return { error: "time" };
  s = s.replace(/\s+/g, " ").trim();

  const today = startOfDay(new Date());
  let date = null;
  let m;

  if (!s) {
    date = today;
  } else if (/^(today|tod|now)$/.test(s)) {
    date = today;
  } else if (/^(tomorrow|tmrw|tmr|tom)$/.test(s)) {
    date = new Date(today.getTime() + DAY);
  } else if ((m = s.match(/^(?:in )?(\d{1,3}) ?(d|day|days)$/))) {
    date = new Date(today.getTime() + Number(m[1]) * DAY);
  } else if ((m = s.match(/^(?:in )?(\d{1,2}) ?(w|wk|week|weeks)$/))) {
    date = new Date(today.getTime() + Number(m[1]) * 7 * DAY);
  } else if (/^next week$/.test(s)) {
    date = new Date(today.getTime() + 7 * DAY);
  } else if ((m = s.match(/^(next |this )?([a-z]+)$/)) && WEEKDAY_NAMES[m[2]] !== undefined) {
    let delta = (WEEKDAY_NAMES[m[2]] - today.getDay() + 7) % 7;
    if (m[1] === "next ") delta += 7;
    date = new Date(today.getTime() + delta * DAY);
  } else if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  } else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) {
    let y = m[3] ? Number(m[3]) : today.getFullYear();
    if (y < 100) y += 2000;
    date = new Date(y, Number(m[1]) - 1, Number(m[2]));
    if (!m[3] && date < today) date.setFullYear(y + 1);
  } else if ((m = s.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/)) && MONTH_NAMES[m[1]] !== undefined) {
    const y = m[3] ? Number(m[3]) : today.getFullYear();
    date = new Date(y, MONTH_NAMES[m[1]], Number(m[2]));
    if (!m[3] && date < today) date.setFullYear(y + 1);
  } else if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)(?: (\d{4}))?$/)) && MONTH_NAMES[m[2]] !== undefined) {
    const y = m[3] ? Number(m[3]) : today.getFullYear();
    date = new Date(y, MONTH_NAMES[m[2]], Number(m[1]));
    if (!m[3] && date < today) date.setFullYear(y + 1);
  }

  if (!date || isNaN(date.getTime())) return { error: "date" };
  return { due: toDueString(date, time) };
}

// ---------- phone-side mutations ----------

function addLocalTask(state, text, due) {
  const id = hash(`${text}|${due || ""}|${Date.now()}|${Math.random()}`);
  state.local.push({ id, text, due: due || null, done: false, created: Date.now() });
  writeState(state);
  return id;
}

function toggleTask(state, item) {
  if (item.source === "local") {
    const rec = state.local.find((l) => l.id === item.id);
    if (rec) rec.done = !item.done;
  } else {
    state.overrides[item.key] = !item.done;
  }
  writeState(state);
}

function clearCompleted(state, items) {
  for (const it of items) {
    if (!it.done) continue;
    if (it.source === "local") state.local = state.local.filter((l) => l.id !== it.id);
    else state.hidden[it.key] = true;
  }
  writeState(state);
}

// ---------- in-app checklist ----------

const GROUP_EMOJI = { overdue: "🔴", today: "🟠", week: "🟡", later: "🔵", nodate: "⚪️", done: "✅" };

async function addTaskDialog(prefillText, prefillWhen) {
  const a = new Alert();
  a.title = "New task";
  a.message = "When: tomorrow · fri 3pm · nov 12 · 11/12 · in 3 days · 2026-11-12 15:00 · or leave blank";
  a.addTextField("What needs doing", prefillText || "");
  a.addTextField("When (optional)", prefillWhen || "");
  a.addAction("Add");
  a.addCancelAction("Cancel");
  const choice = await a.presentAlert();
  if (choice === -1) return null;
  const text = (a.textFieldValue(0) || "").trim();
  const whenRaw = (a.textFieldValue(1) || "").trim();
  if (!text) return null;
  const parsed = parseLoose(whenRaw);
  if (parsed.error) {
    const e = new Alert();
    e.title = "Didn't catch that date";
    e.message = `"${whenRaw}" — try tomorrow, fri 3pm, nov 12, 11/12, in 3 days, or 2026-11-12.`;
    e.addAction("Try again");
    e.addCancelAction("Cancel");
    if ((await e.presentAlert()) === -1) return null;
    return addTaskDialog(text, whenRaw);
  }
  return { text, due: parsed.due };
}

async function showChecklist(cfg, state, stale) {
  const table = new UITable();
  table.showSeparators = true;

  function render() {
    table.removeAllRows();
    const items = prepare(cfg, state);
    const s = summary(items);

    const head = new UITableRow();
    head.isHeader = true;
    head.height = 74;
    const sub = s.open === 0 ? "All clear" : `${s.open} open${s.overdue ? ` · ${s.overdue} overdue` : ""}${s.today ? ` · ${s.today} due today` : ""}`;
    const hc = head.addText((cfg && cfg.title) || "Deadlines", `${sub}  ·  tap a task to check it off${stale ? "  ·  offline copy" : ""}`);
    hc.titleFont = Font.boldSystemFont(26);
    hc.subtitleFont = Font.systemFont(13);
    hc.subtitleColor = C.muted;
    table.addRow(head);

    const add = new UITableRow();
    add.height = 54;
    add.dismissOnSelect = false;
    const plus = add.addText("＋");
    plus.widthWeight = 10;
    plus.centerAligned();
    plus.titleFont = Font.boldSystemFont(22);
    plus.titleColor = C.blue;
    const ac = add.addText("Add task", "Saved on this phone, shows on the widget, gets reminders");
    ac.widthWeight = 90;
    ac.titleFont = Font.semiboldSystemFont(17);
    ac.titleColor = C.blue;
    ac.subtitleFont = Font.systemFont(12);
    ac.subtitleColor = C.dim;
    add.onSelect = async () => {
      const t = await addTaskDialog();
      if (t) {
        addLocalTask(state, t.text, t.due);
        render();
        table.reload();
      }
    };
    table.addRow(add);

    let lastGroup = null;
    for (const it of items) {
      const g = groupOf(it);
      if (g !== lastGroup) {
        const gr = new UITableRow();
        gr.height = 34;
        gr.backgroundColor = C.line;
        const gc = gr.addText(GROUP_LABEL[g].toUpperCase());
        gc.titleFont = Font.semiboldSystemFont(11);
        gc.titleColor = C.muted;
        table.addRow(gr);
        lastGroup = g;
      }
      const row = new UITableRow();
      row.height = 60;
      row.dismissOnSelect = false;
      const box = row.addText(it.done ? "✅" : GROUP_EMOJI[g]);
      box.widthWeight = 10;
      box.centerAligned();
      box.titleFont = Font.systemFont(20);
      const cell = row.addText(it.text, fmtWhen(it, true));
      cell.widthWeight = 90;
      cell.titleFont = Font.mediumSystemFont(17);
      cell.titleColor = it.done ? C.dim : C.text;
      cell.subtitleFont = Font.systemFont(13);
      cell.subtitleColor = it.done ? C.dim : urgencyColor(it);
      row.onSelect = () => {
        toggleTask(state, it);
        render();
        table.reload();
      };
      table.addRow(row);
    }

    if (items.some((i) => i.done)) {
      const clear = new UITableRow();
      clear.height = 50;
      clear.dismissOnSelect = false;
      const cc = clear.addText("Clear completed", "Removes checked tasks from this list");
      cc.titleFont = Font.mediumSystemFont(15);
      cc.titleColor = C.muted;
      cc.subtitleColor = C.dim;
      clear.onSelect = () => {
        clearCompleted(state, items);
        render();
        table.reload();
      };
      table.addRow(clear);
    }

    if (items.length === 0) {
      const r = new UITableRow();
      r.height = 80;
      const c = r.addText(cfg.error ? "Couldn't load items.json" : "Nothing to do", cfg.error ? String(cfg.error) : "Add items to items.json and push.");
      c.titleColor = C.muted;
      c.centerAligned();
      table.addRow(r);
    }

    const foot = new UITableRow();
    foot.height = 56;
    const fc = foot.addText("Edit the shared list on GitHub", `${SRC.repo} · ${SRC.dir}/items.json`);
    fc.titleFont = Font.mediumSystemFont(15);
    fc.titleColor = C.blue;
    fc.subtitleColor = C.dim;
    foot.onSelect = () => Safari.open(cfg.tapUrl || `https://github.com/${SRC.repo}/edit/${SRC.branch}/${SRC.dir}/items.json`);
    table.addRow(foot);
  }

  render();
  await table.present(false);
  // Re-schedule reminders for whatever the list looks like after edits.
  try { await scheduleNotifications(prepare(cfg, state), cfg); } catch (e) {}
}

// ---------- main ----------

const { cfg, stale } = await fetchItems();
const state = readState();
const items = prepare(cfg, state);

if (config.runsInWidget) {
  const fam = config.widgetFamily || "medium";
  const family = fam === "small" ? "small" : fam === "large" || fam === "extraLarge" ? "large" : "medium";
  const widget = buildWidget(items, cfg, stale, family);
  try { widget.url = URLScheme.forRunningScript(); } catch (e) {}
  widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);
  Script.setWidget(widget);
  try { await scheduleNotifications(items, cfg); } catch (e) {}
} else {
  // Running inside Scriptable: schedule reminders (this is where iOS asks for
  // permission the first time), then show the checklist. The checklist
  // re-schedules again when dismissed.
  try { await scheduleNotifications(items, cfg); } catch (e) {}
  await showChecklist(cfg, state, stale);
}
Script.complete();
