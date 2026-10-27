# ------------------------------------------------------------------------------
# CardSplit - DATABASE service
# Official PostgreSQL image + our schema. Any *.sql file placed in
# /docker-entrypoint-initdb.d is executed automatically on first start.
# ------------------------------------------------------------------------------
FROM postgres:16-alpine

LABEL org.opencontainers.image.title="cardsplit-database" \
      org.opencontainers.image.description="PostgreSQL 16 with the CardSplit schema"

COPY init/ /docker-entrypoint-initdb.d/

EXPOSE 5432

# POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD are supplied at runtime
# (docker-compose.yml or `docker run -e ...`).
HEALTHCHECK --interval=10s --timeout=5s --retries=10 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1
