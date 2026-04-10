-- migrate:up

-- Replace the unused TEXT bucket column with a proper FK to aws_buckets
ALTER TABLE web.projects DROP COLUMN IF EXISTS bucket;
ALTER TABLE web.projects ADD COLUMN bucket_id UUID REFERENCES public.aws_buckets (id);

-- owner_role needs REFERENCES on aws_buckets for the FK constraint
GRANT REFERENCES ON public.aws_buckets TO owner_role;
-- web_user needs SELECT to read bucket_id values when joining
GRANT SELECT ON public.aws_buckets TO web_user;

-- migrate:down
ALTER TABLE web.projects DROP COLUMN IF EXISTS bucket_id;
ALTER TABLE web.projects ADD COLUMN bucket TEXT;
REVOKE SELECT ON public.aws_buckets FROM web_user;
REVOKE REFERENCES ON public.aws_buckets FROM owner_role;
