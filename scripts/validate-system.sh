#!/bin/zsh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/app"

cd "$APP_DIR"

CURRENT_STEP="initialisation"

run_step() {
  CURRENT_STEP="$1"
  shift
  printf '\n==> %s\n' "$CURRENT_STEP"
  "$@"
}

finish() {
  local exit_code=$?
  if (( exit_code == 0 )); then
    printf '\n✓ NuBlox validation completed successfully.\n'
  else
    printf '\n✗ NuBlox validation stopped at: %s\n' "$CURRENT_STEP" >&2
    printf '  Exit code: %d\n' "$exit_code" >&2
    printf '  The VS Code terminal remains open because validation runs in its own process.\n' >&2
  fi
}
trap finish EXIT

run_step "Install dependencies" pnpm install
run_step "Apply database migrations" pnpm db:migrate
run_step "Check migration status" pnpm db:status
run_step "Regenerate Kysely database types" pnpm db:types
run_step "Run formatting and lint checks" pnpm lint
run_step "Run real-MySQL integration suite" pnpm test:integration
run_step "Type-check SvelteKit application" pnpm check
run_step "Install Playwright Chromium" pnpm exec playwright install chromium
run_step "Run unit and component tests" pnpm test:unit
run_step "Build production application" pnpm build
run_step "Run Playwright browser E2E suite" pnpm exec playwright test
