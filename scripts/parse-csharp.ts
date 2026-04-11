import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, extname, relative } from 'node:path';
import type {
  ApiTypeInfo,
  NamespaceInfo,
  MemberInfo,
  ParameterInfo,
} from '../src/types.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const SOURCE_DIR = resolve(PROJECT_ROOT, 'data/fetched/Sharp.Shared');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'data/generated');

async function findCsFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findCsFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.cs')) {
      files.push(fullPath);
    }
  }
  return files;
}

interface XmlDoc {
  summary?: string;
  remarks?: string;
  params: Map<string, string>;
  returns?: string;
  example?: string;
}

function parseXmlDoc(
  lines: string[],
  endLineIdx: number,
): { doc: XmlDoc; startIdx: number } | null {
  // Walk backwards from the declaration to find /// comments
  let i = endLineIdx - 1;
  const docLines: string[] = [];

  while (i >= 0) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('///')) {
      docLines.unshift(lines[i].replace(/^\s*\/\/\/\s?/, '').trim());
      i--;
    } else if (trimmed === '' || trimmed.startsWith('//')) {
      // skip blank lines or non-XML comments between doc lines
      if (docLines.length > 0) i--;
      else break;
    } else {
      break;
    }
  }

  if (docLines.length === 0) return null;

  const raw = docLines.join('\n');
  const doc: XmlDoc = { params: new Map() };

  // Extract <summary>
  const summaryMatch = raw.match(/<summary>([\s\S]*?)<\/summary>/);
  if (summaryMatch) {
    doc.summary = cleanXmlText(summaryMatch[1]);
  }

  // Extract <remarks>
  const remarksMatch = raw.match(/<remarks>([\s\S]*?)<\/remarks>/);
  if (remarksMatch) {
    doc.remarks = cleanXmlText(remarksMatch[1]);
  }

  // Extract <param name="...">
  const paramRegex = /<param\s+name="(\w+)">([\s\S]*?)<\/param>/g;
  let m;
  while ((m = paramRegex.exec(raw))) {
    doc.params.set(m[1], cleanXmlText(m[2]));
  }

  // Extract <returns>
  const returnsMatch = raw.match(/<returns>([\s\S]*?)<\/returns>/);
  if (returnsMatch) {
    doc.returns = cleanXmlText(returnsMatch[1]);
  }

  return { doc, startIdx: i + 1 };
}

function cleanXmlText(text: string): string {
  return text
    .replace(/<see\s+cref="([^"]+)"\s*\/>/g, '$1')
    .replace(/<see\s+langword="([^"]+)"\s*\/>/g, '$1')
    .replace(/<seealso\s+cref="([^"]+)"\s*\/>/g, '$1')
    .replace(/<paramref\s+name="([^"]+)"\s*\/>/g, '$1')
    .replace(/<c>([^<]*)<\/c>/g, '`$1`')
    .replace(/<code>([\s\S]*?)<\/code>/g, '$1')
    .replace(/<para\s*\/?>/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<list[^>]*>/g, '')
    .replace(/<item>/g, '- ')
    .replace(/<description>/g, '')
    .replace(
      /<\/?(list|item|description|para|remarks|summary|returns|example|note|tip|warning|caution|important)[^>]*>/g,
      '',
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractObsolete(text: string): string | undefined {
  const match = text.match(/\[Obsolete\("([^"]*)"[^]]*\)\]/);
  return match ? match[1] : undefined;
}

function parseParameters(paramsStr: string): ParameterInfo[] {
  if (!paramsStr || paramsStr.trim() === '') return [];

  const params: ParameterInfo[] = [];
  // Split by comma, respecting generic brackets and parentheses
  let depth = 0;
  let current = '';
  for (const ch of paramsStr) {
    if (ch === '<' || ch === '(') depth++;
    else if (ch === '>' || ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      params.push(parseSingleParam(current.trim()));
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    params.push(parseSingleParam(current.trim()));
  }
  return params;
}

function parseSingleParam(param: string): ParameterInfo {
  // e.g. "string input", "IBaseEntity? activator = null", "in TakeDamageInfo info"
  let clean = param.replace(/^\s*(ref|out|in|params)\s+/, '');
  const defaultValueMatch = clean.match(/=\s*(.+)$/);
  if (defaultValueMatch) {
    clean = clean.slice(0, clean.length - defaultValueMatch[0].length);
  }

  // Split into type and name - last word is the name
  const parts = clean.trim().split(/\s+/);
  const name = parts[parts.length - 1].replace(/\?$/, '');
  const type = parts
    .slice(0, parts.length - 1)
    .join(' ')
    .replace(/\?$/, '');

  return {
    name,
    type: type || 'object',
    defaultValue: defaultValueMatch?.[1]?.trim(),
  };
}

function parseCsFile(
  filePath: string,
  content: string,
): { types: ApiTypeInfo[]; namespaces: NamespaceInfo[] } {
  const types: ApiTypeInfo[] = [];
  const namespaces: NamespaceInfo[] = [];

  const lines = content.split('\n');

  // Find namespace
  let ns = '';
  for (const line of lines) {
    const nsMatch = line.match(/^namespace\s+([\w.]+)\s*[;{]/);
    if (nsMatch) {
      ns = nsMatch[1];
      break;
    }
  }
  if (!ns) return { types, namespaces };

  // Skip copyright header - find first non-comment, non-using line after namespace
  const bodyStart = lines.findIndex((l) => l.includes(`namespace ${ns}`)) + 1;

  // Find type declarations
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip comments, using, regions, blank
    if (
      !line ||
      line.startsWith('//') ||
      line.startsWith('using ') ||
      line.startsWith('#region') ||
      line.startsWith('#endregion')
    )
      continue;

    // Match type declaration
    const typeMatch = line.match(
      /^(?:\[([^\]]+)\]\s*)*((?:(?:public|internal|sealed|static|abstract|unsafe|readonly|partial)\s+)*)((?:readonly\s+record\s+)?(?:interface|class|struct|enum|delegate))\s+(\w+)(?:<([^>]+)>)?(?:\s*:\s*(.+?))?(?:\s*{)?\s*$/,
    );

    if (!typeMatch) continue;

    const attributes = typeMatch[1] || '';
    const modifiers = typeMatch[2] || '';
    const kindStr = typeMatch[3].replace('readonly record ', '');
    const typeName = typeMatch[4];
    const genericParams = typeMatch[5];
    const inheritance = typeMatch[6]?.trim();

    // Map kind
    let kind: ApiTypeInfo['kind'] = 'class';
    if (kindStr.includes('interface')) kind = 'interface';
    else if (kindStr.includes('struct') || kindStr.includes('record'))
      kind = 'struct';
    else if (kindStr.includes('enum')) kind = 'enum';
    else if (kindStr.includes('delegate')) kind = 'delegate';

    const uid = `${ns}.${typeName}`;
    const isStatic = modifiers.includes('static');

    // Get XML doc for type
    const typeDocResult = parseXmlDoc(lines, i);

    const deprecated = extractObsolete(attributes);

    // Parse inheritance/implements
    let inheritanceList: string[] = [];
    let implementsList: string[] = [];
    if (inheritance) {
      const parts = inheritance.split(',').map((s) => s.trim());
      for (const part of parts) {
        if (kind === 'interface' || part.startsWith('I')) {
          implementsList.push(part);
        } else {
          inheritanceList.push(part);
        }
      }
    }

    // Parse members - find the type body
    const members: MemberInfo[] = [];
    if (kind !== 'delegate') {
      const bodyResult = extractTypeBody(lines, i);
      if (bodyResult) {
        parseMembers(bodyResult, uid, ns, members);
      }
    }

    types.push({
      uid,
      name: typeName,
      fullName: uid,
      kind,
      namespace: ns,
      summary: typeDocResult?.doc.summary,
      remarks: typeDocResult?.doc.remarks,
      syntax: line.trim(),
      inheritance: inheritanceList.length > 0 ? inheritanceList : undefined,
      implements: implementsList.length > 0 ? implementsList : undefined,
      members,
      deprecated,
      isStatic,
      typeParameters: genericParams
        ? genericParams.split(',').map((s) => s.trim())
        : undefined,
    });
  }

  // Build namespace info
  if (ns && types.length > 0) {
    namespaces.push({
      uid: ns,
      name: ns.split('.').pop() || ns,
      childNamespaces: [],
      types: types.map((t) => t.uid),
    });
  }

  return { types, namespaces };
}

function extractTypeBody(
  lines: string[],
  typeLineIdx: number,
): string[] | null {
  // Find opening brace
  let braceStart = typeLineIdx;
  for (let i = typeLineIdx; i < lines.length; i++) {
    if (lines[i].includes('{')) {
      braceStart = i;
      break;
    }
    // If it's a single-line declaration without body (delegate, etc.)
    if (lines[i].trim().endsWith(';')) return null;
  }

  let depth = 0;
  const bodyLines: string[] = [];
  for (let i = braceStart; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    bodyLines.push(lines[i]);
    if (depth === 0) break;
  }

  // Return inner body (between first { and last })
  if (bodyLines.length > 2) {
    return bodyLines.slice(1, -1);
  }
  return bodyLines;
}

function parseMembers(
  bodyLines: string[],
  parentUid: string,
  ns: string,
  members: MemberInfo[],
): void {
  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i].trim();

    // Skip blanks, comments, regions, attributes on own line
    if (
      !line ||
      (line.startsWith('//') && !line.startsWith('///')) ||
      line.startsWith('#region') ||
      line.startsWith('#endregion')
    )
      continue;

    // Skip nested types (lines with access modifier + type keyword)
    if (
      /^(?:public|internal|private|protected)\s+(?:sealed\s+|static\s+|abstract\s+)*(?:interface|class|struct|enum)\s+/.test(
        line,
      )
    )
      continue;

    // Get XML doc
    const docResult = parseXmlDoc(bodyLines, i);

    // Check for [Obsolete]
    const deprecated = extractObsolete(line);

    // Try to match different member patterns

    // Property: Type Name { get; [set;] }
    const propMatch = line.match(
      /^(?:\[.*?\]\s*)*(?:(?:public|internal|protected|private|new|unsafe|virtual|abstract|override|sealed|static|extern)\s+)*([\w.<>\[\],\s\?]+?)\s+(\w+)\s*\{([^}]*)\}/,
    );
    if (propMatch && !line.includes('(') && !line.startsWith('public const')) {
      const [, typeStr, name, accessors] = propMatch;
      const isStatic = line.includes('static ');
      members.push({
        uid: `${parentUid}.${name}`,
        name,
        kind: 'property',
        summary: docResult?.doc.summary,
        propertyType: typeStr.trim(),
        isStatic,
        isVirtual: line.includes('virtual '),
        isAbstract: line.includes('abstract '),
        hasGetter: accessors.includes('get'),
        hasSetter: accessors.includes('set'),
        deprecated,
        syntax: line,
      });
      continue;
    }

    // Enum member: Name, or Name = Value,
    if (
      /^\s*(?:\[.*?\]\s*)*\w+\s*[=,]/.test(line) &&
      !line.includes('(') &&
      !line.includes('{')
    ) {
      const enumMatch = line.match(
        /^\s*(?:\[.*?\]\s*)*(\w+)\s*(?:=\s*([^,]+))?\s*,?\s*$/,
      );
      if (enumMatch) {
        members.push({
          uid: `${parentUid}.${enumMatch[1]}`,
          name: enumMatch[1],
          kind: 'field',
          summary: docResult?.doc.summary,
          isStatic: false,
          isVirtual: false,
          isAbstract: false,
          hasGetter: false,
          hasSetter: false,
          deprecated,
          enumValue: enumMatch[2]?.trim(),
        });
        continue;
      }
    }

    // Field: public const/modifier Type Name = Value;
    const fieldMatch = line.match(
      /^(?:\[.*?\]\s*)*(?:(?:public|internal|protected|private|new|unsafe|static|readonly|const|volatile)\s+)+([\w.<>\[\],\s\?]+?)\s+(\w+)\s*(?:=\s*(.+?))?\s*;/,
    );
    if (fieldMatch && !line.includes('(') && !line.includes('{')) {
      const [, typeStr, name, value] = fieldMatch;
      members.push({
        uid: `${parentUid}.${name}`,
        name,
        kind: 'field',
        summary: docResult?.doc.summary,
        fieldType: typeStr.trim(),
        isStatic: line.includes('static ') || line.includes('const '),
        isVirtual: false,
        isAbstract: false,
        hasGetter: false,
        hasSetter: false,
        deprecated,
        enumValue: value?.trim()?.replace(/;$/, ''),
      });
      continue;
    }

    // Method: ReturnType Name(params);
    const methodMatch = line.match(
      /^(?:\[.*?\]\s*)*(?:(?:public|internal|protected|private|new|unsafe|virtual|abstract|override|sealed|static|extern)\s+)*([\w.<>\[\],\s\?]+?)\s+(\w+)\s*<([^>]+)>\s*\(([^)]*)\)/,
    );
    if (!methodMatch) {
      // Try without generic return
      const methodMatch2 = line.match(
        /^(?:\[.*?\]\s*)*(?:(?:public|internal|protected|private|new|unsafe|virtual|abstract|override|sealed|static|extern)\s+)*([\w.<>\[\],\s\?]+?)\s+(\w+)\s*\(([^)]*)\)/,
      );
      if (methodMatch2) {
        const [, returnStr, name, paramsStr] = methodMatch2;
        // Skip if looks like a type declaration
        if (['interface', 'class', 'struct', 'enum'].includes(returnStr.trim()))
          continue;

        const isStatic = line.includes('static ');
        const params = parseParameters(paramsStr);
        // Add param descriptions from XML doc
        if (docResult?.doc.params) {
          for (const param of params) {
            const desc = docResult.doc.params.get(param.name);
            if (desc) param.description = desc;
          }
        }

        members.push({
          uid: `${parentUid}.${name}`,
          name,
          kind: name === parentUid.split('.').pop() ? 'constructor' : 'method',
          summary: docResult?.doc.summary,
          parameters: params.length > 0 ? params : undefined,
          returnType: returnStr.trim() === 'void' ? 'void' : returnStr.trim(),
          isStatic,
          isVirtual: line.includes('virtual '),
          isAbstract: line.includes('abstract '),
          hasGetter: false,
          hasSetter: false,
          deprecated,
          syntax: line,
        });
        continue;
      }
    } else {
      const [, returnStr, name, genericPart, paramsStr] = methodMatch;
      const isStatic = line.includes('static ');
      const params = parseParameters(paramsStr);

      members.push({
        uid: `${parentUid}.${name}`,
        name,
        kind: 'method',
        summary: docResult?.doc.summary,
        parameters: params.length > 0 ? params : undefined,
        returnType: returnStr.trim(),
        isStatic,
        isVirtual: line.includes('virtual '),
        isAbstract: line.includes('abstract '),
        hasGetter: false,
        hasSetter: false,
        deprecated,
        syntax: line,
      });
      continue;
    }
  }
}

async function main() {
  console.log('Parsing C# source files from:', SOURCE_DIR);

  const files = await findCsFiles(SOURCE_DIR);
  console.log(`Found ${files.length} .cs files`);

  const allTypes: Record<string, ApiTypeInfo> = {};
  const allNamespaces: Record<string, NamespaceInfo> = {};

  let typeCount = 0;
  let memberCount = 0;
  const kindCounts: Record<string, number> = {};

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const { types, namespaces } = parseCsFile(file, content);

    for (const type of types) {
      allTypes[type.uid] = type;
      typeCount++;
      memberCount += type.members.length;
      kindCounts[type.kind] = (kindCounts[type.kind] || 0) + 1;
    }

    for (const ns of namespaces) {
      if (allNamespaces[ns.uid]) {
        // Merge types into existing namespace
        allNamespaces[ns.uid].types.push(...ns.types);
      } else {
        allNamespaces[ns.uid] = ns;
      }
    }
  }

  // Build namespace hierarchy
  const nsUids = Object.keys(allNamespaces).sort();
  for (const uid of nsUids) {
    const parts = uid.split('.');
    if (parts.length > 2) {
      // Find parent namespace
      const parentUid = parts.slice(0, -1).join('.');
      if (allNamespaces[parentUid]) {
        allNamespaces[parentUid].childNamespaces.push(uid);
        allNamespaces[uid].parentNamespace = parentUid;
      }
    }
  }

  // Ensure root namespace exists
  if (!allNamespaces['Sharp.Shared']) {
    allNamespaces['Sharp.Shared'] = {
      uid: 'Sharp.Shared',
      name: 'Shared',
      childNamespaces: [],
      types: [],
    };
  }

  // Ensure output dir
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Write API types
  await writeFile(
    join(OUTPUT_DIR, 'api-types.json'),
    JSON.stringify(allTypes, null, 2),
  );

  // Write API index
  await writeFile(
    join(OUTPUT_DIR, 'api-index.json'),
    JSON.stringify({ namespaces: allNamespaces }, null, 2),
  );

  console.log(`\nParsed ${typeCount} types with ${memberCount} total members`);
  console.log('Type kinds:', kindCounts);
  console.log('Namespaces:', nsUids.length);
  console.log('Output written to:', OUTPUT_DIR);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
