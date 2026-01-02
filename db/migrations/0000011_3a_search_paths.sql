-- migrate:up
ALTER ROLE auth_role SET search_path = auth;
ALTER ROLE app_user SET search_path = app;
ALTER ROLE api_user SET search_path = api;

-- migrate:down
ALTER ROLE auth_role SET search_path = public;
ALTER ROLE app_user SET search_path = public;
ALTER ROLE api_user SET search_path = public;