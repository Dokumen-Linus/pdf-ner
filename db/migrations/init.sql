-- roless
CREATE ROLE auth_role LOGIN PASSWORD '...';
CREATE ROLE web_user LOGIN PASSWORD '...';
CREATE ROLE web_owner LOGIN PASSWORD '...';
CREATE ROLE api_user LOGIN PASSWORD '...';
CREATE ROLE api_owner LOGIN PASSWORD '...';
CREATE ROLE workers_user LOGIN PASSWORD '...';
CREATE ROLE workers_owner LOGIN PASSWORD '...';

-- schemas
CREATE SCHEMA auth AUTHORIZATION auth_role;
CREATE SCHEMA web AUTHORIZATION web_owner;
CREATE SCHEMA api AUTHORIZATION api_owner;
CREATE SCHEMA workers AUTHORIZATION workers_owner;

-- privileges on schemas
GRANT USAGE ON SCHEMA web TO web_user, api_user, workers_user;
GRANT USAGE ON SCHEMA api TO web_user, api_user, workers_user;
GRANT USAGE ON SCHEMA workers TO web_user, api_user, workers_user;

-- privileges on tables in web, api, and workers schemas
ALTER DEFAULT PRIVILEGES FOR ROLE web_owner IN SCHEMA web
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_user;
ALTER DEFAULT PRIVILEGES FOR ROLE web_owner IN SCHEMA web
    GRANT SELECT ON TABLES TO api_user;
ALTER DEFAULT PRIVILEGES FOR ROLE web_owner IN SCHEMA web
    GRANT SELECT ON TABLES TO workers_user;
ALTER DEFAULT PRIVILEGES FOR ROLE api_owner IN SCHEMA api
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO api_user;
ALTER DEFAULT PRIVILEGES FOR ROLE api_owner IN SCHEMA api
    GRANT SELECT ON TABLES TO web_user;
ALTER DEFAULT PRIVILEGES FOR ROLE api_owner IN SCHEMA api
    GRANT SELECT ON TABLES TO workers_user;
ALTER DEFAULT PRIVILEGES FOR ROLE workers_owner IN SCHEMA workers
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO workers_user;
ALTER DEFAULT PRIVILEGES FOR ROLE workers_owner IN SCHEMA workers
    GRANT SELECT ON TABLES TO web_user;
ALTER DEFAULT PRIVILEGES FOR ROLE workers_owner IN SCHEMA workers
    GRANT SELECT ON TABLES TO api_user;

-- set search path for BetterAuth
ALTER ROLE auth_role SET search_path = auth;