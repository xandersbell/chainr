#!/usr/bin/env bash
# Pre-commit hook: run biome lint --fix on staged files (safe fixes only)

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js|json)$')

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

echo "Running biome lint --fix on staged files..."
npx biome lint --fix --no-errors-on-unmatched $STAGED_FILES

# Re-stage fixed files
echo "$STAGED_FILES" | xargs git add

exit 0
