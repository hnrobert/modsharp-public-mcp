import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';

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
  /** Optional filter: return false to skip downloading this file */
  filter?: (gitPath: string) => boolean;
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
  let toDownload = allEntries.filter((e) => shouldFetch(e, src));

  // Apply optional filter
  if (src.filter) {
    toDownload = toDownload.filter((e) => src.filter!(e.path));
  }

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

// ── VRE Schemas (ValveResourceFormat/SchemaExplorer) ──────────────
// schemas/{game}.json.gz must be downloaded as binary and gunzipped.

const VRE_GAMES = ['cs2', 'dota2', 'deadlock'] as const;
const VRE_FETCH_DIR = resolve(FETCHED_DIR, 'vre-schemas');

const VRE_SOURCE: SourceRepo = {
  owner: 'ValveResourceFormat',
  repo: 'SchemaExplorer',
  branch: 'main',
  prefixes: ['schemas/'],
  extensions: new Set(['.gz']),
  remap: (p: string) => p, // unused by fetchTree, which only needs owner/repo/branch
};

// Download each game's schemas/{game}.json into vre-schemas/{game}.json.
// Upstream shipped plain .json (no .gz) since 2026-08-09; the legacy .json.gz
// form is still accepted in case it comes back. Cached by file size.
// IMPORTANT: this function throws when any game ends up without data. It used
// to skip silently, and when upstream renamed the files every scheduled build
// for three weeks published a dataset (and Docker image) with no VRE schemas.
async function fetchVreSchemas(): Promise<void> {
  await mkdir(VRE_FETCH_DIR, { recursive: true });
  const tree = await fetchTree(VRE_SOURCE);

  const notFound: string[] = [];
  let downloaded = 0;
  let cached = 0;

  for (const game of VRE_GAMES) {
    const plain = tree.find((e) => e.path === `schemas/${game}.json`);
    const gz = tree.find((e) => e.path === `schemas/${game}.json.gz`);
    const entry = plain ?? gz;
    const gzPath = resolve(VRE_FETCH_DIR, `${game}.json.gz`);
    const jsonPath = resolve(VRE_FETCH_DIR, `${game}.json`);

    // Cache by size, against whichever mirror this form uses.
    if (entry?.size != null) {
      const cachePath = plain ? jsonPath : gzPath;
      try {
        const st = await stat(cachePath);
        if (st.size === entry.size) {
          cached++;
          continue;
        }
      } catch {
        /* not cached yet */
      }
    }

    if (!entry) {
      notFound.push(game);
      continue;
    }

    const rawUrl = `https://raw.githubusercontent.com/${VRE_SOURCE.owner}/${VRE_SOURCE.repo}/${VRE_SOURCE.branch}/${entry.path}`;
    const res = await fetch(rawUrl, {
      headers: { 'User-Agent': 'modsharp-mcp-fetch' },
    });
    if (!res.ok) {
      console.warn(`  ${entry.path}: HTTP ${res.status}`);
      notFound.push(game);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    try {
      const json = plain ? buf : gunzipSync(buf);
      JSON.parse(json.toString('utf-8')); // validate before writing
      if (plain) {
        await writeFile(jsonPath, json);
      } else {
        await writeFile(gzPath, buf);
        await writeFile(jsonPath, json);
      }
      downloaded++;
      process.stdout.write(
        `  ${game}: downloaded ${entry.path} (${(buf.length / 1024).toFixed(0)}KB)\n`,
      );
    } catch (err) {
      console.warn(`  Failed to decompress/parse ${entry.path}: ${err}`);
      notFound.push(game);
    }
  }

  // Never continue with a partial dataset: every game must have usable local
  // data, freshly downloaded or cached.
  const noData: string[] = [];
  for (const game of VRE_GAMES) {
    try {
      await stat(resolve(VRE_FETCH_DIR, `${game}.json`));
    } catch {
      noData.push(game);
    }
  }
  if (noData.length > 0) {
    throw new Error(
      `VRE schemas unavailable for: ${noData.join(', ')}. ` +
        `(fetch failures: ${notFound.join(', ') || 'none'} — upstream may have ` +
        `renamed files again; see schemas/ in ValveResourceFormat/SchemaExplorer.)`,
    );
  }
  console.log(`  ${downloaded} downloaded, ${cached} cached.\n`);
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Fetching source data from GitHub...\n');
  await mkdir(FETCHED_DIR, { recursive: true });

  console.log('── ModSharp (Kxnrl/modsharp-public) ──');
  await fetchFromSource(MODSHARP);

  console.log('── CS2 Schemas (SteamTracking/GameTracking-CS2) ──');
  await fetchFromSource(CS2_SCHEMAS);

  console.log('── Source2 Wiki Entities (Source2Wiki/Source2Wiki) ──');
  await fetchFromSource({
    owner: 'Source2Wiki',
    repo: 'Source2Wiki',
    branch: 'master',
    prefixes: ['fgd_dump/', 'static/fgd_dump/'],
    extensions: new Set(['.json']),
    extraFiles: ['static/fgd_dump/entityIndex.json'],
    remap(gitPath: string): string {
      if (gitPath === 'static/fgd_dump/entityIndex.json') return 'entities/_index.json';
      // fgd_dump/trigger_multiple.json -> entities/trigger_multiple.json
      return gitPath.replace('fgd_dump/', 'entities/');
    },
  });

  console.log('── VRE Schemas (ValveResourceFormat/SchemaExplorer) ──');
  await fetchVreSchemas();

  console.log('Done! All source data fetched.');
}

main().catch((err) => {
  console.error('Fetch failed:', err);
  process.exit(1);
});
