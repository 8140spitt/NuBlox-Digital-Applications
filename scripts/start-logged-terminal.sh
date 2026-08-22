#!/bin/zsh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/app"
LOG_DIR="$REPO_ROOT/.logs"

mkdir -p "$LOG_DIR"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
COMMIT="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || printf 'no-git')"
SESSION_PID="$$"
TTY_PATH="$(tty 2>/dev/null || true)"
if [[ "$TTY_PATH" == /dev/* ]]; then
  TTY_NAME="${TTY_PATH##*/}"
else
  TTY_NAME="no-tty"
fi

LOG_FILE="$LOG_DIR/terminal-${TIMESTAMP}-${TTY_NAME}-${SESSION_PID}-${COMMIT}.log"

printf 'NuBlox terminal logging to: %s\n' "$LOG_FILE"
printf 'Terminal session: %s · PID %s · Git %s\n' "$TTY_NAME" "$SESSION_PID" "$COMMIT"
printf 'Working directory: %s\n' "$APP_DIR"
printf 'Type exit when you want to close this logged terminal session.\n\n'

cd "$APP_DIR"
exec /usr/bin/script -F "$LOG_FILE" /bin/zsh -l
