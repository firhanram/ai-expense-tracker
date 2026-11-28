#!/usr/bin/env bash
# Publishes screenshots to the orphan `pr-assets` branch and prints Markdown
# image links for a PR body. Touches no working tree, index or local branch:
# the commit is built with plumbing and pushed straight to the remote.
#
#   scripts/pr-screenshots.sh <folder> <image>...
#   scripts/pr-screenshots.sh feat-field-chips before.png after.png
#
# Links are pinned to the commit SHA, so they keep rendering after the feature
# branch is merged and deleted. PR_ASSETS_NO_PUSH=1 builds the commit without
# pushing (for trying it out).
set -euo pipefail

REMOTE="git@github.com-firhanram:firhanram/ai-expense-tracker.git"
REPO="firhanram/ai-expense-tracker"
BRANCH="pr-assets"

if [ $# -lt 2 ]; then
  echo "usage: $0 <folder> <image>..." >&2
  exit 64
fi

folder="$(printf '%s' "$1" | tr -c 'A-Za-z0-9._/-' '-')"
shift
for file in "$@"; do
  [ -f "$file" ] || { echo "not a file: $file" >&2; exit 66; }
done

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
export GIT_INDEX_FILE="$tmp/index"

for attempt in 1 2 3; do
  rm -f "$GIT_INDEX_FILE"
  parent=""
  if git fetch -q "$REMOTE" "refs/heads/$BRANCH" 2>/dev/null; then
    parent="$(git rev-parse FETCH_HEAD)"
    git read-tree "$parent"
  else
    git read-tree --empty
  fi

  paths=()
  for file in "$@"; do
    name="$(printf '%s' "$(basename "$file")" | tr -c 'A-Za-z0-9._-' '-')"
    path="$folder/$name"
    blob="$(git hash-object -w -- "$file")"
    git update-index --add --cacheinfo "100644,$blob,$path"
    paths+=("$path")
  done

  tree="$(git write-tree)"
  commit="$(git commit-tree "$tree" ${parent:+-p "$parent"} -m "assets: $folder")"

  if [ "${PR_ASSETS_NO_PUSH:-}" = "1" ]; then
    echo "(not pushed) commit $commit" >&2
    break
  fi
  if git push -q "$REMOTE" "$commit:refs/heads/$BRANCH"; then
    break
  fi
  [ "$attempt" = 3 ] && { echo "push to $BRANCH failed" >&2; exit 1; }
  echo "push rejected, retrying on the new tip" >&2
done

for path in "${paths[@]}"; do
  alt="$(basename "$path")"
  echo "![${alt%.*}](https://github.com/$REPO/blob/$commit/$path?raw=true)"
done
