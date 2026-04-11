import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const FETCHED_DIR = resolve(PROJECT_ROOT, 'data/fetched');

interface TreeEntry {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

// ── Config per source repo ──────────────────────────────────────────

interface SourceRepo {
  owner: string;
  repo: string;
  branch: string;
  prefixes: string[]; // git path prefixes to include
  extensions: Set<string>; // file extensions to download
  remap: (gitPath: string) => string; // git path -> local path under fetched/
  extraFiles?: string[]; // exact paths to always include
}

const MODSHARP: SourceRepo = {
  owner: 'Kxnrl',
  repo: 'modsharp-public',
  branch: 'master',
  prefixes: ['Sharp.Shared/', 'Sharp.Core/', 'docfx/docs/'],
  extensions: new Set(['.cs', '.md', '.yml', '.yaml', '.xml']),
  extraFiles: ['docfx/toc.yml'],
  remap(gitPath: string): string {
    if (gitPath.startsWith('docfx/docs/'))
      return gitPath.replace('docfx/docs/', 'docs/');
    if (gitPath === 'docfx/toc.yml') return 'toc.yml';
    return gitPath;
  },
};

// All CS2/Source2 engine schema directories
const SCHEMA_CATEGORIES = [
  'resourcesystem',
  'server',
  'soundsystem',
  'soundsystem_lowlevel',
  'soundsystem_voicecontainers',
  'vphysics2',
  'worldrenderer',
];

// const SCHEMA_CATEGORIES = [
//   "animationsystem", "animdoclib", "animgraphdoclib", "animgraphlib",
//   "animlib", "client", "compositematerialslib", "entity2",
//   "hammer", "host", "mapdoclib", "materialsystem2",
//   "mathlib_extended", "met", "modeldoc_editor", "modellib",
//   "modtools", "navlib", "networksystem", "panorama_content",
//   "particles", "particleslib", "physicslib", "pulse_runtime_lib",
//   "pulse_system", "pulsedoc_lib", "qcontrols", "rendersystemdx11",
//   "resourcecompiler", "resourcefile", "resourcesystem", "scenesystem",
//   "schemasystem", "server", "smartprops", "sounddoc_lib",
//   "soundsystem", "soundsystem_lowlevel", "soundsystem_voicecontainers",
//   "steamaudio", "texturelib", "tier2", "toolscene", "toolutils2",
//   "vphysics2", "worldrenderer",
// ];

const CS2_SCHEMAS: SourceRepo = {
  owner: 'SteamTracking',
  repo: 'GameTracking-CS2',
  branch: 'master',
  prefixes: SCHEMA_CATEGORIES.map((c) => `DumpSource2/schemas/${c}/`),
  extensions: new Set(['.h']),
  remap(gitPath: string): string {
    // DumpSource2/schemas/server/Foo.h -> schemas/server/Foo.h
    return gitPath.replace('DumpSource2/schemas/', 'schemas/');
  },
};

// ── Helpers ─────────────────────────────────────────────────────────

function shouldFetch(entry: TreeEntry, src: SourceRepo): boolean {
  if (src.extraFiles?.includes(entry.path)) return true;
  const dot = entry.path.lastIndexOf('.');
  if (dot === -1) return false;
  return (
    src.prefixes.some((p) => entry.path.startsWith(p)) &&
    src.extensions.has(entry.path.slice(dot))
  );
}

async function fetchTree(src: SourceRepo): Promise<TreeEntry[]> {
  const url = `https://api.github.com/repos/${src.owner}/${src.repo}/git/trees/${src.branch}?recursive=1`;
  console.log(`  Fetching tree: ${src.owner}/${src.repo}...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'modsharp-mcp-fetch' },
  });
  if (!res.ok)
    throw new Error(`GitHub API ${res.status} (${url}): ${await res.text()}`);
  const data = (await res.json()) as { tree: TreeEntry[]; truncated: boolean };
  if (data.truncated) console.warn(`  Warning: tree truncated for ${src.repo}`);
  return data.tree.filter((e) => e.type === 'blob');
}

async function downloadFile(
  src: SourceRepo,
  entry: TreeEntry,
): Promise<boolean> {
  const localPath = resolve(FETCHED_DIR, src.remap(entry.path));

  // Cache by file size
  if (entry.size != null) {
    try {
      const st = await stat(localPath);
      if (st.size === entry.size) return false;
    } catch {
      /* not cached */
    }
  }

  await mkdir(dirname(localPath), { recursive: true });
  const rawUrl = `https://raw.githubusercontent.com/${src.owner}/${src.repo}/${src.branch}/${entry.path}`;
  const res = await fetch(rawUrl, {
    headers: { 'User-Agent': 'modsharp-mcp-fetch' },
  });
  if (!res.ok) {
    console.warn(`  Skip ${entry.path}: HTTP ${res.status}`);
    return false;
  }
  await writeFile(localPath, await res.text(), 'utf-8');
  return true;
}

async function fetchFromSource(src: SourceRepo): Promise<void> {
  const allEntries = await fetchTree(src);
  const toDownload = allEntries.filter((e) => shouldFetch(e, src));
  console.log(`  ${toDownload.length} files to download\n`);

  const BATCH = 20;
  let downloaded = 0;

  for (let i = 0; i < toDownload.length; i += BATCH) {
    const batch = toDownload.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((e) => downloadFile(src, e)));
    downloaded += results.filter(Boolean).length;
    const done = Math.min(i + BATCH, toDownload.length);
    process.stdout.write(`  ${done}/${toDownload.length} files processed\r`);
  }

  const cached = toDownload.length - downloaded;
  console.log(`\n  ${downloaded} downloaded, ${cached} cached.\n`);
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Fetching source data from GitHub...\n');
  await mkdir(FETCHED_DIR, { recursive: true });

  console.log('── ModSharp (Kxnrl/modsharp-public) ──');
  await fetchFromSource(MODSHARP);

  console.log('── CS2 Schemas (SteamTracking/GameTracking-CS2) ──');
  await fetchFromSource(CS2_SCHEMAS);

  console.log('Done! All source data fetched.');
}

main().catch((err) => {
  console.error('Fetch failed:', err);
  process.exit(1);
});
