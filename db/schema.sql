\restrict ZUTPtNGGhRHny3xw0fHlj7yw4a1ruRxuoRKyNt789tApUvxfhaQmmbohq19EcbS

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: api; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA api;


--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: web; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA web;


--
-- Name: workers; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA workers;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: pdfs; Type: TABLE; Schema: api; Owner: -
--

CREATE TABLE api.pdfs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    project_id uuid NOT NULL,
    labeled_entities jsonb,
    full_text text,
    extract_method text,
    text_by_page jsonb,
    bookmarks jsonb,
    predicted_entities jsonb,
    model_type text,
    model text,
    prompt_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT pdfs_extract_method_check CHECK ((extract_method = ANY (ARRAY['pdfium'::text, 'tesseract'::text, 'olm'::text, 'deepseek'::text]))),
    CONSTRAINT pdfs_model_type_check CHECK ((model_type = ANY (ARRAY['SLM'::text, 'LLM'::text])))
);


--
-- Name: prompts; Type: TABLE; Schema: api; Owner: -
--

CREATE TABLE api.prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    template_id bigint,
    full_text text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: templates; Type: TABLE; Schema: api; Owner: -
--

CREATE TABLE api.templates (
    id bigint NOT NULL,
    txt text NOT NULL,
    inserts text[] NOT NULL,
    document_at_end boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: templates_id_seq; Type: SEQUENCE; Schema: api; Owner: -
--

ALTER TABLE api.templates ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME api.templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: annotations; Type: TABLE; Schema: web; Owner: -
--

CREATE TABLE web.annotations (
    id uuid NOT NULL,
    pdf_id uuid NOT NULL,
    subtype text NOT NULL,
    rect jsonb NOT NULL,
    segment_rects jsonb NOT NULL,
    page_index integer NOT NULL,
    color text,
    opacity real,
    contents text,
    custom_entity_type text,
    author text,
    created timestamp without time zone,
    modified timestamp without time zone,
    blend_mode text,
    CONSTRAINT annotations_blend_mode_check CHECK ((blend_mode = ANY (ARRAY['Normal'::text, 'Multiply'::text, 'Screen'::text, 'Overlay'::text, 'Darken'::text, 'Lighten'::text, 'ColorDodge'::text, 'ColorBurn'::text, 'HardLight'::text, 'SoftLight'::text, 'Difference'::text, 'Exclusion'::text, 'Hue'::text, 'Saturation'::text, 'Color'::text, 'Luminosity'::text]))),
    CONSTRAINT annotations_subtype_check CHECK ((subtype = ANY (ARRAY['highlight'::text, 'underline'::text, 'squiggly'::text, 'strikeout'::text])))
);


--
-- Name: entity_types; Type: TABLE; Schema: web; Owner: -
--

CREATE TABLE web.entity_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    page1_definition text,
    page1_examples text[],
    page1_datatype text,
    "unique" boolean DEFAULT true NOT NULL,
    required boolean DEFAULT true NOT NULL,
    subtype text,
    color text,
    opacity real,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT entity_types_color_check CHECK ((color ~ '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'::text)),
    CONSTRAINT entity_types_opacity_check CHECK (((opacity >= (0)::double precision) AND (opacity <= (1)::double precision))),
    CONSTRAINT entity_types_subtype_check CHECK ((subtype = ANY (ARRAY['highlight'::text, 'underline'::text, 'squiggly'::text, 'strikeout'::text])))
);


--
-- Name: pdfs; Type: TABLE; Schema: web; Owner: -
--

CREATE TABLE web.pdfs (
    id uuid NOT NULL,
    first_viewed_at timestamp with time zone DEFAULT now()
);


--
-- Name: projects; Type: TABLE; Schema: web; Owner: -
--

CREATE TABLE web.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    color_presets text[],
    orientation text DEFAULT 'any'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT projects_orientation_check CHECK ((orientation = ANY (ARRAY['any'::text, 'portrait'::text, 'landscape'::text])))
);


--
-- Name: users; Type: TABLE; Schema: web; Owner: -
--

CREATE TABLE web.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    employer text,
    job_title text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: pdfs pdfs_pkey; Type: CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.pdfs
    ADD CONSTRAINT pdfs_pkey PRIMARY KEY (id);


--
-- Name: prompts prompts_pkey; Type: CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.prompts
    ADD CONSTRAINT prompts_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: annotations annotations_pkey; Type: CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.annotations
    ADD CONSTRAINT annotations_pkey PRIMARY KEY (id);


--
-- Name: entity_types entity_types_pkey; Type: CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.entity_types
    ADD CONSTRAINT entity_types_pkey PRIMARY KEY (id);


--
-- Name: pdfs pdfs_pkey; Type: CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.pdfs
    ADD CONSTRAINT pdfs_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: pdfs pdfs_updated_at; Type: TRIGGER; Schema: api; Owner: -
--

CREATE TRIGGER pdfs_updated_at BEFORE UPDATE ON api.pdfs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: prompts prompts_updated_at; Type: TRIGGER; Schema: api; Owner: -
--

CREATE TRIGGER prompts_updated_at BEFORE UPDATE ON api.prompts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: templates templates_updated_at; Type: TRIGGER; Schema: api; Owner: -
--

CREATE TRIGGER templates_updated_at BEFORE UPDATE ON api.templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: entity_types entity_types_updated_at; Type: TRIGGER; Schema: web; Owner: -
--

CREATE TRIGGER entity_types_updated_at BEFORE UPDATE ON web.entity_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projects projects_updated_at; Type: TRIGGER; Schema: web; Owner: -
--

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON web.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users users_updated_at; Type: TRIGGER; Schema: web; Owner: -
--

CREATE TRIGGER users_updated_at BEFORE UPDATE ON web.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pdfs pdfs_project_id_fkey; Type: FK CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.pdfs
    ADD CONSTRAINT pdfs_project_id_fkey FOREIGN KEY (project_id) REFERENCES web.projects(id) ON DELETE CASCADE;


--
-- Name: pdfs pdfs_prompt_id_fkey; Type: FK CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.pdfs
    ADD CONSTRAINT pdfs_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES api.prompts(id) ON DELETE CASCADE;


--
-- Name: prompts prompts_project_id_fkey; Type: FK CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.prompts
    ADD CONSTRAINT prompts_project_id_fkey FOREIGN KEY (project_id) REFERENCES web.projects(id) ON DELETE CASCADE;


--
-- Name: prompts prompts_template_id_fkey; Type: FK CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.prompts
    ADD CONSTRAINT prompts_template_id_fkey FOREIGN KEY (template_id) REFERENCES api.templates(id) ON DELETE CASCADE;


--
-- Name: annotations annotations_pdf_id_fkey; Type: FK CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.annotations
    ADD CONSTRAINT annotations_pdf_id_fkey FOREIGN KEY (pdf_id) REFERENCES web.pdfs(id) ON DELETE CASCADE;


--
-- Name: entity_types entity_types_project_id_fkey; Type: FK CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.entity_types
    ADD CONSTRAINT entity_types_project_id_fkey FOREIGN KEY (project_id) REFERENCES web.projects(id) ON DELETE CASCADE;


--
-- Name: pdfs pdfs_id_fkey; Type: FK CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.pdfs
    ADD CONSTRAINT pdfs_id_fkey FOREIGN KEY (id) REFERENCES api.pdfs(id) ON DELETE CASCADE;


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES web.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ZUTPtNGGhRHny3xw0fHlj7yw4a1ruRxuoRKyNt789tApUvxfhaQmmbohq19EcbS


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('00002'),
    ('00010'),
    ('00020'),
    ('00030'),
    ('00040'),
    ('00041'),
    ('00050'),
    ('00060'),
    ('00070');
