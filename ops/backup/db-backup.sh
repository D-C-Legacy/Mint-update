#!/bin/sh
# Phase 4b (engineering backlog): scheduled pg_dump-to-S3 with a drillable restore, for the
# single-EC2 Docker Compose deployment. Runs as the `db-backup` service in
# docker-compose.prod.yml, next to the postgres container it dumps.
#
# Modes (first argument, or BACKUP_MODE):
#   run            one dump + integrity check + S3 upload (cron calls this; compose `run` too)
#   daemon         install BACKUP_CRON (busybox crond) and keep watching — the compose default
#   restore S3KEY  drill: download a dump, pg_restore it into a throwaway scratch database,
#                  print an exact per-table row-count comparison against the live database
#   drop-scratch   delete a scratch database made by `restore` (name must start restore_drill_)
#
# Env: DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME (set by compose), BACKUP_S3_BUCKET (required
# for run), BACKUP_S3_PREFIX (default db-backups), BACKUP_CRON (default 0 3 * * *), AWS creds
# from the repo .env, optional S3_ENDPOINT (local MinIO drills; also triggers auto-create-bucket).
set -eu

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-live_auction}"
export PGPASSWORD="${DB_PASSWORD:-}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-db-backups}"
BACKUP_CRON="${BACKUP_CRON:-0 3 * * *}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${AWS_REGION:-us-east-1}}"
# env-provided creds only: never fall back to instance/bootstrap metadata that would pretend
# a real upload happened somewhere else.
export AWS_EC2_METADATA_DISABLED=true

S3_ARGS=""
if [ -n "${S3_ENDPOINT:-}" ]; then
  S3_ARGS="--endpoint-url $S3_ENDPOINT"
fi

die() {
  echo "db-backup: ERROR: $*" >&2
  exit 1
}

wait_for_db() {
  i=0
  until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -t 5; do
    i=$((i + 1))
    [ "$i" -ge 24 ] && die "postgres at $DB_HOST:$DB_PORT not ready after 2 minutes"
    sleep 5
  done
}

# run --------------------------------------------------------------------------------------------
do_run() {
  [ -n "${BACKUP_S3_BUCKET:-}" ] || die "BACKUP_S3_BUCKET is not set; refusing to run without a target"

  wait_for_db
  local stamp dumpfile key
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  dumpfile="/tmp/${DB_NAME}-${stamp}.dump"

  # Overlap guard: a slow upload must never collide with the next tick.
  mkdir /tmp/backup.lock 2>/dev/null || die "another backup is already running"
  trap 'rm -rf /tmp/backup.lock' EXIT

  echo "db-backup: dumping $DB_NAME@$DB_HOST:$DB_PORT (custom format)"
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -Fc --no-owner --no-privileges -f "$dumpfile" "$DB_NAME"
  # Self-check before upload: unreadable/corrupt dumps must never reach S3.
  pg_restore --list "$dumpfile" > /dev/null

  echo "db-backup: uploading to s3://$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/$(basename "$dumpfile")"
  # MinIO-style dev endpoints get their bucket created on the fly; on real AWS the bucket must
  # already exist (and be private), so auto-creating is deliberately excluded there.
  if [ -n "${S3_ENDPOINT:-}" ]; then
    aws $S3_ARGS --region "$AWS_DEFAULT_REGION" s3 mb "s3://$BACKUP_S3_BUCKET" >/dev/null 2>&1 || true
  fi
  aws $S3_ARGS --region "$AWS_DEFAULT_REGION" s3 cp "$dumpfile" "s3://$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/$(basename "$dumpfile")"
  # A stable pointer to the newest good dump, server-side copy so the bytes upload once.
  aws $S3_ARGS --region "$AWS_DEFAULT_REGION" s3api copy-object \
    --copy-source "$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/$(basename "$dumpfile")" \
    --bucket "$BACKUP_S3_BUCKET" --key "$BACKUP_S3_PREFIX/latest.dump" > /dev/null

  rm -f "$dumpfile"
  echo "db-backup: DONE -> s3://$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/latest.dump"
}

# daemon -------------------------------------------------------------------------------------------
do_daemon() {
  echo "db-backup: installing cron '$BACKUP_CRON' (UTC) and starting crond"
  echo "$BACKUP_CRON /usr/local/bin/db-backup run >> /var/log/db-backup.log 2>&1" > /etc/crontabs/root
  crond -f -d 8
}

# restore -------------------------------------------------------------------------------------------
do_restore() {
  key="${1:-}"
  [ -n "$key" ] || die "usage: db-backup restore s3://<bucket>/<prefix>/<file>.dump"
  wait_for_db

  local scratch downloaded
  scratch="restore_drill_$(date -u +%Y%m%dT%H%M%S)"
  downloaded="/tmp/restore_drill.dump"
  echo "db-backup: downloading $key -> $downloaded"
  aws $S3_ARGS --region "$AWS_DEFAULT_REGION" s3 cp "$key" "$downloaded"

  echo "db-backup: restoring into throwaway database $scratch (live DB untouched)"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$scratch\""
  # A failed restore must never leave a half-restored database looking like a success.
  if ! pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --no-owner --no-privileges \
       -d "$scratch" "$downloaded"; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$scratch\""
    die "pg_restore failed; scratch database dropped"
  fi

  echo "db-backup: comparing per-table row counts (live $DB_NAME vs restored $scratch)"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -A -t -F '|' \
    -c "SELECT schemaname, relname FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname" |
  while IFS='|' read -r schema table; do
    [ -n "${table:-}" ] || continue
    live_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -A -t \
      -c "SELECT count(*) FROM \"$table\"")
    drill_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$scratch" -A -t \
      -c "SELECT count(*) FROM \"$table\"")
    echo "DRILL-RESULT table=$table live=$live_count restored=$drill_count"
  done
  echo "db-backup: compare table-by-table above"
  echo "db-backup: scratch database kept: $scratch (drop it with: db-backup drop-scratch $scratch)"
}

# drop-scratch ------------------------------------------------------------------------------------
do_drop_scratch() {
  scratch="${1:-}"
  case "$scratch" in
    restore_drill_*) ;;
    *) die "refusing to drop non-scratch database: '$scratch' (must start with restore_drill_)" ;;
  esac
  wait_for_db
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$scratch\""
  echo "db-backup: dropped $scratch"
}

cd /tmp
MODE="${1:-${BACKUP_MODE:-daemon}}"
case "$MODE" in
  run) do_run ;;
  daemon) do_daemon ;;
  restore) shift; do_restore "${1:-}" ;;
  drop-scratch) shift; do_drop_scratch "${1:-}" ;;
  *) die "unknown mode '$MODE' (run | daemon | restore | drop-scratch)" ;;
esac
