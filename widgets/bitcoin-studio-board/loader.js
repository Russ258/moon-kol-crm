// Bitcoin Studio Board — loader
// This is the only thing you paste into Scriptable. On every refresh it looks up
// the branch's latest commit, then pulls board.js at that exact commit, so a
// push to GitHub shows up on the next refresh. raw.githubusercontent.com caches
// branch URLs for 5 minutes, which is why the commit lookup is there.
// Falls back to the last downloaded copy if GitHub is unreachable.

const BSB = {
  repo: "Russ258/moon-kol-crm",
  branch: "claude/phone-widget-idea-h8ttos",
  dir: "widgets/bitcoin-studio-board",
  sha: null,
};

const fm = FileManager.local();
const cache = fm.joinPath(fm.documentsDirectory(), "bitcoin-studio-board.code.js");

async function latestSha() {
  const r = new Request(`https://api.github.com/repos/${BSB.repo}/commits/${encodeURIComponent(BSB.branch)}`);
  r.timeoutInterval = 8;
  r.headers = { Accept: "application/vnd.github.sha", "User-Agent": "bitcoin-studio-board" };
  const sha = (await r.loadString()).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Unexpected commit lookup response");
  return sha;
}

let code;
try {
  try {
    BSB.sha = await latestSha();
  } catch (e) {
    BSB.sha = null; // fall back to the branch URL, which may lag by up to 5 minutes
  }
  const ref = BSB.sha || BSB.branch;
  const r = new Request(`https://raw.githubusercontent.com/${BSB.repo}/${ref}/${BSB.dir}/board.js`);
  r.timeoutInterval = 10;
  code = await r.loadString();
  if (!code.includes("BITCOIN_STUDIO_BOARD")) throw new Error("Unexpected response from GitHub");
  fm.writeString(cache, code);
} catch (e) {
  if (!fm.fileExists(cache)) throw e;
  code = fm.readString(cache);
}

await new Function("BSB", `return (async () => {\n${code}\n})();`)(BSB);
