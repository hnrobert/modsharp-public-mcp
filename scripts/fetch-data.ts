import { mkdir, writeFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const FETCHED_DIR = resolve(PROJECT_ROOT, "data/fetched");

const OWNER = "Kxnrl";
const REPO = "modsharp-public";
const BRANCH = "master";
const API = "https://api.github.com";
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;

interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

const TREE_PREFIXES = ["Sharp.Shared/", "docfx/docs/", "docfx/toc.yml"];
const DOWNLOAD_EXTENSIONS = new Set([".cs", ".md", ".yml", ".yaml", ".xml"]);

function shouldDownload(path: string): boolean {
  if (path === "docfx/toc.yml") return true;
  const dot = path.lastIndexOf(".");
  if (dot === -1) return false;
  return DOWNLOAD_EXTENSIONS.has(path.slice(dot));
}

function remapPath(gitPath: string): string {
  if (gitPath.startsWith("docfx/docs/")) return gitPath.replace("docfx/docs/", "docs/");
  if (gitPath === "docfx/toc.yml") return "toc.yml";
  return gitPath; // Sharp.Shared/ stays as-is
}

async function getTree(): Promise<TreeEntry[]> {
  console.log("Fetching git tree...");
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`, {
    headers: { "User-Agent": "modsharp-mcp-fetch" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { tree: TreeEntry[]; truncated: boolean };
  if (data.truncated) console.warn("Warning: tree was truncated");
  return data.tree.filter(
    (e) => e.type === "blob" && TREE_PREFIXES.some((p) => e.path.startsWith(p))
  );
}

async function downloadFile(entry: TreeEntry): Promise<boolean> {
  const targetPath = resolve(FETCHED_DIR, remapPath(entry.path));

  // Skip if file exists and size matches (cache)
  if (entry.size != null) {
    try {
      const st = await stat(targetPath);
      if (st.size === entry.size) return false;
    } catch { /* not cached yet */ }
  }

  await mkdir(dirname(targetPath), { recursive: true });

  const res = await fetch(`${RAW}/${entry.path}`, {
    headers: { "User-Agent": "modsharp-mcp-fetch" },
  });
  if (!res.ok) {
    console.warn(`  Skip ${entry.path}: HTTP ${res.status}`);
    return false;
  }

  await writeFile(targetPath, await res.text(), "utf-8");
  return true;
}

async function main(): Promise<void> {
  console.log(`Fetching from github.com/${OWNER}/${REPO} (${BRANCH})\n`);
  await mkdir(FETCHED_DIR, { recursive: true });

  const tree = await getTree();
  const toDownload = tree.filter((e) => shouldDownload(e.path));
  console.log(`Found ${tree.length} files, downloading ${toDownload.length} source files...\n`);

  const BATCH = 20;
  let downloaded = 0;

  for (let i = 0; i < toDownload.length; i += BATCH) {
    const batch = toDownload.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((e) => downloadFile(e)));
    downloaded += results.filter(Boolean).length;
    const done = Math.min(i + BATCH, toDownload.length);
    process.stdout.write(`  ${done}/${toDownload.length} files processed\r`);
  }

  const cached = toDownload.length - downloaded;
  console.log(`\n\nDone! ${downloaded} downloaded, ${cached} cached.`);
}

main().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
