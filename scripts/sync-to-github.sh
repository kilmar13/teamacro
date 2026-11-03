#!/usr/bin/env bash
# ==============================================================================
# TEAMACRO SERVICES LTD — GITHUB & VERCEL DEPLOYMENT PIPELINE SYNC SCRIPT
# ==============================================================================
# Usage:
#   ./scripts/sync-to-github.sh [REPO_NAME_OR_FULL_URL]
#
# Examples:
#   ./scripts/sync-to-github.sh teamacro-ltd
#   ./scripts/sync-to-github.sh https://github.com/erosedigitaltech-bit/teamacro-ltd.git
# ==============================================================================

set -euo pipefail

GITHUB_ACCOUNT="erosedigitaltech-bit"
INPUT_ARG="${1:-teamacro-ltd}"

if [[ "$INPUT_ARG" == http* ]] || [[ "$INPUT_ARG" == git@* ]]; then
  REPO_URL="$INPUT_ARG"
else
  REPO_URL="https://github.com/${GITHUB_ACCOUNT}/${INPUT_ARG}.git"
fi

echo "[1/5] Checking git repository state (GitHub account: ${GITHUB_ACCOUNT})..."
if [ ! -d ".git" ]; then
  git init -b main
fi
git config user.name "erosedigitaltech-bit"
git config user.email "eromoseledavidson68@gmail.com"

echo "[2/5] Staging and committing latest modifications..."
git add -A
if git diff --cached --quiet; then
  echo "No new staged changes; verifying existing HEAD commit..."
else
  git commit -m "fix: restore TEAMACRO server stability, real-time customer sync, and Vercel deployment"
fi

LOCAL_SHA=$(git rev-parse HEAD)
echo "Local HEAD commit: $LOCAL_SHA"

echo "[3/5] Configuring remote 'origin' -> $REPO_URL..."
if git remote | grep -q "^origin$"; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

echo "[4/5] Pushing to remote production branch 'main'..."
git push -u origin main

echo "[5/5] Verifying remote 'origin/main' matches local HEAD ($LOCAL_SHA)..."
REMOTE_SHA=$(git ls-remote origin refs/heads/main | awk '{print $1}')
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
  echo "ERROR: Remote SHA ($REMOTE_SHA) does not match local HEAD ($LOCAL_SHA)!"
  exit 1
fi

echo "=============================================================================="
echo "VERIFIED: Commit $LOCAL_SHA is live on GitHub (origin/main)."
echo "=============================================================================="
