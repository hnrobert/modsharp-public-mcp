import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function run(script: string, label: string): void {
  console.log(`\n=== ${label} ===`);
  try {
    execFileSync('tsx', [resolve(ROOT, script)], {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 120_000,
    });
  } catch (err) {
    console.error(`Failed: ${label}`, err);
    process.exit(1);
  }
}

console.log('Building ModSharp MCP data...');
console.log('Root:', ROOT);

run('scripts/parse-csharp.ts', 'Step 1: Parse C# sources');
run('scripts/parse-markdown.ts', 'Step 2: Parse markdown docs & examples');
run('scripts/parse-schemas.ts', 'Step 3: Parse CS2 schemas');
run('scripts/parse-entities.ts', 'Step 4: Parse Source2 entities');
run('scripts/generate-indices.ts', 'Step 5: Generate search index');

console.log('\n=== Build complete! ===');
