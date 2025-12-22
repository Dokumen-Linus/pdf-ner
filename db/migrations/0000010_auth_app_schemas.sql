-- migrate:up
CREATE ROLE auth_role LOGIN PASSWORD '...';
CREATE ROLE app_user LOGIN PASSWORD '...';
CREATE ROLE app_owner LOGIN PASSWORD '...';

CREATE SCHEMA auth AUTHORIZATION auth_role;
CREATE SCHEMA app AUTHORIZATION app_owner;

GRANT USAGE ON SCHEMA app TO app_user;

GRANT ALL PRIVILEGES ON SCHEMA auth TO auth_role;

-- migrate:down
DROP SCHEMA app CASCADE;
DROP SCHEMA auth CASCADE;
DROP ROLE app_user;
DROP ROLE app_owner;
DROP ROLE auth_role;

