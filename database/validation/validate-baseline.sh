#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-nublox_ci}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_CONTAINER_ID="${MYSQL_CONTAINER_ID:-}"

SCHEMA_FILES=(
  "database/schema/001-platform-kernel.sql"
  "database/schema/002-crm-parties.sql"
  "database/schema/003-sales-quotes.sql"
  "database/schema/004-contracts-finance.sql"
  "database/schema/005-procurement.sql"
  "database/schema/006-workforce-time-scheduling.sql"
  "database/schema/007-project-information-documents.sql"
  "database/schema/007-project-information-integrity.sql"
  "database/schema/008-site-quality-safety.sql"
  "database/schema/008-site-quality-safety-integrity.sql"
  "database/schema/009-commercial-cost-control.sql"
  "database/schema/010-assets-maintenance.sql"
)

cd "$ROOT_DIR"

for schema_file in "${SCHEMA_FILES[@]}"; do
  if [[ ! -f "$schema_file" ]]; then
    echo "ERROR: required schema stage is missing: $schema_file" >&2
    exit 1
  fi
done

mysql_query() {
  local sql="$1"
  local database="${2:-}"

  if [[ -n "$MYSQL_CONTAINER_ID" ]]; then
    local args=(mysql -N -B --show-warnings -u"$MYSQL_USER" -p"$MYSQL_PASSWORD")
    if [[ -n "$database" ]]; then
      args+=("$database")
    fi
    args+=(-e "$sql")
    docker exec "$MYSQL_CONTAINER_ID" "${args[@]}"
  else
    local host="${MYSQL_HOST:-127.0.0.1}"
    local port="${MYSQL_PORT:-3306}"
    local args=(mysql --protocol=tcp -h"$host" -P"$port" -N -B --show-warnings -u"$MYSQL_USER" -p"$MYSQL_PASSWORD")
    if [[ -n "$database" ]]; then
      args+=("$database")
    fi
    args+=(-e "$sql")
    "${args[@]}"
  fi
}

mysql_import() {
  local database="$1"
  local schema_file="$2"

  if [[ -n "$MYSQL_CONTAINER_ID" ]]; then
    docker exec -i "$MYSQL_CONTAINER_ID" \
      mysql --show-warnings -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$database" < "$schema_file"
  else
    local host="${MYSQL_HOST:-127.0.0.1}"
    local port="${MYSQL_PORT:-3306}"
    mysql --protocol=tcp -h"$host" -P"$port" --show-warnings \
      -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$database" < "$schema_file"
  fi
}

wait_for_mysql() {
  echo "Waiting for MySQL..."
  for _ in $(seq 1 60); do
    if [[ -n "$MYSQL_CONTAINER_ID" ]]; then
      if docker exec "$MYSQL_CONTAINER_ID" mysqladmin ping -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --silent >/dev/null 2>&1; then
        return 0
      fi
    else
      local host="${MYSQL_HOST:-127.0.0.1}"
      local port="${MYSQL_PORT:-3306}"
      if mysqladmin --protocol=tcp -h"$host" -P"$port" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" ping --silent >/dev/null 2>&1; then
        return 0
      fi
    fi
    sleep 2
  done

  echo "ERROR: MySQL did not become ready." >&2
  exit 1
}

assert_zero() {
  local label="$1"
  local value="$2"
  if [[ "$value" != "0" ]]; then
    echo "ERROR: $label = $value (expected 0)." >&2
    exit 1
  fi
}

build_and_validate() {
  local database="$1"
  local expected_tables="$2"

  echo
  echo "=== Building $database ==="
  mysql_query "DROP DATABASE IF EXISTS \`$database\`; CREATE DATABASE \`$database\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

  for schema_file in "${SCHEMA_FILES[@]}"; do
    echo "Applying $schema_file"
    mysql_import "$database" "$schema_file"
  done

  local actual_tables
  actual_tables="$(mysql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$database' AND table_type='BASE TABLE';")"
  if [[ "$actual_tables" != "$expected_tables" ]]; then
    echo "ERROR: table-count mismatch for $database: expected $expected_tables, created $actual_tables." >&2
    exit 1
  fi

  local non_innodb
  non_innodb="$(mysql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$database' AND table_type='BASE TABLE' AND engine <> 'InnoDB';")"
  assert_zero "non-InnoDB table count" "$non_innodb"

  local wrong_collation
  wrong_collation="$(mysql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$database' AND table_type='BASE TABLE' AND table_collation <> 'utf8mb4_0900_ai_ci';")"
  assert_zero "unexpected table-collation count" "$wrong_collation"

  local missing_primary_keys
  missing_primary_keys="$(mysql_query "SELECT COUNT(*) FROM information_schema.tables t WHERE t.table_schema='$database' AND t.table_type='BASE TABLE' AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc WHERE tc.constraint_schema=t.table_schema AND tc.table_name=t.table_name AND tc.constraint_type='PRIMARY KEY');")"
  assert_zero "tables without primary keys" "$missing_primary_keys"

  local fk_count
  fk_count="$(mysql_query "SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema='$database';")"

  local check_count
  check_count="$(mysql_query "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema='$database' AND constraint_type='CHECK';")"

  echo "Validated $database: $actual_tables tables, $fk_count foreign keys, $check_count CHECK constraints."
}

wait_for_mysql

server_version="$(mysql_query "SELECT VERSION();")"
echo "MySQL server version: $server_version"
if [[ "$server_version" != 8.4.* ]]; then
  echo "ERROR: baseline validation requires MySQL 8.4.x; found $server_version." >&2
  exit 1
fi

restrict_nonstandard_fk="$(mysql_query "SELECT @@restrict_fk_on_non_standard_key;")"
if [[ "$restrict_nonstandard_fk" != "1" ]]; then
  echo "ERROR: restrict_fk_on_non_standard_key must be enabled during baseline validation." >&2
  exit 1
fi

echo "restrict_fk_on_non_standard_key: ON"

expected_tables="$(grep -hE '^[[:space:]]*CREATE TABLE[[:space:]]+' "${SCHEMA_FILES[@]}" | wc -l | tr -d '[:space:]')"
echo "Expected CREATE TABLE count from schema chain: $expected_tables"

build_and_validate "nublox_validation_a" "$expected_tables"
build_and_validate "nublox_validation_b" "$expected_tables"

echo
echo "NuBlox database baseline validation PASSED on MySQL $server_version."
