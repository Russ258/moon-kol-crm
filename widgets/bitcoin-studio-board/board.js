// BITCOIN_STUDIO_BOARD — Scriptable widget
// Live BTC price, funding, Fear & Greed, chain stats, plus a guest/posting line
// driven by board.json in this same folder. Loaded on each refresh by loader.js,
// so pushing to GitHub updates the widget on the home screen.
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

const C = {
  bg0: new Color("#0B0F17"),
  bg1: new Color("#141B2B"),
  card: new Color("#FFFFFF", 0.06),
  text: new Color("#F3F4F6"),
  muted: new Color("#8B93A7"),
  orange: new Color("#F7931A"),
  green: new Color("#22C55E"),
  red: new Color("#EF4444"),
  yellow: new Color("#EAB308"),
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
  const [price, funding, fng, chain, cfg] = await Promise.all([
    fetchPrice(),
    fetchFunding(),
    fetchFearGreed(),
    fetchChain(),
    fetchConfig(),
  ]);
  const cached = readCache();
  const fresh = { price, funding, fng, chain, cfg };
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

// ---------- UI ----------

function label(stack, text, size, color, font) {
  const t = stack.addText(text);
  t.font = font || Font.systemFont(size);
  t.textColor = color || C.text;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

function statCell(parent, title, value, color, sub) {
  const cell = parent.addStack();
  cell.layoutVertically();
  cell.backgroundColor = C.card;
  cell.cornerRadius = 8;
  cell.setPadding(5, 7, 5, 7);
  label(cell, title.toUpperCase(), 8, C.muted, Font.semiboldSystemFont(8));
  cell.addSpacer(1);
  label(cell, value, 13, color || C.text, Font.boldMonospacedSystemFont(13));
  if (sub) {
    label(cell, sub, 8, C.muted);
  }
  return cell;
}

function header(w, cfg, data, stale) {
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const title = (cfg && cfg.title) || "BITCOIN STUDIO BOARD";
  label(row, title, 10, C.orange, Font.heavySystemFont(10));
  row.addSpacer();
  const anyStale = Object.keys(stale).length > 0;
  const stamp = (anyStale ? "cached · " : "") + fmtTime(data.fetchedAt);
  label(row, stamp, 9, C.muted);
}

function priceBlock(stack, data, big) {
  const p = data.price;
  label(stack, fmtUSD(p && p.usd), big, C.text, Font.boldSystemFont(big));
  const row = stack.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = 4;
  const ch = p ? p.change24h : null;
  const pill = row.addStack();
  pill.backgroundColor = new Color(changeColor(ch).hex, 0.18);
  pill.cornerRadius = 6;
  pill.setPadding(2, 6, 2, 6);
  label(pill, fmtPct(ch, 2), 11, changeColor(ch), Font.semiboldSystemFont(11));
  label(row, "24h", 10, C.muted);
}

function footer(w, cfg) {
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const g = cfg && cfg.guest;
  if (g && g.name) {
    const when = g.when ? ` · ${g.when}` : "";
    label(row, `🎙 ${g.name}${when}`, 10, C.text, Font.mediumSystemFont(10));
  } else {
    label(row, "No guest scheduled", 10, C.muted);
  }
  row.addSpacer();
  const posts = cfg && cfg.posts;
  if (posts && typeof posts.goal === "number") {
    const done = Number(posts.done || 0);
    const col = done >= posts.goal ? C.green : C.text;
    label(row, `Posts ${done}/${posts.goal}`, 10, col, Font.semiboldSystemFont(10));
  }
}

function buildSmall(data, stale, cfg) {
  const w = new ListWidget();
  w.setPadding(12, 12, 12, 12);
  header(w, cfg, data, stale);
  w.addSpacer();
  priceBlock(w, data, 26);
  w.addSpacer();
  const f = data.fng;
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  label(row, "F&G", 9, C.muted, Font.semiboldSystemFont(9));
  row.addSpacer(4);
  label(row, f ? `${f.value} ${f.label}` : "—", 11, fngColor(f && f.value), Font.boldSystemFont(11));
  return w;
}

function buildMedium(data, stale, cfg) {
  const w = new ListWidget();
  w.setPadding(12, 14, 10, 14);
  header(w, cfg, data, stale);
  w.addSpacer(6);

  const body = w.addStack();
  body.layoutHorizontally();
  body.centerAlignContent();

  const left = body.addStack();
  left.layoutVertically();
  priceBlock(left, data, 30);
  body.addSpacer();

  const grid = body.addStack();
  grid.layoutVertically();
  grid.spacing = 4;

  const fu = data.funding, f = data.fng, ch = data.chain;
  const r1 = grid.addStack();
  r1.layoutHorizontally();
  r1.spacing = 4;
  statCell(r1, "Funding 8h", fu ? fmtPct(fu.rate, 4) : "—", fundingColor(fu && fu.rate));
  statCell(r1, "Fear & Greed", f ? String(f.value) : "—", fngColor(f && f.value));

  const r2 = grid.addStack();
  r2.layoutHorizontally();
  r2.spacing = 4;
  statCell(r2, "Block", ch && ch.height ? fmtInt(ch.height) : "—");
  statCell(r2, "Fast fee", ch && ch.fees ? `${fmtInt(ch.fees.fast)} s/vB` : "—");

  w.addSpacer(6);
  footer(w, cfg);
  return w;
}

function buildLarge(data, stale, cfg) {
  const w = new ListWidget();
  w.setPadding(14, 16, 14, 16);
  header(w, cfg, data, stale);
  w.addSpacer(10);
  priceBlock(w, data, 40);
  w.addSpacer(12);

  const fu = data.funding, f = data.fng, ch = data.chain;
  const r1 = w.addStack();
  r1.layoutHorizontally();
  r1.spacing = 6;
  const next = fu && fu.nextAt ? "next in " + fmtCountdown(fu.nextAt - Date.now()) : "";
  statCell(r1, "Funding 8h", fu ? fmtPct(fu.rate, 4) : "—", fundingColor(fu && fu.rate), (fu && fu.src ? fu.src + " · " : "") + next);
  statCell(r1, "Fear & Greed", f ? String(f.value) : "—", fngColor(f && f.value), f ? f.label : "");

  w.addSpacer(6);
  const r2 = w.addStack();
  r2.layoutHorizontally();
  r2.spacing = 6;
  statCell(r2, "Block height", ch && ch.height ? fmtInt(ch.height) : "—", C.text, "mempool.space");
  const fees = ch && ch.fees;
  statCell(r2, "Fees s/vB", fees ? `${fmtInt(fees.fast)} / ${fmtInt(fees.medium)} / ${fmtInt(fees.slow)}` : "—", C.text, "fast / 30m / 1h");

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
  footer(w, cfg);
  return w;
}

function decorate(w, cfg) {
  const grad = new LinearGradient();
  grad.colors = [C.bg0, C.bg1];
  grad.locations = [0, 1];
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
