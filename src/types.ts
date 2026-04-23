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

// === CS2 Schema Types ===
export interface SchemaClass {
  uid: string; // "server/CBaseEntity" or "client/C_CSPlayerPawn"
  name: string; // "CBaseEntity"
  parent?: string; // "CEntityInstance"
  category: string; // "server", "client", "entity2", etc.
  sourceFile: string; // "server/CBaseEntity.h"
  networkVars: SchemaField[];
  localFields: SchemaField[];
  kv3Defaults?: Record<string, string>;
}

export interface SchemaField {
  name: string;
  type: string;
  isNetworked: boolean;
  networkPriority?: number;
  networkUserGroup?: string;
  serializer?: string;
  notSaved?: boolean;
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
  schemas: Map<string, SchemaClass>;
  entities: Map<string, EntityClass>;
  searchIndex: Map<string, string[]>;
  toc: TocNode[];
  methodsIndex: Map<string, string[]>; // lowercase method name -> type UIDs
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
