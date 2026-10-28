// Bitcoin Studio Board — loader
// This is the only thing you paste into Scriptable. On every refresh it pulls
// the latest board.js from GitHub, so pushing to the repo updates the widget.
// Falls back to the last downloaded copy if GitHub is unreachable.

const BSB = {
  repo: "Russ258/moon-kol-crm",
  branch: "claude/phone-widget-idea-h8ttos",
  dir: "widgets/bitcoin-studio-board",
};

const url = `https://raw.githubusercontent.com/${BSB.repo}/${BSB.branch}/${BSB.dir}/board.js?t=${Date.now()}`;
const fm = FileManager.local();
const cache = fm.joinPath(fm.documentsDirectory(), "bitcoin-studio-board.code.js");

let code;
try {
  const r = new Request(url);
  r.timeoutInterval = 10;
  code = await r.loadString();
  if (!code.includes("BITCOIN_STUDIO_BOARD")) throw new Error("Unexpected response from GitHub");
  fm.writeString(cache, code);
} catch (e) {
  if (!fm.fileExists(cache)) throw e;
  code = fm.readString(cache);
}

await new Function("BSB", `return (async () => {\n${code}\n})();`)(BSB);
