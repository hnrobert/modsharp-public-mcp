// === Type kinds ===
export type TypeKind = 'interface' | 'class' | 'struct' | 'enum' | 'delegate';

// === Member kinds ===
export type MemberKind =
  | 'method'
  | 'property'
  | 'field'
  | 'event'
  | 'constructor';

// === Locale ===
export type Locale = 'en' | 'cn';

// === API Type Info ===
export interface ApiTypeInfo {
  uid: string;
  name: string;
  fullName: string;
  kind: TypeKind;
  namespace: string;
  summary?: string;
  remarks?: string;
  syntax?: string;
  inheritance?: string[];
  implements?: string[];
  members: MemberInfo[];
  deprecated?: string;
  isStatic: boolean;
  typeParameters?: string[];
  /** For Shared interfaces: which Core classes implement this */
  implementations?: Array<{ uid: string; name: string }>;
  /** For Core classes: which Shared interfaces this implements */
  implementsTypes?: Array<{ uid: string; name: string }>;
}

// === Member Info ===
export interface MemberInfo {
  uid: string;
  name: string;
  kind: MemberKind;
  summary?: string;
  parameters?: ParameterInfo[];
  returnType?: string;
  propertyType?: string;
  fieldType?: string;
  enumValue?: string;
  isStatic: boolean;
  isVirtual: boolean;
  isAbstract: boolean;
  hasGetter: boolean;
  hasSetter: boolean;
  deprecated?: string;
  syntax?: string;
}

// === Parameter Info ===
export interface ParameterInfo {
  name: string;
  type: string;
  description?: string;
  defaultValue?: string;
}

// === Namespace Info ===
export interface NamespaceInfo {
  uid: string;
  name: string;
  parentNamespace?: string;
  childNamespaces: string[];
  types: string[]; // Type UIDs
}

// === Documentation Article ===
export interface DocArticle {
  id: string;
  locale: Locale;
  title: string;
  content: string;
  category?: string;
}

// === Code Example ===
export interface CodeExample {
  id: string;
  title: string;
  description?: string;
  code: string;
  tags?: string[];
  relatedTypes?: string[];
  sourceFile: string;
}

// === Search Index ===
export interface SearchIndex {
  tokens: Record<string, string[]>; // token -> entity IDs
}

// === TOC Node ===
export interface TocNode {
  title: string;
  titleCn?: string;
  path?: string;
  children?: TocNode[];
}

// === Engine Schema — header declarations (GameTracking CS2 C++ headers) ===
// Served by the header_* tools (search_header_schemas / get_header_schema).
export interface HeaderSchemaClass {
  uid: string; // "server/CBaseEntity" or "client/C_CSPlayerPawn"
  name: string; // "CBaseEntity"
  parent?: string; // "CEntityInstance"
  category: string; // "server", "client", "entity2", etc.
  sourceFile: string; // "server/CBaseEntity.h"
  networkVars: HeaderSchemaField[];
  localFields: HeaderSchemaField[];
  kv3Defaults?: Record<string, string>;
}

export interface HeaderSchemaField {
  name: string;
  type: string;
  isNetworked: boolean;
  networkPriority?: number;
  networkUserGroup?: string;
  serializer?: string;
  notSaved?: boolean;
}

// === Engine Schema — full memory layout (ValveResourceFormat/SchemaExplorer) ===
// Covers cs2/dota2/deadlock. Served by the schema tools
// (search_schemas / get_schema_fields / get_enum). Distinct from the header
// declarations above: this is reverse-engineered struct layout with offsets,
// recursive types, and enums. On-disk it is still data/fetched/vre-schemas/
// and data/generated/vre-schemas.json (named after the VRF data source).
export type SchemaGame = 'cs2' | 'dota2' | 'deadlock';

// Recursive field type, discriminated on `category`.
export type SchemaFieldType =
  | { category: 'builtin'; name: string }
  | { category: 'declared_class'; module: string; name: string }
  | { category: 'declared_enum'; module: string; name: string }
  | { category: 'atomic'; name: string; inner?: SchemaFieldType }
  | { category: 'ptr'; inner: SchemaFieldType }
  | { category: 'fixed_array'; count: number; inner: SchemaFieldType }
  | { category: 'bitfield'; count: number };

export interface SchemaMeta {
  name: string;
  value?: string;
}

export interface SchemaField {
  name: string;
  offset: number;
  type: SchemaFieldType;
  renderedType: string;
  metadata?: SchemaMeta[];
}

export interface SchemaClass {
  uid: string; // "{game}/{module}/{name}"
  game: SchemaGame;
  name: string;
  module: string;
  size: number;
  parents: Array<{ module: string; name: string }>;
  fields: SchemaField[];
  metadata?: SchemaMeta[];
}

export interface SchemaEnumMember {
  name: string;
  value: number;
  metadata?: SchemaMeta[];
}

export interface SchemaEnum {
  uid: string; // "{game}/{module}/{name}"
  game: SchemaGame;
  name: string;
  module: string;
  alignment: string;
  members: SchemaEnumMember[];
  metadata?: SchemaMeta[];
}

export interface SchemaGameInfo {
  revision: string;
  versionDate: string;
  classes: number;
  enums: number;
}

export interface SchemaBundle {
  generatedAt: string;
  games: Record<SchemaGame, SchemaGameInfo>;
  classes: Record<string, SchemaClass>;
  enums: Record<string, SchemaEnum>;
}

// === Rosetta (source2rosetta — CS2 signatures / gamedata) ===
// Entries are kept verbatim from the upstream rolling release; extra fields
// flow through the index signatures below.
export interface RosettaFunction {
  name: string;
  tier: 'core' | 'high_confidence' | 'experimental' | string;
  validated?: boolean;
  signature?: { library?: string; linux?: string; [k: string]: unknown };
  anchors?: string[];
  measured?: { int?: number; float?: number; ret?: string; [k: string]: unknown };
  description?: { text?: string; [k: string]: unknown };
  prototype?: unknown;
  bindings?: Array<Record<string, unknown>>;
  aliases?: string[];
  offset?: number;
  class?: string;
  [k: string]: unknown;
}

export interface RosettaConvar {
  name: string;
  library?: string;
  description?: string;
  flags?: string[];
  flags_raw?: string;
  addr?: string;
  [k: string]: unknown;
}

export interface RosettaEntityIo {
  name?: string;
  input?: string;
  output?: string;
  member?: string;
  class?: string;
  handler?: string;
  library?: string;
  offset?: number;
  addr?: string;
  abi?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface RosettaPulseSurface {
  name: string;
  library?: string;
  display?: string;
  params?: Array<Record<string, unknown>>;
  policy?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface RosettaCommand {
  name: string;
  library?: string;
  description?: string;
  flags?: string[];
  class?: string;
  ret?: string;
  [k: string]: unknown;
}

export interface RosettaUnresolved {
  name: string;
  reason?: string;
  detail?: string;
}

export interface RosettaBundle {
  meta: {
    build: string;
    version?: string;
    game?: string;
    counts: Record<string, number>;
    generatedAt: string;
  };
  functions: RosettaFunction[];
  convars: RosettaConvar[];
  entityInputs: RosettaEntityIo[];
  entityOutputs: RosettaEntityIo[];
  entityClasses: Record<string, string>;
  pulse: RosettaPulseSurface[];
  commands: RosettaCommand[];
  vscript: RosettaCommand[];
  unresolved: RosettaUnresolved[];
}

// === Source2 Entity (Hammer) ===
export interface EntityClass {
  classname: string;
  entityType: string; // "Mesh", "Point", etc.
  description: string;
  games: string[];
  properties: EntityProperty[];
  inputs: EntityInputOutput[];
  outputs: EntityInputOutput[];
  relatedSchemaUid?: string; // cross-ref e.g. "server/CTriggerMultiple"
}

export interface EntityProperty {
  friendlyName: string;
  internalName: string;
  variableType: string;
  description: string;
  options?: Array<{ name: string; key: string; description?: string }>;
}

export interface EntityInputOutput {
  name: string;
  description: string;
  variableType: string;
  direction: 'Input' | 'Output';
}

// === Loaded Data (runtime) ===
export interface LoadedData {
  types: Map<string, ApiTypeInfo>;
  namespaces: Map<string, NamespaceInfo>;
  docsEn: DocArticle[];
  docsCn: DocArticle[];
  examples: Map<string, CodeExample>;
  headerSchemas: Map<string, HeaderSchemaClass>;
  entities: Map<string, EntityClass>;
  searchIndex: Map<string, string[]>;
  toc: TocNode[];
  methodsIndex: Map<string, string[]>; // lowercase method name -> type UIDs
  schemas: Map<string, SchemaClass>;
  enums: Map<string, SchemaEnum>;
  schemasByGame: Map<SchemaGame, string[]>;
  enumsByGame: Map<SchemaGame, string[]>;
  schemaGames: Record<SchemaGame, SchemaGameInfo>;
  rosetta: RosettaBundle | null;
  rosettaFunctions: Map<string, RosettaFunction>; // name -> entry
  rosettaConvars: Map<string, RosettaConvar>; // name -> entry
  rosettaUnresolved: Map<string, RosettaUnresolved>; // name -> reason
}

// === Tool result types ===
export interface SearchResult {
  id: string;
  type: 'doc' | 'api-type' | 'example' | 'schema' | 'entity';
  title: string;
  locale?: Locale;
  snippet: string;
  relevanceScore: number;
}

export interface SearchDocsResult {
  total: number;
  results: SearchResult[];
  hasMore: boolean;
}

export interface SearchApiResult {
  total: number;
  results: Array<{
    uid: string;
    name: string;
    kind: TypeKind;
    namespace: string;
    summary?: string;
    matchedMembers?: Array<{
      name: string;
      kind: MemberKind;
      summary?: string;
    }>;
    relevanceScore: number;
  }>;
  hasMore: boolean;
}

export interface ListNamespaceResult {
  namespace: string;
  childNamespaces: Array<{ uid: string; name: string; typeCount: number }>;
  types: Array<{ uid: string; name: string; kind: TypeKind; summary?: string }>;
}
