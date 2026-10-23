# Local development database for docker compose. Stays on major 15 so an
# existing db_data volume keeps working (a new major cannot open an old data
# directory). The digest pins the exact image; Dependabot proposes 15.x
# minor and patch updates and is configured to skip new majors.
FROM postgres:15.19-alpine3.24@sha256:a8e042598834300dfaa17a54f695b87b7f25d3490433bbbe2ef3bffbb9747f24
COPY init.sql /docker-entrypoint-initdb.d/
# The official entrypoint starts as root only to fix data-directory ownership
# and then drops to the postgres user (uid 70) before starting the server.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD pg_isready -h 127.0.0.1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" || exit 1
