-- migrate:up
CREATE TABLE web.applications (
  "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 1),
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "message" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- migrate:down
DROP TABLE web.applications;
