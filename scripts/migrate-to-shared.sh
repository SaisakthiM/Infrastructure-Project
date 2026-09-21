#!/usr/bin/env bash
# Copies data from the OLD per-app Postgres/MySQL/MinIO containers into the
# shared-* ones. Read-only on the old side; safe to re-run.
#
# Run AFTER the shared instances + init containers exist (step 1) and BEFORE
# the full prod-docker apply that removes the old containers (step 2).
#
# Export the same values you have in your tfvars first, e.g.:
#   set -a; source ./migrate.env; set +a; ./migrate-to-shared.sh
set -euo pipefail

need() { for v in "$@"; do [ -n "${!v:-}" ] || { echo "missing env var: $v" >&2; exit 1; }; done; }
need NOTES_DB_NAME NOTES_DB_USER BANK_DB_NAME BANK_DB_USER \
     WHISPER_DB_USER WHISPER_DB_DATABASE \
     BLOG_DB_NAME BLOG_DB_PASSWORD DOC_DB_NAME DOC_DB_PASSWORD SHARED_MYSQL_ROOT_PASSWORD \
     BLOG_MINIO_USER BLOG_MINIO_PASSWORD DOC_MINIO_USER DOC_MINIO_PASSWORD \
     WHISPER_MINIO_USER WHISPER_MINIO_PASSWORD \
     SHARED_MINIO_ROOT_USER SHARED_MINIO_ROOT_PASSWORD
# Only set these if you had to RENAME a user in tfvars (e.g. whisper used "postgres"):
#   NOTES_OLD_DB_USER / BANK_OLD_DB_USER / WHISPER_OLD_DB_USER

for c in shared-postgres shared-mysql shared-minio; do
  [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" = "true" ] || { echo "$c is not running -- run step 1 first" >&2; exit 1; }
done

# pg_copy <old_container> <old_user> <old_db> <new_user> <new_db>
# Restores as the app user (local socket = trust), so the app owns everything.
pg_copy() {
  echo "==> postgres: $1/$3 -> shared-postgres/$5"
  docker exec "$1" pg_dump -U "$2" -Fc "$3" \
    | docker exec -i shared-postgres pg_restore -U "$4" -d "$5" --no-owner --no-acl --clean --if-exists
}

# mysql_copy <old_container> <old_root_password> <db>
mysql_copy() {
  echo "==> mysql: $1/$3 -> shared-mysql/$3"
  docker exec -e MYSQL_PWD="$2" "$1" \
    mysqldump -uroot --single-transaction --routines --triggers --events --no-tablespaces "$3" \
    | docker exec -i -e MYSQL_PWD="$SHARED_MYSQL_ROOT_PASSWORD" shared-mysql mysql -uroot "$3"
}

# minio_copy <old_host> <old_user> <old_password>   (mirrors every bucket it finds)
minio_copy() {
  echo "==> minio: $1 -> shared-minio"
  docker run --rm --network gateway-net \
    -e OH="$1" -e OU="$2" -e OP="$3" \
    -e NU="$SHARED_MINIO_ROOT_USER" -e NP="$SHARED_MINIO_ROOT_PASSWORD" \
    --entrypoint /bin/sh quay.io/minio/mc:latest -c '
      set -eu
      mc alias set old "http://$OH:9000" "$OU" "$OP" >/dev/null
      mc alias set new http://shared-minio:9000 "$NU" "$NP" >/dev/null
      for b in $(mc ls old | awk "{print \$NF}" | tr -d /); do
        echo "  bucket: $b"
        mc mb --ignore-existing "new/$b"
        mc mirror --preserve --overwrite "old/$b" "new/$b"
      done
      echo "  (buckets NOT listed in *_minio_buckets in tfvars are copied but the app user cannot access them)"
    '
}

pg_copy notes-postgres          "${NOTES_OLD_DB_USER:-$NOTES_DB_USER}"     "$NOTES_DB_NAME"      "$NOTES_DB_USER"   "$NOTES_DB_NAME"
pg_copy bank-postgres           "${BANK_OLD_DB_USER:-$BANK_DB_USER}"       "$BANK_DB_NAME"       "$BANK_DB_USER"    "$BANK_DB_NAME"
pg_copy gateway_whisper-pgdata  "${WHISPER_OLD_DB_USER:-$WHISPER_DB_USER}" "$WHISPER_DB_DATABASE" "$WHISPER_DB_USER" "$WHISPER_DB_DATABASE"

mysql_copy blog-db   "$BLOG_DB_PASSWORD" "$BLOG_DB_NAME"
mysql_copy doc-mysql "$DOC_DB_PASSWORD"  "$DOC_DB_NAME"

minio_copy blog-minio    "$BLOG_MINIO_USER"    "$BLOG_MINIO_PASSWORD"
minio_copy doc-minio     "$DOC_MINIO_USER"     "$DOC_MINIO_PASSWORD"
minio_copy whisper-minio "$WHISPER_MINIO_USER" "$WHISPER_MINIO_PASSWORD"   # must be on gateway-net (it is, via the old connect hack)

echo
echo "Done. Spot-check before step 2, e.g.:"
echo "  docker exec shared-postgres psql -U $NOTES_DB_USER -d $NOTES_DB_NAME -c '\\dt'"
echo "  docker exec -e MYSQL_PWD=\$SHARED_MYSQL_ROOT_PASSWORD shared-mysql mysql -uroot -e 'SHOW TABLES' $BLOG_DB_NAME"
