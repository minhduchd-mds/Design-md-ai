#!/bin/sh
# Validate conventional commit format
MSG=$(head -1 "$1")
if echo "$MSG" | grep -qE '^(feat|fix|docs|refactor|test|chore|ci|perf|style|build)'; then
  exit 0
else
  echo "ERROR: Commit message must start with a conventional type (feat|fix|docs|...)"
  echo "Got: $MSG"
  exit 1
fi
