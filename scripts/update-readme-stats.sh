#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  echo "No tag specified, skipping stats update."
  exit 0
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

node -e "
const fs = require('fs');
const path = require('path');

const GEN = path.join('$ROOT', 'data/generated');
const load = n => JSON.parse(fs.readFileSync(path.join(GEN, n), 'utf8'));

const api = load('api-types.json');
const schemas = load('schemas.json');
const docsEn = load('docs-en.json');
const docsCn = load('docs-cn.json');
const examples = load('examples.json');
const si = load('search-index.json');

let members = 0;
for (const t of Object.values(api)) members += t.members.length;
const cats = new Set(Object.values(schemas).map(s => s.category));
let netFields = 0;
for (const s of Object.values(schemas)) netFields += (s.networkVars || []).length;
const tokens = Object.keys(si.tokens || si).length;

const stats = [
  '## Data Stats (as of $TAG)',
  '',
  '- **' + Object.keys(api).length + '** ModSharp API types with **' + members + '** members',
  '- **' + Object.keys(schemas).length + '** CS2/Source2 engine schema classes across **' + cats.size + '** categories with **' + netFields + '** network fields',
  '- **' + docsEn.length + '** English + **' + docsCn.length + '** Chinese documentation articles',
  '- **' + examples.length + '** code examples',
  '- **' + tokens + '** search index tokens',
].join('\n') + '\n';

const readmePath = path.join('$ROOT', 'README.md');
const readme = fs.readFileSync(readmePath, 'utf8');
const updated = readme.replace(
  /## Data Stats \(as of [^)]+\)\n\n(?:- .+\n)*/,
  stats
);

if (updated === readme) {
  console.error('ERROR: Data Stats section not found in README.md');
  process.exit(1);
}
fs.writeFileSync(readmePath, updated, 'utf8');

console.log('Updated README.md with stats for $TAG');
console.log('  ' + Object.keys(api).length + ' types, ' + members + ' members, ' + Object.keys(schemas).length + ' schemas (' + cats.size + ' categories), ' + netFields + ' network fields');
console.log('  ' + docsEn.length + ' EN + ' + docsCn.length + ' CN docs, ' + examples.length + ' examples, ' + tokens + ' tokens');
"
