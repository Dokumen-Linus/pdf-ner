FROM postgres:18

# Install dbmate v2.24.2 for running migrations during init
ARG DBMATE_VERSION=2.24.2
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && \
    curl -fsSL -o /usr/local/bin/dbmate \
      "https://github.com/amacneil/dbmate/releases/download/v${DBMATE_VERSION}/dbmate-linux-amd64" && \
    chmod +x /usr/local/bin/dbmate && \
    apt-get purge -y --auto-remove curl && \
    rm -rf /var/lib/apt/lists/*

# Init scripts run in alphabetical order on first startup
COPY deploy-local/ /docker-entrypoint-initdb.d/

# Migrations copied into image so 02_migrate.sh can access them
COPY migrations/ /migrations/

# Seed data copied into image so 02_migrate.sh can seed after migration
COPY seeds/ /seeds/
