-- migrate:up
CREATE TABLE app.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  color_presets TEXT[], -- list of hex color code strings
  orientation TEXT NOT NULL DEFAULT 'any' CHECK (orientation IN ('any', 'portrait', 'landscape')),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
-- migrate:down
DROP TABLE app.projects;
