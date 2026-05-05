-- roles
CREATE ROLE owner_role LOGIN PASSWORD '...';
CREATE ROLE auth_role LOGIN PASSWORD '...';
CREATE ROLE web_user LOGIN PASSWORD '...';
CREATE ROLE api_user LOGIN PASSWORD '...';
CREATE ROLE workers_user LOGIN PASSWORD '...';

-- schemas
CREATE SCHEMA auth AUTHORIZATION auth_role;
CREATE SCHEMA web AUTHORIZATION owner_role;
CREATE SCHEMA api AUTHORIZATION owner_role;
CREATE SCHEMA workers AUTHORIZATION owner_role;

-- privileges on schemas
GRANT USAGE, CREATE ON SCHEMA public TO owner_role;
GRANT USAGE ON SCHEMA auth TO owner_role;
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
