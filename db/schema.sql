\restrict 35tPESLU7lTLe6X9msDTEYOh5aTKT3UnYUzjyP0YAalYHiIphKmUFEzvFbvoARE

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: annotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.annotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT annotations_blend_mode_check CHECK ((blend_mode = ANY (ARRAY['Normal'::text, 'Multiply'::text, 'Screen'::text, 'Overlay'::text, 'Darken'::text, 'Lighten'::text, 'ColorDodge'::text, 'ColorBurn'::text, 'HardLight'::text, 'SoftLight'::text, 'Difference'::text, 'Exclusion'::text, 'Hue'::text, 'Saturation'::text, 'Color'::text, 'Luminosity'::text]))),
    CONSTRAINT annotations_subtype_check CHECK ((subtype = ANY (ARRAY['highlight'::text, 'underline'::text, 'squiggly'::text, 'strikeout'::text])))
);


--
-- Name: entity_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_types (
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
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT entity_types_color_check CHECK ((color ~ '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'::text)),
    CONSTRAINT entity_types_opacity_check CHECK (((opacity >= (0)::double precision) AND (opacity <= (1)::double precision))),
    CONSTRAINT entity_types_subtype_check CHECK ((subtype = ANY (ARRAY['highlight'::text, 'underline'::text, 'squiggly'::text, 'strikeout'::text])))
);


--
-- Name: pdfs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdfs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    filename text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    color_presets text[],
    orientation text DEFAULT 'any'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT projects_orientation_check CHECK ((orientation = ANY (ARRAY['any'::text, 'portrait'::text, 'landscape'::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    employer text,
    job_title text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: annotations annotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotations
    ADD CONSTRAINT annotations_pkey PRIMARY KEY (id);


--
-- Name: entity_types entity_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_types
    ADD CONSTRAINT entity_types_pkey PRIMARY KEY (id);


--
-- Name: pdfs pdfs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdfs
    ADD CONSTRAINT pdfs_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: annotations annotations_pdf_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotations
    ADD CONSTRAINT annotations_pdf_id_fkey FOREIGN KEY (pdf_id) REFERENCES public.pdfs(id) ON DELETE CASCADE;


--
-- Name: entity_types entity_types_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_types
    ADD CONSTRAINT entity_types_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: pdfs pdfs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdfs
    ADD CONSTRAINT pdfs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 35tPESLU7lTLe6X9msDTEYOh5aTKT3UnYUzjyP0YAalYHiIphKmUFEzvFbvoARE


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20251205081600'),
    ('20251205081630'),
    ('20251205081700'),
    ('20251205081730'),
    ('20251205081800');
