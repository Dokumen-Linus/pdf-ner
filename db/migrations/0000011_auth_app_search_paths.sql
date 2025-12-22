-- migrate:up
ALTER ROLE app_user SET search_path = app;
ALTER ROLE auth_role SET search_path = auth;

-- migrate:down
ALTER ROLE app_user SET search_path = public;
ALTER ROLE auth_role SET search_path = public;

