// BITCOIN_STUDIO_BOARD — Scriptable widget
// Live BTC price with 24h sparkline, funding, Fear & Greed gauge, chain stats,
// plus a guest line and posting tally driven by board.json in this folder.
// Loaded on each refresh by loader.js, so pushing to GitHub updates the widget.
//
// Widget parameter (long-press widget > Edit Widget > Parameter), optional:
//   "compact"   force the small layout
//   any URL     use that JSON instead of board.json from the repo

const SRC = (typeof BSB !== "undefined" && BSB) || {
  repo: "Russ258/moon-kol-crm",
  branch: "claude/phone-widget-idea-h8ttos",
  dir: "widgets/bitcoin-studio-board",
};

const RAW = `https://raw.githubusercontent.com/${SRC.repo}/${SRC.branch}/${SRC.dir}`;
const CONFIG_URL = `${RAW}/board.json`;
const REFRESH_MINUTES = 10;
const TIMEOUT_SECONDS = 8;
const SPARK_POINTS = 48;

const C = {
  bg0: new Color("#0A0D14"),
  bg1: new Color("#141A2A"),
  bg2: new Color("#1B1626"),
  card: new Color("#FFFFFF", 0.07),
  cardLine: new Color("#FFFFFF", 0.10),
  text: new Color("#F5F6F8"),
  muted: new Color("#8A93A8"),
  dim: new Color("#5C6478"),
  orange: new Color("#F7931A"),
  orangeDeep: new Color("#C96F00"),
  green: new Color("#22C55E"),
  red: new Color("#EF4444"),
  yellow: new Color("#EAB308"),
  amber: new Color("#F59E0B"),
};

const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), "bitcoin-studio-board.data.json");

// ---------- data ----------

async function getJSON(url, headers) {
  const r = new Request(url);
  r.timeoutInterval = TIMEOUT_SECONDS;
  if (headers) r.headers = headers;
  return await r.loadJSON();
}

async function getText(url) {
  const r = new Request(url);
  r.timeoutInterval = TIMEOUT_SECONDS;
  return await r.loadString();
}

// Try each source in order; first one that returns a usable value wins.
async function firstOf(sources) {
  for (const fn of sources) {
    try {
      const v = await fn();
      if (v !== undefined && v !== null && !(typeof v === "number" && isNaN(v))) return v;
    } catch (e) {
      // fall through to the next source
    }
  }
  return null;
}

async function fetchPrice() {
  return firstOf([
    async () => {
      const j = await getJSON(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true"
      );
      const b = j.bitcoin;
      return { usd: Number(b.usd), change24h: Number(b.usd_24h_change), src: "CoinGecko" };
    },
    async () => {
      const j = await getJSON("https://api.exchange.coinbase.com/products/BTC-USD/stats");
      const last = Number(j.last), open = Number(j.open);
      return { usd: last, change24h: ((last - open) / open) * 100, src: "Coinbase" };
    },
    async () => {
      const j = await getJSON("https://api.kraken.com/0/public/Ticker?pair=XBTUSD");
      const t = j.result[Object.keys(j.result)[0]];
      const last = Number(t.c[0]), open = Number(t.o);
      return { usd: last, change24h: ((last - open) / open) * 100, src: "Kraken" };
    },
  ]);
}

// Returns an array of ~SPARK_POINTS closing prices over the last 24h, oldest first.
async function fetchSpark() {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const series = await firstOf([
    async () => {
      const j = await getJSON("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1");
      return j.prices.map((p) => Number(p[1]));
    },
    async () => {
      const j = await getJSON("https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=3600");
      // [time, low, high, open, close, volume], newest first
      return j
        .filter((c) => c[0] * 1000 >= cutoff)
        .sort((a, b) => a[0] - b[0])
        .map((c) => Number(c[4]));
    },
    async () => {
      const j = await getJSON("https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=60");
      const key = Object.keys(j.result).find((k) => k !== "last");
      return j.result[key]
        .filter((c) => c[0] * 1000 >= cutoff)
        .map((c) => Number(c[4]));
    },
  ]);
  if (!series || series.length < 2) return null;
  return downsample(series.filter((n) => !isNaN(n)), SPARK_POINTS);
}

function downsample(arr, n) {
  if (arr.length <= n) return arr;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(arr[Math.round((i / (n - 1)) * (arr.length - 1))]);
  }
  return out;
}

async function fetchFunding() {
  return firstOf([
    async () => {
      const j = await getJSON("https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT");
      const t = j.result.list[0];
      return { rate: Number(t.fundingRate) * 100, nextAt: Number(t.nextFundingTime), src: "Bybit" };
    },
    async () => {
      const j = await getJSON("https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP");
      const t = j.data[0];
      return { rate: Number(t.fundingRate) * 100, nextAt: Number(t.nextFundingTime), src: "OKX" };
    },
    async () => {
      const j = await getJSON("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT");
      return { rate: Number(j.lastFundingRate) * 100, nextAt: Number(j.nextFundingTime), src: "Binance" };
    },
  ]);
}

async function fetchFearGreed() {
  return firstOf([
    async () => {
      const j = await getJSON("https://api.alternative.me/fng/?limit=1");
      const d = j.data[0];
      return { value: Number(d.value), label: d.value_classification };
    },
  ]);
}

async function fetchChain() {
  const height = await firstOf([
    async () => Number(await getText("https://mempool.space/api/blocks/tip/height")),
    async () => Number(await getText("https://blockstream.info/api/blocks/tip/height")),
  ]);
  const fees = await firstOf([
    async () => {
      const j = await getJSON("https://mempool.space/api/v1/fees/recommended");
      return { fast: Number(j.fastestFee), medium: Number(j.halfHourFee), slow: Number(j.hourFee) };
    },
  ]);
  if (height === null && fees === null) return null;
  return { height, fees };
}

async function fetchConfig() {
  const param = (args.widgetParameter || "").trim();
  const url = /^https?:\/\//.test(param) ? param : CONFIG_URL;
  return firstOf([async () => await getJSON(`${url}?t=${Date.now()}`)]);
}

function readCache() {
  try {
    if (fm.fileExists(CACHE)) return JSON.parse(fm.readString(CACHE));
  } catch (e) {}
  return {};
}

function writeCache(data) {
  try {
    fm.writeString(CACHE, JSON.stringify(data));
  } catch (e) {}
}

async function loadAll() {
  const [price, spark, funding, fng, chain, cfg] = await Promise.all([
    fetchPrice(),
    fetchSpark(),
    fetchFunding(),
    fetchFearGreed(),
    fetchChain(),
    fetchConfig(),
  ]);
  const cached = readCache();
  const fresh = { price, spark, funding, fng, chain, cfg };
  const stale = {};
  const data = {};
  for (const k of Object.keys(fresh)) {
    if (fresh[k] !== null) {
      data[k] = fresh[k];
    } else if (cached[k] !== undefined && cached[k] !== null) {
      data[k] = cached[k];
      stale[k] = true;
    } else {
      data[k] = null;
    }
  }
  data.fetchedAt = Date.now();
  writeCache(data);
  return { data, stale };
}

// ---------- formatting ----------

function fmtUSD(n) {
  if (n === null || n === undefined) return "—";
  const rounded = Math.round(n);
  return "$" + String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtPct(n, digits) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + n.toFixed(digits) + "%";
}

function fmtInt(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtTime(ts) {
  const d = new Date(ts);
  const df = new DateFormatter();
  df.useShortTimeStyle();
  return df.string(d);
}

function fmtCountdown(ms) {
  if (!ms || ms <= 0) return "";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

// Fake letter-spacing with hair spaces; Scriptable has no tracking API.
function tracked(s) {
  return s.split("").join(" ");
}

function changeColor(n) {
  if (n === null || n === undefined || isNaN(n)) return C.muted;
  return n >= 0 ? C.green : C.red;
}

function fngColor(v) {
  if (v === null || v === undefined) return C.muted;
  if (v < 25) return C.red;
  if (v < 45) return C.orange;
  if (v < 55) return C.yellow;
  return C.green;
}

function fundingColor(rate) {
  if (rate === null || rate === undefined || isNaN(rate)) return C.muted;
  // 0.01% per 8h is the neutral baseline on most perps
  if (rate > 0.03) return C.red;
  if (rate < 0) return C.green;
  return C.text;
}

// ---------- drawing ----------

function sparklineImage(points, w, h, color) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 3;
  const xs = (i) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const ys = (v) => h - pad - ((v - min) / range) * (h - pad * 2);

  const fill = new Path();
  fill.move(new Point(xs(0), h));
  points.forEach((v, i) => fill.addLine(new Point(xs(i), ys(v))));
  fill.addLine(new Point(xs(points.length - 1), h));
  fill.closeSubpath();
  ctx.setFillColor(new Color(color.hex, 0.16));
  ctx.addPath(fill);
  ctx.fillPath();

  const line = new Path();
  points.forEach((v, i) => (i === 0 ? line.move(new Point(xs(i), ys(v))) : line.addLine(new Point(xs(i), ys(v)))));
  ctx.setStrokeColor(color);
  ctx.setLineWidth(1.8);
  ctx.addPath(line);
  ctx.strokePath();

  const lx = xs(points.length - 1);
  const ly = ys(points[points.length - 1]);
  ctx.setFillColor(new Color(color.hex, 0.35));
  ctx.fillEllipse(new Rect(lx - 4.5, ly - 4.5, 9, 9));
  ctx.setFillColor(color);
  ctx.fillEllipse(new Rect(lx - 2.5, ly - 2.5, 5, 5));

  return ctx.getImage();
}

function gaugeImage(value, w, h, color) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const track = new Path();
  track.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2);
  ctx.setFillColor(new Color("#FFFFFF", 0.10));
  ctx.addPath(track);
  ctx.fillPath();

  const v = Math.max(0, Math.min(100, value || 0));
  const fw = Math.max(h, (v / 100) * w);
  const fillPath = new Path();
  fillPath.addRoundedRect(new Rect(0, 0, fw, h), h / 2, h / 2);
  ctx.setFillColor(color);
  ctx.addPath(fillPath);
  ctx.fillPath();

  return ctx.getImage();
}

function symbolImage(stack, name, size, color, fallbackText) {
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
  return label(stack, fallbackText, size, color);
}

// ---------- UI ----------

function label(stack, text, size, color, font) {
  const t = stack.addText(text);
  t.font = font || Font.systemFont(size);
  t.textColor = color || C.text;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

function dot(stack, color, size) {
  const d = stack.addStack();
  d.size = new Size(size, size);
  d.cornerRadius = size / 2;
  d.backgroundColor = color;
  return d;
}

function badge(stack, size) {
  const b = stack.addStack();
  b.size = new Size(size, size);
  b.cornerRadius = size / 2;
  b.backgroundColor = C.orange;
  b.layoutHorizontally();
  b.centerAlignContent();
  b.addSpacer();
  label(b, "₿", size * 0.68, C.bg0, Font.heavySystemFont(size * 0.68));
  b.addSpacer();
  return b;
}

function statCell(parent, title, value, color, sub, accent) {
  const cell = parent.addStack();
  cell.layoutVertically();
  cell.backgroundColor = C.card;
  cell.cornerRadius = 9;
  cell.borderWidth = 1;
  cell.borderColor = C.cardLine;
  cell.setPadding(6, 8, 6, 8);

  label(cell, tracked(title.toUpperCase()), 7.5, C.muted, Font.semiboldSystemFont(7.5));
  cell.addSpacer(2);
  const row = cell.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  if (accent) {
    dot(row, accent, 5);
    row.addSpacer(4);
  }
  label(row, value, 13, color || C.text, Font.boldMonospacedSystemFont(13));
  if (sub) {
    cell.addSpacer(1);
    label(cell, sub, 8, C.dim);
  }
  return cell;
}

function header(w, cfg, data, stale, badgeSize) {
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  badge(row, badgeSize);
  row.addSpacer(6);
  const title = (cfg && cfg.title) || "BITCOIN STUDIO BOARD";
  label(row, tracked(title.toUpperCase()), 9.5, C.text, Font.heavySystemFont(9.5));
  row.addSpacer();
  const anyStale = Object.keys(stale).length > 0;
  dot(row, anyStale ? C.amber : C.green, 6);
  row.addSpacer(4);
  label(row, anyStale ? "cached" : fmtTime(data.fetchedAt), 9, C.muted, Font.mediumSystemFont(9));
}

function priceBlock(stack, data, big) {
  const p = data.price;
  const price = label(stack, fmtUSD(p && p.usd), big, C.text, Font.heavySystemFont(big));
  price.minimumScaleFactor = 0.5;

  const row = stack.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = 5;
  const ch = p ? p.change24h : null;
  const col = changeColor(ch);
  const pill = row.addStack();
  pill.layoutHorizontally();
  pill.centerAlignContent();
  pill.backgroundColor = new Color(col.hex, 0.16);
  pill.cornerRadius = 7;
  pill.setPadding(2, 6, 2, 7);
  if (ch !== null && !isNaN(ch)) {
    symbolImage(pill, ch >= 0 ? "arrow.up.right" : "arrow.down.right", 8, col, ch >= 0 ? "▲" : "▼");
    pill.addSpacer(3);
  }
  label(pill, fmtPct(ch, 2), 11, col, Font.boldSystemFont(11));
  label(row, "24h", 9.5, C.muted, Font.mediumSystemFont(9.5));
}

function sparkBlock(stack, data, w, h) {
  if (!data.spark || data.spark.length < 2) return;
  const ch = data.price ? data.price.change24h : null;
  const img = stack.addImage(sparklineImage(data.spark, w, h, changeColor(ch)));
  img.imageSize = new Size(w, h);
  img.resizable = false;
}

function postsDots(stack, posts) {
  if (!posts || typeof posts.goal !== "number") return;
  const goal = Math.min(10, Math.max(0, Math.round(posts.goal)));
  const done = Math.min(goal, Math.max(0, Math.round(posts.done || 0)));
  const row = stack.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = 3;
  for (let i = 0; i < goal; i++) {
    dot(row, i < done ? C.orange : new Color("#FFFFFF", 0.14), 5.5);
  }
  row.addSpacer(5);
  label(row, `${done}/${goal}`, 9.5, done >= goal && goal > 0 ? C.green : C.muted, Font.semiboldSystemFont(9.5));
}

function footer(w, cfg) {
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const g = cfg && cfg.guest;
  symbolImage(row, "mic.fill", 9, C.orange, "🎙");
  row.addSpacer(5);
  if (g && g.name) {
    label(row, g.name, 10.5, C.text, Font.semiboldSystemFont(10.5));
    if (g.when) {
      row.addSpacer(5);
      label(row, g.when, 10, C.muted, Font.mediumSystemFont(10));
    }
  } else {
    label(row, "No guest scheduled", 10, C.muted);
  }
  row.addSpacer();
  postsDots(row, cfg && cfg.posts);
}

function divider(w) {
  const d = w.addStack();
  d.size = new Size(0, 1);
  d.backgroundColor = C.cardLine;
}

function miniStat(parent, title, value, color, accent) {
  const cell = parent.addStack();
  cell.layoutVertically();
  label(cell, tracked(title.toUpperCase()), 7, C.muted, Font.semiboldSystemFont(7));
  cell.addSpacer(1);
  const row = cell.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  if (accent) {
    dot(row, accent, 5);
    row.addSpacer(3);
  }
  label(row, value, 11, color || C.text, Font.boldMonospacedSystemFont(11));
  return cell;
}

// Square (2x2) layout. ~158pt wide on current iPhones, 134pt inside the padding.
function buildSmall(data, stale, cfg) {
  const w = new ListWidget();
  w.setPadding(11, 12, 11, 12);

  const head = w.addStack();
  head.layoutHorizontally();
  head.centerAlignContent();
  badge(head, 14);
  head.addSpacer(5);
  const title = (cfg && cfg.shortTitle) || "STUDIO BOARD";
  label(head, tracked(title.toUpperCase()), 8, C.text, Font.heavySystemFont(8));
  head.addSpacer();
  dot(head, Object.keys(stale).length > 0 ? C.amber : C.green, 6);

  w.addSpacer(5);
  priceBlock(w, data, 22);
  w.addSpacer(4);
  sparkBlock(w, data, 134, 26);
  w.addSpacer();

  const f = data.fng, fu = data.funding;
  const stats = w.addStack();
  stats.layoutHorizontally();
  stats.centerAlignContent();
  miniStat(stats, "Fear & Greed", f ? String(f.value) : "—", C.text, fngColor(f && f.value));
  stats.addSpacer();
  miniStat(stats, "Funding", fu ? fmtPct(fu.rate, 3) : "—", fundingColor(fu && fu.rate));

  const g = cfg && cfg.guest;
  if (g && g.name) {
    w.addSpacer(4);
    const row = w.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    symbolImage(row, "mic.fill", 8, C.orange, "🎙");
    row.addSpacer(4);
    label(row, g.name, 9, C.muted, Font.semiboldSystemFont(9));
    if (g.when) {
      row.addSpacer(4);
      label(row, g.when, 8.5, C.dim);
    }
  }
  return w;
}

function buildMedium(data, stale, cfg) {
  const w = new ListWidget();
  w.setPadding(12, 14, 11, 14);
  header(w, cfg, data, stale, 16);
  w.addSpacer(7);

  const body = w.addStack();
  body.layoutHorizontally();
  body.centerAlignContent();

  const left = body.addStack();
  left.layoutVertically();
  left.size = new Size(150, 0);
  priceBlock(left, data, 28);
  left.addSpacer(5);
  sparkBlock(left, data, 142, 28);

  body.addSpacer();

  const grid = body.addStack();
  grid.layoutVertically();
  grid.spacing = 5;

  const fu = data.funding, f = data.fng, ch = data.chain;
  const r1 = grid.addStack();
  r1.layoutHorizontally();
  r1.spacing = 5;
  statCell(r1, "Funding 8h", fu ? fmtPct(fu.rate, 4) : "—", fundingColor(fu && fu.rate));
  statCell(r1, "Fear & Greed", f ? String(f.value) : "—", C.text, null, fngColor(f && f.value));

  const r2 = grid.addStack();
  r2.layoutHorizontally();
  r2.spacing = 5;
  statCell(r2, "Block", ch && ch.height ? fmtInt(ch.height) : "—");
  statCell(r2, "Fast fee", ch && ch.fees ? `${fmtInt(ch.fees.fast)} s/vB` : "—");

  w.addSpacer(8);
  divider(w);
  w.addSpacer(7);
  footer(w, cfg);
  return w;
}

function buildLarge(data, stale, cfg) {
  const w = new ListWidget();
  w.setPadding(14, 16, 14, 16);
  header(w, cfg, data, stale, 18);
  w.addSpacer(12);
  priceBlock(w, data, 38);
  w.addSpacer(8);
  sparkBlock(w, data, 297, 56);
  w.addSpacer(12);

  const f = data.fng;
  const fgRow = w.addStack();
  fgRow.layoutHorizontally();
  fgRow.centerAlignContent();
  label(fgRow, tracked("FEAR & GREED"), 8, C.muted, Font.semiboldSystemFont(8));
  fgRow.addSpacer();
  label(fgRow, f ? `${f.value}` : "—", 12, fngColor(f && f.value), Font.boldMonospacedSystemFont(12));
  fgRow.addSpacer(5);
  label(fgRow, f ? f.label : "", 10, C.muted, Font.mediumSystemFont(10));
  w.addSpacer(5);
  const gauge = w.addImage(gaugeImage(f ? f.value : 0, 297, 6, fngColor(f && f.value)));
  gauge.imageSize = new Size(297, 6);
  gauge.resizable = false;
  w.addSpacer(12);

  const fu = data.funding, ch = data.chain;
  const r1 = w.addStack();
  r1.layoutHorizontally();
  r1.spacing = 6;
  const next = fu && fu.nextAt ? "next in " + fmtCountdown(fu.nextAt - Date.now()) : "";
  statCell(r1, "Funding 8h", fu ? fmtPct(fu.rate, 4) : "—", fundingColor(fu && fu.rate), (fu && fu.src ? fu.src + " · " : "") + next);
  statCell(r1, "Block height", ch && ch.height ? fmtInt(ch.height) : "—", C.text, "mempool.space");
  const fees = ch && ch.fees;
  statCell(r1, "Fees s/vB", fees ? `${fmtInt(fees.fast)} / ${fmtInt(fees.medium)} / ${fmtInt(fees.slow)}` : "—", C.text, "fast / 30m / 1h");

  w.addSpacer();
  const g = cfg && cfg.guest;
  if (g && g.topic) {
    label(w, g.topic, 11, C.muted);
    w.addSpacer(4);
  }
  if (cfg && cfg.note) {
    label(w, cfg.note, 11, C.text);
    w.addSpacer(4);
  }
  divider(w);
  w.addSpacer(8);
  footer(w, cfg);
  return w;
}

function decorate(w, cfg) {
  const grad = new LinearGradient();
  grad.colors = [C.bg0, C.bg1, C.bg2];
  grad.locations = [0, 0.55, 1];
  grad.startPoint = new Point(0, 0);
  grad.endPoint = new Point(1, 1);
  w.backgroundGradient = grad;
  w.url = (cfg && cfg.tapUrl) || "https://mempool.space";
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);
}

// ---------- main ----------

const { data, stale } = await loadAll();
const cfg = data.cfg || {};
const param = (args.widgetParameter || "").trim().toLowerCase();
const family = param === "compact" ? "small" : config.widgetFamily || "medium";

let widget;
if (family === "small") widget = buildSmall(data, stale, cfg);
else if (family === "large" || family === "extraLarge") widget = buildLarge(data, stale, cfg);
else widget = buildMedium(data, stale, cfg);
decorate(widget, cfg);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else if (family === "small") {
  await widget.presentSmall();
} else if (family === "large" || family === "extraLarge") {
  await widget.presentLarge();
} else {
  await widget.presentMedium();
}
Script.complete();
