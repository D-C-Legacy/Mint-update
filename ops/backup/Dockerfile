# Phase 4b (engineering backlog): the backup runner image. postgres:16-alpine ships pg_dump /
# pg_restore / psql matching the prod postgres:16 server exactly, and aws-cli comes from the
# Alpine community repo, so one tiny image can dump, upload to S3, and drill restores.
FROM postgres:16-alpine
RUN apk add --no-cache aws-cli
COPY ops/backup/db-backup.sh /usr/local/bin/db-backup
RUN chmod +x /usr/local/bin/db-backup
ENTRYPOINT ["db-backup"]
