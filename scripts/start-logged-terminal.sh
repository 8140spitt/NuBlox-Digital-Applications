#!/bin/zsh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/app"
LOG_DIR="$REPO_ROOT/.logs"

mkdir -p "$LOG_DIR"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
COMMIT="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || printf 'no-git')"
LOG_FILE="$LOG_DIR/terminal-${TIMESTAMP}-${COMMIT}.log"

printf 'NuBlox terminal logging to: %s\n' "$LOG_FILE"
printf 'Working directory: %s\n' "$APP_DIR"
printf 'Type exit when you want to close this logged terminal session.\n\n'

cd "$APP_DIR"
exec /usr/bin/script -F "$LOG_FILE" /bin/zsh -l
