-- migrate:up
CREATE TABLE web.projects (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT REFERENCES web.users (id) ON DELETE SET NULL,
  owner_team_id TEXT REFERENCES web.teams (id) ON DELETE SET NULL,
  bucket_id UUID REFERENCES api.aws_buckets (id) ON DELETE SET NULL,

  -- user entered
  "name" TEXT NOT NULL,
  "description" TEXT,
  color_presets TEXT[], -- list of hex color code strings
  orientation TEXT NOT NULL DEFAULT 'any' CHECK (orientation IN ('any', 'portrait', 'landscape')),

  -- user entered based on recommendations
  active_ocr_method TEXT NOT NULL DEFAULT 'olm-ocr2' REFERENCES public.ocr_methods (id) ON DELETE SET DEFAULT,
  active_chat_model TEXT NOT NULL DEFAULT 'gpt-5.4-mini' REFERENCES public.chat_models (id) ON DELETE SET DEFAULT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- project is owned by a user with inidivual role (no org) or by a team
  CONSTRAINT has_owner CHECK (owner_user_id IS NOT NULL OR owner_team_id IS NOT NULL)
);

CREATE TRIGGER projects_updated_at
BEFORE UPDATE ON web.projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION web.prevent_project_bucket_change()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.bucket_id IS DISTINCT FROM NEW.bucket_id THEN
    RAISE EXCEPTION 'bucket_id is immutable once set';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_bucket_immutable
BEFORE UPDATE OF bucket_id ON web.projects
FOR EACH ROW
EXECUTE FUNCTION web.prevent_project_bucket_change();

-- migrate:down
DROP TRIGGER projects_bucket_immutable ON web.projects;
DROP FUNCTION web.prevent_project_bucket_change();
DROP TRIGGER projects_updated_at ON web.projects;
DROP TABLE web.projects;
