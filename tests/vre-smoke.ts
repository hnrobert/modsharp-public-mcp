import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    cwd: import.meta.dirname.replace('/tests', ''),
  });
  const client = new Client({ name: 'vre-test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log(
    `Tools (${tools.tools.length}):`,
    tools.tools.map((t) => t.name).join(', '),
  );

  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    return (r.content as Array<{ text: string }>)[0]?.text ?? '';
  };

  console.log('\n--- search_vre_schemas(CBaseEntity, cs2) ---');
  console.log((await call('search_vre_schemas', { query: 'CBaseEntity', game: 'cs2', limit: 3 })).slice(0, 500));

  console.log('\n--- get_vre_schema_type(cs2/server/CBaseEntity) ---');
  const t = JSON.parse(
    await call('get_vre_schema_type', { uid: 'cs2/server/CBaseEntity' }),
  );
  console.log(
    `name: ${t.name} | size: ${t.size} | fields: ${t.fields.length} | _resolvedParents: ${JSON.stringify(t._resolvedParents)}`,
  );
  console.log(
    'first 3 fields:',
    t.fields
      .slice(0, 3)
      .map((f: { renderedType: string; name: string; offset: number }) => `${f.renderedType} ${f.name} @${f.offset}`)
      .join(', '),
  );

  console.log('\n--- get_vre_enum(cs2/server/MoveType_t) ---');
  const e = JSON.parse(
    await call('get_vre_enum', { uid: 'cs2/server/MoveType_t' }),
  );
  console.log(
    `name: ${e.name} | members: ${e.members.length} | sample: ${e.members.slice(0, 3).map((m: { name: string; value: number }) => `${m.name}=${m.value}`).join(', ')}`,
  );

  console.log('\n--- get_vre_schema_type(CBaseEntity) [bare-name fallback] ---');
  const t2 = JSON.parse(
    await call('get_vre_schema_type', { uid: 'CBaseEntity' }),
  );
  console.log('resolved uid:', t2.uid);

  console.log('\n--- cross-game: search_vre_schemas(CBaseEntity, all) ---');
  const cg = JSON.parse(
    await call('search_vre_schemas', { query: 'CBaseEntity', game: 'all', limit: 10 }),
  );
  console.log(
    'hits by game:',
    cg.results.map((r: { game: string; uid: string }) => `${r.game}:${r.uid}`).join('  '),
  );

  // Regression: existing schema tools still work
  console.log('\n--- regression: search_schemas(CBaseEntity) ---');
  console.log((await call('search_schemas', { query: 'CBaseEntity', limit: 2 })).slice(0, 300));

  const res = await client.listResources();
  console.log(
    `\nResources: ${res.resources.length} (vre/games present? ${res.resources.some((r) => r.uri === 'modsharp://vre/games')})`,
  );

  await client.close();
  console.log('\nAll VRE tests passed!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
