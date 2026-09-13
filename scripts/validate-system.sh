#!/bin/zsh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
V1_APP_DIR="$REPO_ROOT/appv1"
V2_APP_DIR="$REPO_ROOT/appv2"

for required_dir in "$V1_APP_DIR" "$V2_APP_DIR"; do
  if [[ ! -d "$required_dir" ]]; then
    printf 'Required NuBlox application directory not found: %s\n' "$required_dir" >&2
    exit 1
  fi
done

CURRENT_STEP="initialisation"

run_step() {
  local label="$1"
  local working_dir="$2"
  shift 2
  CURRENT_STEP="$label"
  printf '\n==> %s\n' "$CURRENT_STEP"
  (
    cd "$working_dir"
    "$@"
  )
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

run_step "Install V1 dependencies" "$V1_APP_DIR" corepack pnpm install --frozen-lockfile
run_step "Apply database migrations" "$V1_APP_DIR" corepack pnpm db:migrate
run_step "Check migration status" "$V1_APP_DIR" corepack pnpm db:status
run_step "Regenerate V1 Kysely database types" "$V1_APP_DIR" corepack pnpm db:types
run_step "Lint V1 implementation evidence" "$V1_APP_DIR" corepack pnpm lint
run_step "Run V1 real-MySQL integration suite" "$V1_APP_DIR" corepack pnpm test:integration
run_step "Type-check V1 implementation evidence" "$V1_APP_DIR" corepack pnpm check

run_step "Install V2 dependencies" "$V2_APP_DIR" corepack pnpm install --frozen-lockfile
run_step "Lint V2 application" "$V2_APP_DIR" corepack pnpm lint
run_step "Type-check V2 application" "$V2_APP_DIR" corepack pnpm check
run_step "Run V2 unit and browser tests" "$V2_APP_DIR" corepack pnpm test:unit
run_step "Build V2 production application" "$V2_APP_DIR" corepack pnpm build
run_step "Run V2 browser E2E suite" "$V2_APP_DIR" corepack pnpm test:e2e
