#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEN="$ROOT/data/generated"
HASH_FILE="$ROOT/.data-build-hash"

NEW_HASH=$(find "$GEN" -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')
echo "$NEW_HASH" > "$HASH_FILE"
echo "Updated .data-build-hash: $NEW_HASH"
