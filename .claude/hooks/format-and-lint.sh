#!/usr/bin/env bash
# PostToolUse hook: format the touched file with Prettier and lint it with ESLint.
set -uo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
file="$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')"

[[ -n "$file" && -f "$file" ]] || exit 0
# realpath normalizes symlinks and letter case (macOS), so ESLint sees the
# file inside its base path instead of silently ignoring it.
root="$(realpath "$project_dir")" || exit 0
file="$(realpath "$file")" || exit 0
case "$file" in
  "$root"/*) file="${file#"$root"/}" ;;
  *) exit 0 ;;
esac

cd "$root" || exit 0

if ! out="$(npx --no-install prettier --write --ignore-unknown --log-level warn "$file" 2>&1)"; then
  echo "Prettier falló en $file:" >&2
  echo "$out" >&2
  exit 2
fi

case "$file" in
  *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs)
    if ! out="$(npx --no-install eslint --fix --no-warn-ignored "$file" 2>&1)"; then
      echo "ESLint encontró problemas en $file:" >&2
      echo "$out" >&2
      exit 2
    fi
    ;;
esac

exit 0
