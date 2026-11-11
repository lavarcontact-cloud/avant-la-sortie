#!/usr/bin/env bash
# Applique les migrations sur une base PostgreSQL jetable puis lance les tests.
# Usage : PGURL=postgres://user@host/db ./run.sh   (la base est recréée)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
admin="${PGADMINURL:-postgres:///postgres}"
db="promoter_os_test"

psql "$admin" -qc "drop database if exists $db" -c "create database $db"
url="${admin%/*}/$db"
for f in "$here"/../migrations/*.sql; do
  psql "$url" -q -v ON_ERROR_STOP=1 -f "$f"
done
psql "$url" -q -v ON_ERROR_STOP=1 -f "$here/rules_test.sql"
