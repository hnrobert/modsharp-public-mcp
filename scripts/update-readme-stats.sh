#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-}"
LABEL="${TAG:-$(date -u +%Y-%m-%d)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEN="$ROOT/data/generated"

# ── Extract counts from generated JSON using python3 ──

read -r -d '' EXTRACT << 'PYEOF' || true
import json, sys, os

gen = os.environ["GEN"]

def load(name):
    with open(os.path.join(gen, name)) as f:
        return json.load(f)

api = load("api-types.json")
schemas = load("schemas.json")
entities = load("entities.json")
docs_en = load("docs-en.json")
docs_cn = load("docs-cn.json")
examples = load("examples.json")
si = load("search-index.json")

members = sum(len(t["members"]) for t in api.values())
cats = len({s["category"] for s in schemas.values()})
net_fields = sum(len(s.get("networkVars", [])) for s in schemas.values())
tokens = len(si.get("tokens", si))

entity_props = sum(len(e.get("properties", [])) for e in entities.values())
entity_inputs = sum(len(e.get("inputs", [])) for e in entities.values())
entity_outputs = sum(len(e.get("outputs", [])) for e in entities.values())

print(f"API_TYPES={len(api)}")
print(f"MEMBERS={members}")
print(f"SCHEMA_CLASSES={len(schemas)}")
print(f"SCHEMA_CATS={cats}")
print(f"NET_FIELDS={net_fields}")
print(f"ENTITY_COUNT={len(entities)}")
print(f"ENTITY_PROPS={entity_props}")
print(f"ENTITY_INPUTS={entity_inputs}")
print(f"ENTITY_OUTPUTS={entity_outputs}")
print(f"DOCS_EN={len(docs_en)}")
print(f"DOCS_CN={len(docs_cn)}")
print(f"EXAMPLES={len(examples)}")
print(f"TOKENS={tokens}")
PYEOF

eval "$(GEN="$GEN" python3 -c "$EXTRACT")"

# ── Build stats section ──

stats="## Data Stats (as of $LABEL)

- **$API_TYPES** ModSharp API types with **$(printf "%'d" "$MEMBERS")** members
- **$SCHEMA_CLASSES** CS2/Source2 engine schema classes across **$SCHEMA_CATS** categories with **$(printf "%'d" "$NET_FIELDS")** network fields
- **$ENTITY_COUNT** CS2 Hammer entity definitions with **$(printf "%'d" "$ENTITY_PROPS")** properties, **$(printf "%'d" "$ENTITY_INPUTS")** inputs, **$(printf "%'d" "$ENTITY_OUTPUTS")** outputs
- **$DOCS_EN** English + **$DOCS_CN** Chinese documentation articles
- **$EXAMPLES** code examples
- **$(printf "%'d" "$TOKENS")** search index tokens
"

# ── Replace in README ──

readme_path="$ROOT/README.md"

read -r -d '' REPLACE << 'PYEOF' || true
import re, sys

stats = sys.stdin.read()
with open(sys.argv[1], "r") as f:
    content = f.read()

updated = re.sub(
    r"## Data Stats \(as of [^)]+\)\n\n(?:- .+\n)*",
    stats,
    content,
)
if updated == content:
    print("ERROR: Data Stats section not found in README.md", file=sys.stderr)
    sys.exit(1)

with open(sys.argv[1], "w") as f:
    f.write(updated)
PYEOF

echo -n "$stats" | python3 -c "$REPLACE" "$readme_path"

echo "Updated README.md with stats for $TAG"
echo "  $API_TYPES types, $MEMBERS members, $SCHEMA_CLASSES schemas ($SCHEMA_CATS categories), $NET_FIELDS network fields"
echo "  $ENTITY_COUNT entities ($ENTITY_PROPS props, $ENTITY_INPUTS inputs, $ENTITY_OUTPUTS outputs)"
echo "  $DOCS_EN EN + $DOCS_CN CN docs, $EXAMPLES examples, $TOKENS tokens"
