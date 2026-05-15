#!/usr/bin/env bash
# POSTGRES_USER and POSTGRES_DB should be passed as args or env vars from your PostgreSQL service
set -euo pipefail

: "${OWNER_ROLE_PASSWORD:?OWNER_ROLE_PASSWORD is required}"
: "${AUTH_ROLE_PASSWORD:?AUTH_ROLE_PASSWORD is required}"
: "${WEB_USER_PASSWORD:?WEB_USER_PASSWORD is required}"
: "${API_USER_PASSWORD:?API_USER_PASSWORD is required}"
: "${WORKERS_USER_PASSWORD:?WORKERS_USER_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname "${POSTGRES_DB:-dokumen}" <<-EOSQL
    -- roles
    CREATE ROLE owner_role LOGIN PASSWORD '${OWNER_ROLE_PASSWORD}';
    CREATE ROLE auth_role LOGIN PASSWORD '${AUTH_ROLE_PASSWORD}';
    CREATE ROLE web_user LOGIN PASSWORD '${WEB_USER_PASSWORD}';
    CREATE ROLE api_user LOGIN PASSWORD '${API_USER_PASSWORD}';
    CREATE ROLE workers_user LOGIN PASSWORD '${WORKERS_USER_PASSWORD}';

    -- allow the deploy connection to create schemas owned by these roles
    GRANT owner_role TO CURRENT_USER;
    GRANT auth_role TO CURRENT_USER;

    -- schemas
    CREATE SCHEMA auth AUTHORIZATION auth_role;
    CREATE SCHEMA core AUTHORIZATION owner_role;
    CREATE SCHEMA web AUTHORIZATION owner_role;
    CREATE SCHEMA api AUTHORIZATION owner_role;
    CREATE SCHEMA workers AUTHORIZATION owner_role;

    -- privileges on schemas
    GRANT USAGE, CREATE ON SCHEMA public TO owner_role;
    GRANT USAGE ON SCHEMA auth TO owner_role;
    GRANT USAGE ON SCHEMA auth TO web_user;
    GRANT USAGE ON SCHEMA core TO web_user, api_user, workers_user;
    GRANT USAGE ON SCHEMA public TO web_user, api_user, workers_user;
    GRANT USAGE ON SCHEMA web TO web_user, api_user, workers_user;
    GRANT USAGE ON SCHEMA api TO web_user, api_user, workers_user;
    GRANT USAGE ON SCHEMA workers TO web_user, api_user, workers_user;

    -- privileges on tables in web, api, and workers schemas
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA public
        GRANT SELECT ON TABLES TO web_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA public
        GRANT SELECT ON TABLES TO api_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA public
        GRANT SELECT ON TABLES TO workers_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA core
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA core
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO api_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA core
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO workers_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA web
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA web
        GRANT SELECT ON TABLES TO api_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA web
        GRANT SELECT ON TABLES TO workers_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA api
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO api_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA api
        GRANT SELECT ON TABLES TO web_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA api
        GRANT SELECT ON TABLES TO workers_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA workers
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO workers_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA workers
        GRANT SELECT ON TABLES TO web_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE owner_role IN SCHEMA workers
        GRANT SELECT ON TABLES TO api_user;

    -- set search path for BetterAuth
    ALTER ROLE auth_role SET search_path = auth;
EOSQL
