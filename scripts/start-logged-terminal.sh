#!/bin/zsh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/.logs"

SCRIPT_BIN="/usr/bin/script"
SHELL_BIN="/bin/zsh"

if [[ -n "${NUBLOX_APP_DIR:-}" ]]; then
  if [[ "$NUBLOX_APP_DIR" = /* ]]; then
    APP_DIR="$NUBLOX_APP_DIR"
  else
    APP_DIR="$REPO_ROOT/$NUBLOX_APP_DIR"
  fi
elif [[ -d "$REPO_ROOT/appv2" ]]; then
  APP_DIR="$REPO_ROOT/appv2"
elif [[ -d "$REPO_ROOT/appv1" ]]; then
  APP_DIR="$REPO_ROOT/appv1"
elif [[ -d "$REPO_ROOT/app" ]]; then
  APP_DIR="$REPO_ROOT/app"
else
  printf 'No NuBlox app directory found under: %s\n' "$REPO_ROOT" >&2
  printf 'Expected one of: appv2, appv1, app\n' >&2
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  printf 'NuBlox application directory not found: %s\n' "$APP_DIR" >&2
  exit 1
fi

if [[ ! -x "$SCRIPT_BIN" ]]; then
  printf 'Required binary not found or not executable: %s\n' "$SCRIPT_BIN" >&2
  exit 1
fi

if [[ ! -x "$SHELL_BIN" ]]; then
  printf 'Required shell not found or not executable: %s\n' "$SHELL_BIN" >&2
  exit 1
fi

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

# mktemp guarantees a unique log file per terminal launch, even if metadata repeats.
# On macOS, the template must end with XXXXXX.
LOG_FILE="$(mktemp "$LOG_DIR/terminal-${TIMESTAMP}-${TTY_NAME}-${SESSION_PID}-${COMMIT}-XXXXXX")"

printf 'NuBlox terminal logging to: %s\n' "$LOG_FILE"
printf 'Terminal session: %s | PID %s | Git %s\n' "$TTY_NAME" "$SESSION_PID" "$COMMIT"
printf 'Working directory: %s\n' "$APP_DIR"
printf 'Type exit when you want to close this logged terminal session.\n\n'

cd "$APP_DIR"
exec "$SCRIPT_BIN" "$LOG_FILE" "$SHELL_BIN" -l
