import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    cwd: import.meta.dirname.replace('/tests', ''),
  });

  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  // Test initialize
  console.log('Connected to server');

  // Test list tools
  const tools = await client.listTools();
  console.log(`Tools: ${tools.tools.map((t) => t.name).join(', ')}`);

  // Test search_api
  const searchResult = await client.callTool({
    name: 'search_api',
    arguments: { query: 'IHookManager', limit: 3 },
  });
  console.log("\nsearch_api('IHookManager'):");
  console.log(
    (searchResult.content as Array<{ text: string }>)[0]?.text?.slice(0, 500),
  );

  // Test list_namespace
  const nsResult = await client.callTool({
    name: 'list_namespace',
    arguments: { namespace: 'Sharp.Shared.Managers' },
  });
  console.log("\nlist_namespace('Sharp.Shared.Managers'):");
  console.log(
    (nsResult.content as Array<{ text: string }>)[0]?.text?.slice(0, 500),
  );

  // Test get_api_type
  const typeResult = await client.callTool({
    name: 'get_api_type',
    arguments: { uid: 'Sharp.Shared.Enums.CStrikeTeam', includeMembers: true },
  });
  console.log("\nget_api_type('CStrikeTeam'):");
  console.log(
    (typeResult.content as Array<{ text: string }>)[0]?.text?.slice(0, 500),
  );

  // Test search_docs
  const docsResult = await client.callTool({
    name: 'search_docs',
    arguments: { query: 'hello world', limit: 3 },
  });
  console.log("\nsearch_docs('hello world'):");
  console.log(
    (docsResult.content as Array<{ text: string }>)[0]?.text?.slice(0, 500),
  );

  // Test get_code_example
  const exampleResult = await client.callTool({
    name: 'get_code_example',
    arguments: { id: 'hello-world' },
  });
  console.log("\nget_code_example('hello-world'):");
  console.log(
    (exampleResult.content as Array<{ text: string }>)[0]?.text?.slice(0, 300),
  );

  // Test get_guide
  const guideResult = await client.callTool({
    name: 'get_guide',
    arguments: { path: 'getting-started', locale: 'en' },
  });
  console.log("\nget_guide('getting-started'):");
  const guideText =
    (guideResult.content as Array<{ text: string }>)[0]?.text || '';
  console.log(guideText.slice(0, 300));

  // Test search_header_schemas
  const schemaSearchResult = await client.callTool({
    name: 'search_header_schemas',
    arguments: { query: 'CBaseEntity', category: 'server', limit: 3 },
  });
  console.log("\nsearch_header_schemas('CBaseEntity'):");
  console.log(
    (schemaSearchResult.content as Array<{ text: string }>)[0]?.text?.slice(
      0,
      400,
    ),
  );

  // Test get_header_schema
  const schemaTypeResult = await client.callTool({
    name: 'get_header_schema',
    arguments: { uid: 'server/CBaseEntity' },
  });
  console.log("\nget_header_schema('server/CBaseEntity'):");
  console.log(
    (schemaTypeResult.content as Array<{ text: string }>)[0]?.text?.slice(
      0,
      400,
    ),
  );

  // Test list resources
  const resources = await client.listResources();
  console.log(`\nResources: ${resources.resources.length} registered`);

  // Test search_signatures (rosetta)
  const sigResult = await client.callTool({
    name: 'search_signatures',
    arguments: { query: 'TakeDamage', limit: 3 },
  });
  console.log("\nsearch_signatures('TakeDamage'):");
  console.log(
    (sigResult.content as Array<{ text: string }>)[0]?.text?.slice(0, 400),
  );

  // Test search_convars (rosetta)
  const convarResult = await client.callTool({
    name: 'search_convars',
    arguments: { query: 'bot_quota', limit: 3 },
  });
  console.log("\nsearch_convars('bot_quota'):");
  console.log(
    (convarResult.content as Array<{ text: string }>)[0]?.text?.slice(0, 400),
  );

  // Test search_entity_io (rosetta)
  const ioResult = await client.callTool({
    name: 'search_entity_io',
    arguments: { query: 'CBombTarget', limit: 5 },
  });
  console.log("\nsearch_entity_io('CBombTarget'):");
  console.log(
    (ioResult.content as Array<{ text: string }>)[0]?.text?.slice(0, 400),
  );

  await client.close();
  console.log('\nAll tests passed!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
